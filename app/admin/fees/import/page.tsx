"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentTerm } from "@/hooks/useCurrentTerm";
import { importFamilies, ImportRow } from "../actions";
import { toast } from "sonner";
import { ArrowLeft, Upload, Loader2, CheckCircle2, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";


export default function ImportPage() {
  const router = useRouter();
  const { term } = useCurrentTerm();
  
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Parse the file client-side
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !term?.id) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Convert to JSON
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        if (rawData.length < 2) {
          toast.error("The file appears to be empty.");
          return;
        }

        // --- COLUMN MAPPING LOGIC ---
        // This assumes a standard format. You may need to adjust the indices based on the actual Excel headers.
        // Example Excel Structure:
        // [0]: Family Name, [1]: Guardian Name, [2]: Phone, [3]: Children, [4]: Total Due, [5]: Total Paid
        
        const headers = rawData[0];
        const rows = rawData.slice(1);

        const parsedRows: ImportRow[] = rows.map((row) => ({
          familyName: String(row[0] || "").trim(),
          guardianName: String(row[1] || "").trim(),
          guardianPhone: String(row[2] || "").trim(),
          children: String(row[3] || "").trim(),
          totalDue: Number(row[4]) || 0,
          totalPaid: Number(row[5]) || 0,
        })).filter(r => r.familyName !== ""); // Filter out empty rows

        setParsedData(parsedRows);
        toast.success(`Parsed ${parsedRows.length} families successfully.`);
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse the file. Please check the format.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!term?.id || parsedData.length === 0) return;
    setIsImporting(true);
    
    try {
      const res = await importFamilies(parsedData, term.id);
      if (res.success) {
        toast.success(`Successfully imported ${res.importedCount} families!`);
        router.push("/admin/fees");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to import data");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 w-full">
      <main className="max-w-lg mx-auto p-4 pb-24">
        
        <header className="flex items-center gap-2 mb-6">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-lg hover:bg-slate-200 transition">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Import Fees</h1>
            <p className="text-sm text-slate-500">Upload your Excel spreadsheet</p>
          </div>
        </header>

        {/* Upload Zone */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 border-dashed text-center mb-6">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 mb-1">Select Excel File</h3>
          <p className="text-xs text-slate-500 mb-4">Accepts .xlsx, .xls, or .csv</p>
          
          <label className="block w-full bg-blue-600 text-white font-bold py-3 rounded-xl cursor-pointer hover:bg-blue-700 transition">
            Browse Files
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
              onChange={handleFileUpload} 
            />
          </label>
          {fileName && <p className="text-xs text-blue-600 font-medium mt-3">Selected: {fileName}</p>}
        </div>

        {/* Preview Data */}
        {parsedData.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Preview ({parsedData.length} families)</h3>
              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">Verify Data</span>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
              {parsedData.map((row, idx) => (
                <div key={idx} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{row.familyName}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{row.children || "No children listed"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-red-500 font-medium">Due: ₦{row.totalDue.toLocaleString()}</p>
                    <p className="text-xs text-green-600 font-bold">Paid: ₦{row.totalPaid.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleImport}
              disabled={isImporting}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isImporting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Importing...</>
              ) : (
                <>Confirm & Import {parsedData.length} Families</>
              )}
            </button>
          </div>
        )}

      </main>
    </div>
  );
}