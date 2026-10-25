"use client";

import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { ArrowLeft, Upload, Download, Loader2, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { normalizePhone } from "@/lib/utils/phone";
import { useCurrentTerm } from "@/hooks/useCurrentTerm";

const EXPECTED_HEADERS = [
  "Student Name", "Class", "Reg No", "Age", "Gender", "Guardian Name", "Guardian Phone 1", "Guardian Phone 2",
];

type ParsedStudent = {
  _rowNumber: number;
  _normPhone1: string;
  _normPhone2: string;
  _isTidied: boolean;
  studentName: string;
  className: string;
  regNo: string;
  age: string;
  gender: string;
  guardianName: string;
  phone1: string;
  phone2: string;
};

type StudentGroup = {
  normalizedPhone: string;
  students: ParsedStudent[];
  familyNames: string[];
  issue: any;
};

export function StudentImportWizard({
  callAdminApi,
  onBack,
  onSuccess,
}: {
  callAdminApi: (action: string, payload: any) => Promise<any>;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const { session } = useCurrentTerm();

  const [step, setStep] = useState<"upload" | "check" | "done">("upload");
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleDownloadTemplate = () => {
    const sample = ["John Doe", "Primary 1", "STU-001", "6", "Male", "Mr. John Doe", "08031234567", "08099887766"];
    const ws = XLSX.utils.aoa_to_sheet([EXPECTED_HEADERS, sample]);
    ws["!cols"] = EXPECTED_HEADERS.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students Import");
    XLSX.writeFile(wb, "Students_Import_Template.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const wb = XLSX.read(event.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (rawData.length < 2) { toast.error("File is empty."); return; }

        const rawHeaders = rawData[0].map((h: any) => String(h || "").trim());
        const isValid = rawHeaders.length === EXPECTED_HEADERS.length && EXPECTED_HEADERS.every((h, i) => rawHeaders[i].toLowerCase() === h.toLowerCase());

        if (!isValid) {
          toast.error("Invalid file structure. Download the official template and try again.");
          e.target.value = "";
          return;
        }

        const parsed: ParsedStudent[] = rawData.slice(1)
          .filter(row => row.some(c => c))
          .map((row, idx) => {
            const rawPhone1 = String(row[6] || "").trim();
            const rawPhone2 = String(row[7] || "").trim();
            const norm1 = normalizePhone(rawPhone1);
            const norm2 = normalizePhone(rawPhone2);
            return {
              _rowNumber: idx + 2,
              _normPhone1: norm1,
              _normPhone2: norm2,
              _isTidied: (norm1 !== rawPhone1.replace(/\D/g, "")) || (norm2 !== rawPhone2.replace(/\D/g, "")),
              studentName: String(row[0] || "").trim(),
              className: String(row[1] || "").trim(),
              regNo: String(row[2] || "").trim(),
              age: String(row[3] || "").trim(),
              gender: String(row[4] || "").trim(),
              guardianName: String(row[5] || "").trim(),
              phone1: rawPhone1,
              phone2: rawPhone2,
            };
          });

        if (parsed.length === 0) { toast.error("No rows found."); return; }
        setParsedStudents(parsed);
        setStep("check");
      } catch (err) { toast.error("Failed to parse file."); }
    };
    reader.readAsBinaryString(file);
  };

  const buildGroups = (): StudentGroup[] => {
    const map = new Map<string, StudentGroup>();
    parsedStudents.forEach((student) => {
      const phone = student._normPhone1 || student._normPhone2;
      const key = phone || `__no_phone_${student._rowNumber}`;
      if (!map.has(key)) map.set(key, { normalizedPhone: phone, students: [], familyNames: [], issue: null });
      const group = map.get(key)!;
      group.students.push(student);
      const guardian = student.guardianName || "Unknown";
      const familyName = `${guardian} Family`;
      if (!group.familyNames.includes(familyName)) group.familyNames.push(familyName);
    });

    map.forEach((group) => {
      if (!group.normalizedPhone || group.normalizedPhone.length < 10) group.issue = { type: "missing_phone" };
      else if (group.familyNames.length > 1) group.issue = { type: "conflict", familyNames: group.familyNames };
    });
    return Array.from(map.values());
  };

  const groups = buildGroups();
  const unresolvedCount = groups.filter(g => g.issue).length;
  const readyCount = parsedStudents.filter(s => !groups.find(g => g.students.includes(s) && g.issue)).length;
  const tidiedCount = parsedStudents.filter(s => s._isTidied).length;

  const handleFixPhone = (group: StudentGroup, newPhone: string) => {
    const normalized = normalizePhone(newPhone);
    setParsedStudents(prev => prev.map(s => group.students.some(gs => gs._rowNumber === s._rowNumber) ? { ...s, phone1: newPhone, _normPhone1: normalized } : s));
  };

  const handleResolveConflict = (group: StudentGroup, chosenFamilyName: string) => {
    const guardianName = chosenFamilyName.replace(/ Family$/i, "");
    setParsedStudents(prev => prev.map(s => group.students.some(gs => gs._rowNumber === s._rowNumber) ? { ...s, guardianName } : s));
  };

  const handleImport = async () => {
    if (!session?.id) { toast.error("No active session."); return; }
    if (unresolvedCount > 0) { toast.error("Please resolve all exceptions first."); return; }

    setIsImporting(true);
    try {
      const rows = parsedStudents.filter(s => s.studentName && s.className).map(s => ({
        studentName: s.studentName, className: s.className, regNo: s.regNo, guardianName: s.guardianName,
        phone1: s.phone1, phone2: s.phone2, gender: s.gender, age: s.age,
      }));

      const data = await callAdminApi("import-students", { students: rows, sessionId: session.id });
      setResults(data);
      setStep("done");
      toast.success(`Imported ${data.inserted} students!`);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto p-4 pb-32">
      <header className="flex items-center gap-2 mb-6">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-slate-200">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import Students</h1>
          <p className="text-sm text-slate-500">
            {step === "upload" && "Upload your roster"}
            {step === "check" && "Review & fix exceptions"}
            {step === "done" && "Complete"}
          </p>
        </div>
      </header>

      <div className="flex items-center gap-2 mb-6 text-xs font-bold">
        <span className={`px-3 py-1 rounded-full ${step === "upload" ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"}`}>1 Upload</span>
        <span className="text-slate-300">—</span>
        <span className={`px-3 py-1 rounded-full ${step === "check" ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>2 Check</span>
        <span className="text-slate-300">—</span>
        <span className={`px-3 py-1 rounded-full ${step === "done" ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>3 Done</span>
      </div>

      {step === "upload" && (
        <>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-blue-900 mb-1">Use the official template</p>
              <p className="text-xs text-blue-700 mb-3">Do not rename columns. Download and fill this file.</p>
              <button onClick={handleDownloadTemplate} className="bg-blue-600 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                <Download className="w-4 h-4" /> Download Template
              </button>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 border-dashed text-center">
            <div className="w-12 h-12 bg-slate-50 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-3"><Upload className="w-6 h-6" /></div>
            <h3 className="font-bold text-slate-900 mb-1">Select Excel File</h3>
            <p className="text-xs text-slate-500 mb-4">.xlsx, .xls, or .csv</p>
            <label className="block w-full bg-slate-900 text-white font-bold py-3 rounded-xl cursor-pointer hover:bg-slate-800">
              Browse Files
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </>
      )}

      {step === "check" && (
        <>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Users className="w-6 h-6" /></div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">{parsedStudents.length} students</h2>
                <p className="text-xs text-slate-500">in {groups.length} families, grouped by phone</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-lg font-black text-green-600">{readyCount}</p><p className="text-[10px] font-bold text-green-700 uppercase">Ready</p></div>
              <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-lg font-black text-blue-600">{tidiedCount}</p><p className="text-[10px] font-bold text-blue-700 uppercase">Tidied</p></div>
              <div className="bg-orange-50 rounded-xl p-3 text-center"><p className="text-lg font-black text-orange-600">{unresolvedCount}</p><p className="text-[10px] font-bold text-orange-700 uppercase">To Look At</p></div>
            </div>
          </div>

          {unresolvedCount > 0 && (
            <div className="space-y-3 mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Needs a Quick Look · {unresolvedCount}</p>
              {groups.filter(g => g.issue).map((group, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                  {group.issue?.type === "conflict" && (
                    <>
                      <p className="font-bold text-slate-900 mb-1">Same number, two family names</p>
                      <p className="text-xs text-slate-500 mb-3">{group.students.map(s => `${s.studentName} (${s.className})`).join(" and ")} both use {group.normalizedPhone}.</p>
                      <div className="flex flex-col gap-2">
                        {group.familyNames.map(fn => (<button key={fn} onClick={() => handleResolveConflict(group, fn)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">Merge into {fn}</button>))}
                      </div>
                    </>
                  )}
                  {group.issue?.type === "missing_phone" && (
                    <>
                      <p className="font-bold text-slate-900 mb-1">No phone number</p>
                      <p className="text-xs text-slate-500 mb-3">{group.students.map(s => `${s.studentName} (${s.className})`).join(" and ")}. Add one number for both.</p>
                      <input type="tel" placeholder="0803 123 4567" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500" onChange={(e) => handleFixPhone(group, e.target.value)} />
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <button onClick={handleImport} disabled={isImporting || unresolvedCount > 0} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
            {isImporting ? <><Loader2 className="w-5 h-5 animate-spin" /> Importing...</> : unresolvedCount > 0 ? `Sort ${unresolvedCount} more to continue` : `Import ${parsedStudents.length} Students`}
          </button>
        </>
      )}

      {step === "done" && results && (
        <div className="text-center py-10">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-900 mb-2">Import Complete!</h2>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mt-6 max-w-sm mx-auto text-left space-y-2">
            <div className="flex justify-between"><span className="text-slate-500">Inserted</span><span className="font-bold text-green-600">{results.inserted}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Skipped</span><span className="font-bold text-red-600">{results.skipped}</span></div>
          </div>
          <button onClick={onSuccess} className="mt-6 bg-blue-600 text-white font-bold px-8 py-3 rounded-xl">Back to Students</button>
        </div>
      )}
    </div>
  );
}