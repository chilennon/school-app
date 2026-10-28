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
  Download,
  Copy,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// --- Types ---
type RawRow = Record<string, any>;
type MappingConfig = {
  teacherName: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  assignedClass: string | null;
};

type ParsedTeacher = {
  _rowNumber: number;
  teacherName: string;
  email: string;
  phone: string;
  role: "teacher" | "admin";
  assignedClass: string;
  _isDuplicate?: boolean;
  _duplicateReason?: string;
};

export function TeacherImportWizard({
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
  const [step, setStep] = useState<"upload" | "mapping" | "check" | "done">(
    "upload",
  );
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<any>(null);

  // Data State
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<MappingConfig | null>(null);
  const [parsedTeachers, setParsedTeachers] = useState<ParsedTeacher[]>([]);
    const [duplicateRowNumbers, setDuplicateRowNumbers] = useState<number[]>([]);

  // DB State
  const [existingEmails, setExistingEmails] = useState<string[]>([]);
  useEffect(() => {
    supabase
      .from("profiles")
      .select("email")
      .then(({ data }) => {
        if (data) setExistingEmails(data.map((d) => d.email.toLowerCase()));
      });
  }, []);

  // 🚨 RESTORED: Template Download
  const handleDownloadTemplate = () => {
    const headers = [
      "Staff Name",
      "Position",
      "Email AD",
      "Phone No.",
      "Assigned Class",
    ];
    const sample = [
      "Mr. John Doe",
      "Teacher",
      "john@school.com",
      "08031234567",
      "Basic 1",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    ws["!cols"] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teachers Import");
    XLSX.writeFile(wb, "Teachers_Import_Template.xlsx");
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
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: "",
        }) as any[][];

        if (rawData.length < 2) {
          toast.error("File is empty");
          return;
        }

        // 🚨 FIX: Find the actual header row (skip the giant title row)
        let headerRowIndex = 0;
        for (let i = 0; i < rawData.length; i++) {
          const nonEmptyCells = rawData[i].filter(
            (c: any) => String(c).trim().length > 0,
          );
          // A real header row has at least 3 non-empty columns (e.g., S/N, Staff Name, Position)
          if (nonEmptyCells.length >= 3) {
            headerRowIndex = i;
            break;
          }
        }

        const rawHeaders = rawData[headerRowIndex]
          .map((h: any) => String(h).trim())
          .filter(Boolean);
        const extractedRows: RawRow[] = rawData
          .slice(headerRowIndex + 1)
          .map((row) => {
            const obj: RawRow = {};
            rawHeaders.forEach((h, i) => (obj[h] = row[i]));
            return obj;
          });

        setHeaders(rawHeaders);
        setRawRows(extractedRows);

        // Auto-map
        const config: MappingConfig = {
          teacherName: null,
          email: null,
          phone: null,
          position: null,
          assignedClass: null,
        };
        rawHeaders.forEach((h) => {
          const lower = h.toLowerCase();
          if (
            !config.teacherName &&
            (lower.includes("name") || lower.includes("staff"))
          )
            config.teacherName = h;
          else if (!config.email && lower.includes("email")) config.email = h;
          else if (
            !config.phone &&
            (lower.includes("phone") || lower.includes("tel"))
          )
            config.phone = h;
          else if (
            !config.position &&
            (lower.includes("position") || lower.includes("role"))
          )
            config.position = h;
          else if (!config.assignedClass && lower.includes("class"))
            config.assignedClass = h;
        });
        setMapping(config);
        setStep("mapping");
      } catch (err) {
        toast.error("Failed to parse file");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMappingConfirm = () => {
    if (!mapping?.teacherName) {
      toast.error("Teacher Name is required.");
      return;
    }

    const seenEmails = new Set<string>();

    const parsed = rawRows
      .map((row, idx) => {
        const teacherName = String(row[mapping.teacherName!] || "").trim();
        const email = mapping.email
          ? String(row[mapping.email] || "").trim()
          : "";
        const phone = mapping.phone
          ? String(row[mapping.phone] || "").trim()
          : "";
        const position = mapping.position
          ? String(row[mapping.position] || "").toLowerCase()
          : "";
        const assignedClass = mapping.assignedClass
          ? String(row[mapping.assignedClass] || "").trim()
          : "";

        // Role detection
        let role: "teacher" | "admin" = "teacher";
        if (
          position.includes("head") ||
          position.includes("admin") ||
          position.includes("bursar") ||
          position.includes("proprietor")
        ) {
          role = "admin";
        }

        // Duplicate check
        let _isDuplicate = false;
        let _duplicateReason = "";
        const emailKey = email.toLowerCase();

        if (emailKey) {
          if (existingEmails.includes(emailKey)) {
            _isDuplicate = true;
            _duplicateReason = "Email already exists in the system.";
          } else if (seenEmails.has(emailKey)) {
            _isDuplicate = true;
            _duplicateReason = "Duplicate Email in this Excel file.";
          }
          seenEmails.add(emailKey);
        }

        return {
          _rowNumber: idx + 2,
          teacherName,
          email,
          phone,
          role,
          assignedClass,
          _isDuplicate,
          _duplicateReason,
        };
      })
      .filter((t) => t.teacherName.length > 0);

    setParsedTeachers(parsed);
    setDuplicateRowNumbers(parsed.filter(t => t._isDuplicate).map(t => t._rowNumber));
    setStep("check");
  };

  // Updates the email as you type (does not remove the UI)
  const handleEditDuplicate = (index: number, newEmail: string) => {
    const newTeachers = [...parsedTeachers];
    newTeachers[index] = { ...newTeachers[index], email: newEmail };
    setParsedTeachers(newTeachers);
  };

  // Validates the email when you click away
  const handleValidateEmail = (index: number) => {
    const newTeachers = [...parsedTeachers];
    const row = { ...newTeachers[index] };
    const emailKey = row.email.toLowerCase();

    const existsInDb = existingEmails.includes(emailKey);
    const existsInFile = parsedTeachers.some(
      (t, i) => i !== index && t.email.toLowerCase() === emailKey
    );

    if (existsInDb) {
      row._isDuplicate = true;
      row._duplicateReason = "Email already exists in the system.";
    } else if (existsInFile) {
      row._isDuplicate = true;
      row._duplicateReason = "Duplicate Email in this Excel file.";
    } else {
      row._isDuplicate = false;
      row._duplicateReason = "";
    }

    newTeachers[index] = row;
    setParsedTeachers(newTeachers);
  };

  const handleImport = async () => {
    const validRows = parsedTeachers.filter((t) => !t._isDuplicate);
    if (validRows.length === 0) {
      toast.error("No valid teachers to import.");
      return;
    }

    setIsImporting(true);
    try {
      const data = await callAdminApi("import-teachers-bulk", {
        rows: validRows,
      });
      setResults(data);
      setStep("done");
      toast.success(`Imported ${data.inserted} teachers!`);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const duplicateCount = parsedTeachers.filter((t) => t._isDuplicate).length;

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
          <h1 className="text-2xl font-bold text-slate-900">Import Teachers</h1>
          <p className="text-sm text-slate-500">
            {step === "upload" && "Upload staff list"}
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
              <p className="text-sm font-bold text-blue-900 mb-1">
                Bring your own format
              </p>
              <p className="text-xs text-blue-700 mb-3">
                Upload your existing spreadsheet. We will automatically detect
                your columns like "Staff Name", "Email AD", and "Position".
              </p>
              <button
                onClick={handleDownloadTemplate}
                className="bg-white text-blue-700 font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 hover:bg-blue-100 transition-colors border border-blue-200"
              >
                <Download className="w-4 h-4" /> Download Standard Template
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 border-dashed text-center">
            <div className="w-12 h-12 bg-slate-50 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Select Excel File</h3>
            <p className="text-xs text-slate-500 mb-4">.xlsx, .xls, or .csv</p>
            <label className="block w-full bg-slate-900 text-white font-bold py-3 rounded-xl cursor-pointer hover:bg-slate-800">
              Browse Files
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </>
      )}

      {/* STEP 2: MAPPING */}
      {step === "mapping" && mapping && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Map Columns</h2>
          {Object.keys(mapping).map((key) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-sm font-bold text-slate-700 capitalize">
                {key === "position"
                  ? "Role / Job Title"
                  : key.replace(/([A-Z])/g, " $1")}
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

      {/* STEP 3: CHECK */}
      {step === "check" && (
        <>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  {parsedTeachers.length} staff
                </h2>
                <p className="text-xs text-slate-500">found in file</p>
              </div>
            </div>
          </div>

          {duplicateRowNumbers.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
              <h3 className="text-sm font-bold text-orange-800 flex items-center gap-2">
                <Copy className="w-4 h-4" /> Duplicates Detected ({parsedTeachers.filter(t => t._isDuplicate).length})
              </h3>
              <p className="text-xs text-orange-700 mt-1 mb-3">
                These emails already exist in the system or are repeated in this file. Edit the email to make it unique. Unresolved rows will be skipped.
              </p>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {duplicateRowNumbers.map((rowNum) => {
                  const actualIndex = parsedTeachers.findIndex(p => p._rowNumber === rowNum);
                  if (actualIndex === -1) return null;
                  const t = parsedTeachers[actualIndex];
                  const isResolved = !t._isDuplicate;

                  return (
                    <div key={t._rowNumber} className={`bg-white p-3 rounded-xl border ${isResolved ? 'border-green-300' : 'border-orange-100'} flex flex-col gap-2`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Row {t._rowNumber}</span>
                        {isResolved ? (
                          <span className="text-[10px] text-green-600 font-bold">✓ Resolved</span>
                        ) : (
                          <span className="text-[10px] text-orange-600 font-bold">{t._duplicateReason}</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={t.teacherName}
                          disabled
                          className="p-2 text-sm border border-slate-200 bg-slate-50 text-slate-500 rounded-lg outline-none"
                        />
                        <input
                          type="email"
                          value={t.email}
                          onChange={(e) => handleEditDuplicate(actualIndex, e.target.value)}
                          onBlur={() => handleValidateEmail(actualIndex)}
                          className={`p-2 text-sm border ${isResolved ? 'border-green-300 text-green-900' : 'border-orange-300 text-orange-900'} rounded-lg focus:ring-2 focus:ring-blue-500 outline-none`}
                          placeholder="Fix email address"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={
              isImporting || parsedTeachers.length - duplicateCount === 0
            }
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Importing...
              </>
            ) : (
              `Import ${parsedTeachers.length - duplicateCount} Teachers`
            )}
          </button>
        </>
      )}

      {/* STEP 4: DONE */}
      {step === "done" && results && (
        <div className="text-center py-10">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-900 mb-2">Import Complete!</h2>
          
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mt-6 max-w-sm mx-auto text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Inserted</span>
              <span className="font-bold text-green-600">{results.inserted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Skipped</span>
              <span className="font-bold text-red-600">{results.skipped}</span>
            </div>
          </div>

          {/* 🚨 NEW: SHOW SKIPPED DETAILS */}
          {results.skippedDetails && results.skippedDetails.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mt-4 max-w-sm mx-auto text-left">
              <h3 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Skipped Records
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {results.skippedDetails.map((item: any, idx: number) => (
                  <div key={idx} className="bg-white p-2 rounded border border-red-100 text-xs">
                    <p className="font-bold text-slate-800">{item.name}</p>
                    <p className="text-red-600 mt-0.5">{item.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={onSuccess} className="mt-6 bg-blue-600 text-white font-bold px-8 py-3 rounded-xl">
            Back to Teachers
          </button>
        </div>
      )}
    </div>
  );
}
