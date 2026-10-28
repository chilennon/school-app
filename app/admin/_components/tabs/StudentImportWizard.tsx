"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Users,
  FileSpreadsheet,
  PhoneOff,
  Copy,
  Download,
} from "lucide-react";
import { normalizePhone } from "@/lib/utils/phone";
import { useCurrentTerm } from "@/hooks/useCurrentTerm";
import { supabase } from "@/lib/supabaseClient";

// --- Types ---
type RawRow = Record<string, any>;

type MappingConfig = {
  studentName: string | null;
  class: string | null;
  regNo: string | null;
  age: string | null;
  gender: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
};

type ParsedStudent = {
  _rowNumber: number;
  _normPhone1: string;
  _isTidied: boolean;
  studentName: string;
  className: string;
  regNo: string;
  age: string;
  gender: string;
  guardianName: string;
  phone1: string;
  _isDuplicate?: boolean;
  _duplicateReason?: string;
};

type StudentGroup = {
  normalizedPhone: string;
  students: ParsedStudent[];
  familyNames: string[];
  issue: any;
};

// --- Parsing Logic ---
function autoMapHeaders(headers: string[]): MappingConfig {
  const config: MappingConfig = {
    studentName: null,
    class: null,
    regNo: null,
    age: null,
    gender: null,
    guardianName: null,
    guardianPhone: null,
  };
  headers.forEach((header) => {
    const h = header.toLowerCase();
    if (
      !config.studentName &&
      (h.includes("student") ||
        h.includes("pupil") ||
        (h.includes("name") && !h.includes("guardian")))
    )
      config.studentName = header;
    else if (!config.class && (h.includes("class") || h.includes("grade")))
      config.class = header;
    else if (!config.regNo && (h.includes("reg") || h.includes("admission")))
      config.regNo = header;
    else if (!config.age && h.includes("age")) config.age = header;
    else if (!config.gender && (h.includes("sex") || h.includes("gender")))
      config.gender = header;
    else if (
      !config.guardianName &&
      (h.includes("guardian") ||
        h.includes("parent") ||
        h.includes("father") ||
        h.includes("mother"))
    )
      config.guardianName = header;
    else if (
      !config.guardianPhone &&
      (h.includes("phone") || h.includes("tel") || h.includes("contact"))
    )
      config.guardianPhone = header;
  });
  return config;
}

function normalizeClassName(rawClass: string): string {
  if (!rawClass) return "";
  let c = rawClass.trim().toLowerCase();
  const numberWords: Record<string, string> = {
    one: "1", two: "2", three: "3", four: "4", five: "5", six: "6",
    i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6",
  };
  Object.keys(numberWords).forEach((word) => {
    c = c.replace(new RegExp(`\\b${word}\\b`, "g"), numberWords[word]);
  });
  if (c.includes("primary") || c.includes("basic")) {
    const match = c.match(/(\d+)/);
    if (match) return `Basic ${match[1]}`;
  }
  if (c.includes("nursery")) {
    const match = c.match(/(\d+)/);
    if (match) return `Nursery ${match[1]}`;
  }
  if (c.includes("kg") || c.includes("kindergarten")) {
    const match = c.match(/(\d+)/);
    if (match) return `KG ${match[1]}`;
  }
  if (c.includes("playgroup") || c.includes("play group")) return "Playgroup";
  return rawClass.trim().replace(/\b\w/g, (l) => l.toUpperCase());
}

