"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentTerm } from "@/hooks/useCurrentTerm";
import { importFamilies } from "../actions";
import { toast } from "sonner";
import { ArrowLeft, Upload, Loader2, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { supabase } from "@/lib/supabaseClient";

// Our new modular architecture
import { RawRow, ParsedRow, MappingConfig, FeeModel } from "./_lib/types";
import { autoMapHeaders, parseRows } from "./_lib/parser";
import { MappingStep } from "./_components/MappingStep";
import { ValidationStep } from "./_components/ValidationStep";

type Step = "upload" | "mapping" | "validation";

export default function ImportPage() {
  const router = useRouter();
  const { term } = useCurrentTerm();

  // 🚨 NEW: Fetch existing families to detect duplicates
  const [existingFamilies, setExistingFamilies] = useState<{ name: string; phone: string | null; phone2: string | null }[]>([]);

  useEffect(() => {
    supabase
      .from("families")
      .select("name, phone_normalized, phone_normalized_2")
      .is("deleted_at", null)
      .then(({ data }) => {
        if (data) {
          setExistingFamilies(data.map(f => ({
            name: f.name,
            phone: f.phone_normalized,
            phone2: f.phone_normalized_2
          })));
        }
      });
  }, []);

  // State Machine
  const [step, setStep] = useState<Step>("upload");
  const [isImporting, setIsImporting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Data State
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<MappingConfig | null>(null);
  const [feeModel, setFeeModel] = useState<FeeModel>("family");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  // --- 1. TEMPLATE DOWNLOAD ---
  const handleDownloadTemplate = () => {
    const dummyRow = [
      "Adeyemi Family", "Mr. Tunde Adeyemi", "08031234567", 
      "Tobi (Basic 4), Sola (KG 2)", 300000, 100000
    ];
    const ws = XLSX.utils.aoa_to_sheet([
      ["Family Name", "Guardian Name", "Guardian Phone", "Children", "Total Due", "Total Paid"], 
      dummyRow
    ]);
    ws["!cols"] = [{ wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 35 }, { wch: 15 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fees Import Template");
    XLSX.writeFile(wb, "Fees_Import_Template.xlsx");
  };

  // --- 2. FILE UPLOAD & PARSE TO RAW ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !term?.id) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
        
        if (rawData.length < 2) {
          toast.error("The file appears to be empty.");
          setFileName("");
          return;
        }

        const rawHeaders = rawData[0].map((h: any) => String(h).trim()).filter(Boolean);
        
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

      } catch (err) {
        console.error(err);
        toast.error("Failed to parse the file. Please check the format.");
        setFileName("");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- 3. MAPPING CONFIRMATION ---
  const handleMappingConfirm = (confirmedMapping: MappingConfig, confirmedModel: FeeModel) => {
    setMapping(confirmedMapping);
    setFeeModel(confirmedModel);

    // 🚨 Pass existingFamilies into the parser
    const parsed = parseRows(rawRows, confirmedMapping, confirmedModel, existingFamilies);
    setParsedRows(parsed);
    
    setStep("validation");
  };

  // --- 4. INLINE ROW UPDATES (From ValidationStep) ---
  const handleUpdateRow = (index: number, updates: Partial<ParsedRow>) => {
    setParsedRows((prev) => {
      const newRows = [...prev];
      newRows[index] = { ...newRows[index], ...updates };
      return newRows;
    });
  };

  // --- 5. FINAL IMPORT ---
  const handleFinalImport = async () => {
    if (!term?.id || parsedRows.length === 0) return;

    if (!navigator.onLine) {
      toast.error("Excel import requires an internet connection.");
      return;
    }

    setIsImporting(true);
    
    try {
      // Filter out any rows that somehow still have errors
      const validRows = parsedRows.filter(r => r.familyName.trim().length > 0);
      
      if (validRows.length === 0) {
        toast.error("No valid rows to import.");
        return;
      }

      // Call the Server Action
      const res = await importFamilies(validRows, term.id);

      if (res.success) {
        if (res.skipped > 0) {
          toast.success(`Imported ${res.inserted} families. ${res.skipped} duplicates skipped.`);
        } else {
          toast.success(`Successfully imported all ${res.inserted} families!`);
        }
        router.push("/admin?tab=fees");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to import data");
    } finally {
      setIsImporting(false);
    }
  };

  // --- 6. CANCEL / RESET ---
  const handleBackOrCancel = () => {
    if (step !== "upload") {
      setShowCancelConfirm(true);
    } else {
      router.back();
    }
  };

  const confirmCancel = () => {
    setShowCancelConfirm(false);
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setParsedRows([]);
    router.push("/admin?tab=fees");
  };

  return (
    <div className="min-h-screen bg-slate-50 w-full">
      <main className="max-w-2xl mx-auto p-4 pb-24">
        
        {/* HEADER */}
        <header className="flex items-center gap-2 mb-6">
          <button 
            onClick={handleBackOrCancel} 
            className="p-2 -ml-2 rounded-lg hover:bg-slate-200 transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">
              {step === "upload" && "Import Fees"}
              {step === "mapping" && "Map Your Columns"}
              {step === "validation" && "Validate Data"}
            </h1>
            <p className="text-sm text-slate-500">
              {step === "upload" && "Upload your Excel spreadsheet"}
              {step === "mapping" && fileName}
              {step === "validation" && `Reviewing ${parsedRows.length} rows from ${fileName}`}
            </p>
          </div>
        </header>

        {/* STEP 1: UPLOAD */}
        {step === "upload" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-1">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-blue-900 mb-1">Bring your own format</h3>
                <p className="text-xs text-blue-700 mb-3">
                  Upload your existing spreadsheet. We will automatically detect your columns and clean the data.
                </p>
                <button 
                  onClick={handleDownloadTemplate}
                  className="bg-white text-blue-700 font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 hover:bg-blue-100 transition-colors border border-blue-200"
                >
                  <Download className="w-4 h-4" /> Download Standard Template
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-slate-200 border-dashed text-center">
              <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1 text-lg">Select Excel File</h3>
              <p className="text-sm text-slate-500 mb-6">Accepts .xlsx, .xls, or .csv</p>
              
              <label className="block w-full bg-slate-900 text-white font-bold py-4 rounded-xl cursor-pointer hover:bg-slate-800 transition">
                Browse Files
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                />
              </label>
            </div>
          </div>
        )}

        {/* STEP 2: MAPPING */}
        {step === "mapping" && mapping && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <MappingStep
              headers={headers}
              initialMapping={mapping}
              onConfirm={handleMappingConfirm}
              onCancel={() => setStep("upload")}
            />
          </div>
        )}

        {/* STEP 3: VALIDATION */}
        {step === "validation" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <ValidationStep
              rows={parsedRows}
              feeModel={feeModel}
              onUpdateRow={handleUpdateRow}
              onConfirm={handleFinalImport}
              onBack={() => setStep("mapping")}
              isImporting={isImporting}
            />
          </div>
        )}

      </main>

      <ConfirmDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        title="Cancel Import?"
        description="Your progress will be lost and no data will be imported."
        confirmLabel="Yes, cancel"
        destructive={true}
        onConfirm={confirmCancel}
      />
    </div>
  );
}