export function StudentImportWizard({
  callAdminApi,
  existingClasses = [],
  onBack,
  onSuccess,
}: {
  callAdminApi: (action: string, payload: any) => Promise<any>;
  existingClasses: { id: string; name: string }[];
  onBack: () => void;
  onSuccess: () => void;
}) {
  const { session } = useCurrentTerm();

  const [step, setStep] = useState<
    "upload" | "sheet-select" | "mapping" | "check" | "done"
  >("upload");
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<any>(null);

  // File State
  const [fileName, setFileName] = useState("");
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);

  // Data State
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<MappingConfig | null>(null);
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [classesToCreate, setClassesToCreate] = useState<string[]>([]);

  // Existing Students for Duplicate Check
  const [existingStudents, setExistingStudents] = useState<
    { name: string; className: string }[]
  >([]);

  useEffect(() => {
    async function fetchStudents() {
      const { data } = await supabase
        .from("students")
        .select("name, class:classes(name)")
        .is("deleted_at", null);
      if (data) {
        setExistingStudents(
          data.map((s: any) => ({
            name: s.name.toLowerCase().trim(),
            className: s.class?.name.toLowerCase().trim() || "",
          })),
        );
      }
    }
    fetchStudents();
  }, []);

  // 🚨 FIXED: Moved handleDownloadTemplate to the top level
  const handleDownloadTemplate = () => {
    const headers = [
      "Student Name", "Class", "Reg No", "Age", "Gender", "Guardian Name", "Guardian Phone 1", "Guardian Phone 2",
    ];
    const sample = [
      "John Doe", "Primary 1", "STU-001", "6", "Male", "Mr. John Doe", "08031234567", "08099887766",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    ws["!cols"] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students Import");
    XLSX.writeFile(wb, "Students_Import_Template.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);

        const allStudentsSheet = wb.SheetNames.find(
          (name) =>
            name.toLowerCase().includes("all student") ||
            name.toLowerCase() === "students",
        );

        if (allStudentsSheet) processSheet(wb, allStudentsSheet);
        else if (wb.SheetNames.length === 1) processSheet(wb, wb.SheetNames[0]);
        else setStep("sheet-select");
      } catch (err) {
        toast.error("Failed to parse file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
    }) as any[][];

    if (rawData.length < 2) {
      toast.error(`Sheet "${sheetName}" is empty.`);
      return;
    }

    const rawHeaders = rawData[0]
      .map((h: any) => String(h).trim())
      .filter(Boolean);
    const extractedRows: RawRow[] = rawData.slice(1).map((row) => {
      const rowObj: RawRow = {};
      rawHeaders.forEach((header, index) => {
        rowObj[header] = row[index];
      });
      return rowObj;
    });

    setHeaders(rawHeaders);
    setRawRows(extractedRows);
    setMapping(autoMapHeaders(rawHeaders));
    setStep("mapping");
  };

  // 🚨 FIXED: Clean mapping logic without nested functions
  const handleMappingConfirm = () => {
    if (!mapping?.studentName || !mapping?.class) {
      toast.error("Student Name and Class are required mappings.");
      return;
    }

    const seenInFile = new Set<string>();

    const parsed: ParsedStudent[] = rawRows
      .map((row, idx) => {
        const rawPhone = mapping.guardianPhone
          ? String(row[mapping.guardianPhone] || "").trim()
          : "";
        const norm1 = normalizePhone(rawPhone);

        const studentName = String(row[mapping.studentName!] || "").trim();
        const className = normalizeClassName(String(row[mapping.class!] || ""));
        const studentKey = `${studentName.toLowerCase()}|${className.toLowerCase()}`;

        let _isDuplicate = false;
        let _duplicateReason = "";

        const existsInDb = existingStudents.some(
          (s) =>
            s.name === studentName.toLowerCase() &&
            s.className === className.toLowerCase(),
        );

        if (existsInDb) {
          _isDuplicate = true;
          _duplicateReason = "Student already exists in the system.";
        } else if (seenInFile.has(studentKey)) {
          _isDuplicate = true;
          _duplicateReason = "Duplicate Name & Class in this Excel file.";
        }

        seenInFile.add(studentKey);

        const rawRegNo = mapping.regNo
          ? String(row[mapping.regNo] || "").trim()
          : "";
        const autoRegNo = `STU-${String(idx + 1).padStart(3, "0")}`;

        return {
          _rowNumber: idx + 2,
          _normPhone1: norm1,
          _isTidied: norm1 !== rawPhone.replace(/\D/g, ""),
          studentName: studentName,
          className: className,
          regNo: rawRegNo || autoRegNo,
          age: mapping.age ? String(row[mapping.age] || "").trim() : "",
          gender: mapping.gender
            ? String(row[mapping.gender] || "").trim()
            : "",
          guardianName: mapping.guardianName
            ? String(row[mapping.guardianName] || "").trim()
            : "Unknown",
          phone1: rawPhone,
          _isDuplicate,
          _duplicateReason,
        };
      })
      .filter((s) => s.studentName.length > 0);

    setParsedStudents(parsed);

    const existingNames = existingClasses.map((c) => c.name);
    const uniqueExcelClasses = Array.from(
      new Set(parsed.map((s) => s.className).filter(Boolean)),
    );
    const missing = uniqueExcelClasses.filter(
      (c) => !existingNames.includes(c),
    );
    setClassesToCreate(missing);

    setStep("check");
  };

  const handleEditDuplicate = (
    index: number,
    field: "studentName" | "className",
    value: string,
  ) => {
    const newStudents = [...parsedStudents];
    const row = { ...newStudents[index], [field]: value };

    const studentKey = `${row.studentName.toLowerCase()}|${row.className.toLowerCase()}`;
    const existsInDb = existingStudents.some(
      (s) =>
        s.name === row.studentName.toLowerCase() &&
        s.className === row.className.toLowerCase(),
    );

    const existsInFile = parsedStudents.some(
      (s, i) =>
        i !== index &&
        s.studentName.toLowerCase() === row.studentName.toLowerCase() &&
        s.className.toLowerCase() === row.className.toLowerCase(),
    );

    if (existsInDb) {
      row._isDuplicate = true;
      row._duplicateReason = "Student already exists in the system.";
    } else if (existsInFile) {
      row._isDuplicate = true;
      row._duplicateReason = "Duplicate Name & Class in this Excel file.";
    } else {
      row._isDuplicate = false;
      row._duplicateReason = "";
    }

    newStudents[index] = row;
    setParsedStudents(newStudents);
  };

  const buildGroups = (): StudentGroup[] => {
    const map = new Map<string, StudentGroup>();
    parsedStudents.forEach((student) => {
      const phone = student._normPhone1;
      const key = phone || `__no_phone_${student._rowNumber}`;
      if (!map.has(key))
        map.set(key, {
          normalizedPhone: phone,
          students: [],
          familyNames: [],
          issue: null,
        });
      const group = map.get(key)!;
      group.students.push(student);

      const guardian =
        student.guardianName !== "Unknown"
          ? student.guardianName
          : student.studentName;
      const familyName = `${guardian} Family`;

      if (!group.familyNames.includes(familyName))
        group.familyNames.push(familyName);
    });

    map.forEach((group) => {
      if (!group.normalizedPhone || group.normalizedPhone.length < 10) {
        group.issue = { type: "missing_phone" };
      } else if (group.familyNames.length > 1) {
        group.issue = { type: "conflict", familyNames: group.familyNames };
      }
    });
    return Array.from(map.values());
  };

  const groups = buildGroups();

  const conflictGroups = groups.filter((g) => g.issue?.type === "conflict");
  const missingPhoneGroups = groups.filter(
    (g) => g.issue?.type === "missing_phone",
  );

  const duplicateStudents = parsedStudents.filter((s) => s._isDuplicate);

  const conflictCount = conflictGroups.length;
  const readyCount = parsedStudents.filter(
    (s) =>
      !conflictGroups.find((g) => g.students.includes(s)) && !s._isDuplicate,
  ).length;
  const tidiedCount = parsedStudents.filter((s) => s._isTidied).length;

  const handleResolveConflict = (
    group: StudentGroup,
    chosenFamilyName: string,
  ) => {
    const guardianName = chosenFamilyName.replace(/ Family$/i, "");
    setParsedStudents((prev) =>
      prev.map((s) =>
        group.students.some((gs) => gs._rowNumber === s._rowNumber)
          ? { ...s, guardianName }
          : s,
      ),
    );
  };

  const toggleClassCreation = (className: string) => {
    setClassesToCreate((prev) =>
      prev.includes(className)
        ? prev.filter((c) => c !== className)
        : [...prev, className],
    );
  };

  const handleImport = async () => {
    if (!session?.id) {
      toast.error("No active session.");
      return;
    }
    if (conflictCount > 0) {
      toast.error("Please resolve all conflicts first.");
      return;
    }

    setIsImporting(true);
    try {
      const rows = parsedStudents
        .filter((s) => s.studentName && s.className && !s._isDuplicate)
        .map((s) => ({
          studentName: s.studentName,
          className: s.className,
          regNo: s.regNo,
          guardianName:
            s.guardianName !== "Unknown" ? s.guardianName : s.studentName,
          phone1: s.phone1 || null,
          phone2: null,
          gender: s.gender,
          age: s.age,
        }));

      if (rows.length === 0) {
        toast.error("No valid students to import.");
        setIsImporting(false);
        return;
      }

      const data = await callAdminApi("import-students-bulk", {
        rows,
        classesToCreate,
        sessionId: session.id,
      });

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
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-slate-200"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import Students</h1>
          <p className="text-sm text-slate-500">
            {step === "upload" && "Upload your roster"}
            {step === "sheet-select" && "Select sheet"}
            {step === "mapping" && "Map columns"}
            {step === "check" && "Review & fix exceptions"}
            {step === "done" && "Complete"}
          </p>
        </div>
      </header>

      {/* STEP 1: UPLOAD */}
      {step === "upload" && (
        <>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-blue-900 mb-1">Bring your own format</p>
              <p className="text-xs text-blue-700 mb-3">
                Upload your Excel file. We'll find the "All Students" sheet and map your columns automatically. 
                Or, download our standard template if you prefer.
              </p>
              <button 
                onClick={handleDownloadTemplate}
                className="bg-white text-blue-700 font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 hover:bg-blue-100 transition-colors border border-blue-200"
              >
                <Download className="w-4 h-4" /> Download Standard Template
              </button>
            </div>
          </div>

          {/* 🚨 RESTORED: The Upload Box was missing previously */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 border-dashed text-center">
            <div className="w-12 h-12 bg-slate-50 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Select Excel File</h3>
            <p className="text-xs text-slate-500 mb-4">.xlsx, .xls, or .csv</p>
            <label className="block w-full bg-slate-900 text-white font-bold py-3 rounded-xl cursor-pointer hover:bg-slate-800">
              Browse Files
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </>
      )}

      {/* STEP 1.5: SELECT SHEET */}
      {step === "sheet-select" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">
            Which sheet has your students?
          </h2>
          <select
            onChange={(e) => processSheet(workbook!, e.target.value)}
            defaultValue=""
            className="w-full p-4 rounded-xl border border-slate-300 bg-white text-sm font-medium"
          >
            <option value="" disabled>
              Select a sheet...
            </option>
            {sheetNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* STEP 2: MAPPING */}
      {step === "mapping" && mapping && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Map Columns</h2>
          {Object.keys(mapping).map((key) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-sm font-bold text-slate-700 capitalize">
                {key.replace(/([A-Z])/g, " $1")}
              </label>
              <select
                value={mapping[key as keyof MappingConfig] || ""}
                onChange={(e) =>
                  setMapping({ ...mapping, [key]: e.target.value || null })
                }
                className="w-full p-3 rounded-xl border border-slate-300 bg-white text-sm"
              >
                <option value="">— Ignore —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button
            onClick={handleMappingConfirm}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-4"
          >
            Continue to Preview
          </button>
        </div>
      )}

      {/* STEP 3: CHECK & GROUPING */}
      {step === "check" && (
        <>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  {parsedStudents.length} students
                </h2>
                <p className="text-xs text-slate-500">
                  in {groups.length} families
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-lg font-black text-green-600">
                  {readyCount}
                </p>
                <p className="text-[10px] font-bold text-green-700 uppercase">
                  Ready
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-lg font-black text-blue-600">
                  {tidiedCount}
                </p>
                <p className="text-[10px] font-bold text-blue-700 uppercase">
                  Tidied
                </p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-lg font-black text-red-600">
                  {conflictCount}
                </p>
                <p className="text-[10px] font-bold text-red-700 uppercase">
                  Conflicts
                </p>
              </div>
            </div>
          </div>

          {/* MISSING CLASSES PROMPT */}
          {classesToCreate.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-4">
              <h3 className="text-sm font-bold text-yellow-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Missing Classes Detected
              </h3>
              <p className="text-xs text-yellow-700 mt-1 mb-3">
                The following classes are in your file but not in the system.
                Check them to create them automatically:
              </p>
              <div className="flex flex-wrap gap-2">
                {classesToCreate.map((c) => (
                  <label
                    key={c}
                    className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-yellow-300 text-sm font-medium cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => toggleClassCreation(c)}
                      className="rounded text-yellow-600 focus:ring-yellow-500"
                    />{" "}
                    Create "{c}"
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 🚨 EDITABLE DUPLICATES BANNER */}
          {duplicateStudents.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
              <h3 className="text-sm font-bold text-orange-800 flex items-center gap-2 mb-2">
                <Copy className="w-4 h-4" /> Duplicates Detected (
                {duplicateStudents.length})
              </h3>
              <p className="text-xs text-orange-700 mb-3">
                We found students that are either in the system or duplicated in
                this file. Edit the Name or Class to make them unique, or they
                will be skipped.
              </p>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {duplicateStudents.map((s) => {
                  const actualIndex = parsedStudents.findIndex(
                    (p) => p._rowNumber === s._rowNumber,
                  );
                  return (
                    <div
                      key={s._rowNumber}
                      className="bg-white p-3 rounded-xl border border-orange-100 flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          Row {s._rowNumber}
                        </span>
                        <span className="text-[10px] text-orange-600 font-bold">
                          {s._duplicateReason}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={s.studentName}
                          onChange={(e) =>
                            handleEditDuplicate(
                              actualIndex,
                              "studentName",
                              e.target.value,
                            )
                          }
                          className="flex-1 p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                          placeholder="Student Name"
                        />
                        <input
                          type="text"
                          value={s.className}
                          onChange={(e) =>
                            handleEditDuplicate(
                              actualIndex,
                              "className",
                              e.target.value,
                            )
                          }
                          className="w-28 p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                          placeholder="Class"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NON-BLOCKING MISSING PHONE BANNER */}
          {missingPhoneGroups.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
              <PhoneOff className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-orange-900">
                  Missing Phone Numbers ({missingPhoneGroups.length})
                </h3>
                <p className="text-xs text-orange-700 mt-1">
                  These students have no phone number. You can import them now
                  and add their numbers later in the Student tab.
                </p>
              </div>
            </div>
          )}

          {/* BLOCKING CONFLICTS ONLY */}
          {conflictCount > 0 && (
            <div className="space-y-3 mb-4">
              <p className="text-xs font-bold text-red-500 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Resolve Conflicts ·{" "}
                {conflictCount}
              </p>
              {conflictGroups.map((group, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-5 border border-red-100 shadow-sm"
                >
                  <p className="font-bold text-slate-900 mb-1">
                    Same number, two family names
                  </p>
                  <p className="text-xs text-slate-500 mb-3">
                    {group.students
                      .map((s) => `${s.studentName}`)
                      .join(" and ")}{" "}
                    both use {group.normalizedPhone}.
                  </p>
                  <div className="flex flex-col gap-2">
                    {group.familyNames.map((fn) => (
                      <button
                        key={fn}
                        onClick={() => handleResolveConflict(group, fn)}
                        className="w-full bg-blue-600 text-white font-bold py-2 rounded-xl text-sm"
                      >
                        Merge into {fn}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={isImporting || conflictCount > 0 || readyCount === 0}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Importing...
              </>
            ) : conflictCount > 0 ? (
              `Resolve ${conflictCount} conflicts to continue`
            ) : (
              `Import ${readyCount} Students`
            )}
          </button>
        </>
      )}

      {/* STEP 4: DONE */}
      {step === "done" && results && (
        <div className="text-center py-10">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-900 mb-2">
            Import Complete!
          </h2>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mt-6 max-w-sm mx-auto text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Inserted</span>
              <span className="font-bold text-green-600">
                {results.inserted}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Skipped</span>
              <span className="font-bold text-red-600">{results.skipped}</span>
            </div>
          </div>
          <button
            onClick={onSuccess}
            className="mt-6 bg-blue-600 text-white font-bold px-8 py-3 rounded-xl"
          >
            Back to Students
          </button>
        </div>
      )}
    </div>
  );
}