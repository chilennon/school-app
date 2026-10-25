"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentTerm } from "@/hooks/useCurrentTerm";
import { importFamilies } from "../actions";
import { toast } from "sonner";
import { ArrowLeft, Upload, Loader2, Download, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// 1. Define the strict schema
const EXPECTED_HEADERS = [
  "Family Name",
  "Guardian Name",
  "Guardian Phone",
  "Children",
  "Total Due",
  "Total Paid",
];

// Extended type to hold UI state
type ParsedRow = {
  _rowNumber: number;
  _isValid: boolean;
  familyName: string;
  guardianName: string;
  guardianPhone: string;
  children: string;
  totalDue: number;
  totalPaid: number;
};

export default function ImportPage() {
  const router = useRouter();
  const { term } = useCurrentTerm();
  
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // --- 1. TEMPLATE DOWNLOAD ---
  const handleDownloadTemplate = () => {
    const dummyRow = [
      "Adeyemi Family",
      "Mr. Tunde Adeyemi",
      "08031234567",
      "Tobi (Basic 4), Sola (KG 2)",
      300000,
      100000
    ];
    
    const ws = XLSX.utils.aoa_to_sheet([EXPECTED_HEADERS, dummyRow]);
    
    // Set column widths for a nice looking template
    ws["!cols"] = [
      { wch: 20 }, // Family Name
      { wch: 25 }, // Guardian Name
      { wch: 15 }, // Guardian Phone
      { wch: 35 }, // Children
      { wch: 15 }, // Total Due
      { wch: 15 }, // Total Paid
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fees Import Template");
    XLSX.writeFile(wb, "Fees_Import_Template.xlsx");
  };

  // --- 2. HEADER & ROW VALIDATION ---
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
        
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        if (rawData.length < 2) {
          toast.error("The file appears to be empty.");
          return;
        }

        // 3. STRICT HEADER VALIDATION
        const rawHeaders = rawData[0].map((h: any) => String(h || "").trim());
        
        // Check if lengths match and every header is in the exact right position
        const isValidHeaders = 
          rawHeaders.length === EXPECTED_HEADERS.length &&
          EXPECTED_HEADERS.every((expected, index) => 
            rawHeaders[index].toLowerCase() === expected.toLowerCase()
          );

        if (!isValidHeaders) {
          toast.error("Invalid file structure. Please download the official template and try again.");
          setFileName("");
          // Reset the file input so they can try again
          e.target.value = "";
          return;
        }

        // 4. ROW-LEVEL VALIDATION
        const rows = rawData.slice(1);
        let skippedCount = 0;

        const parsedRows: ParsedRow[] = rows.map((row, index) => {
          const familyName = String(row[0] || "").trim();
          const isValid = familyName !== ""; // A row MUST have a family name
          
          if (!isValid) skippedCount++;

          return {
            _rowNumber: index + 2, // +2 because of 0-indexing and the header row
            _isValid: isValid,
            familyName: familyName,
            guardianName: String(row[1] || "").trim(),
            guardianPhone: String(row[2] || "").trim(),
            children: String(row[3] || "").trim(),
            totalDue: Number(row[4]) || 0,
            totalPaid: Number(row[5]) || 0,
          };
        });

        setParsedData(parsedRows);
        
        if (skippedCount > 0) {
          toast.warning(`Parsed ${parsedRows.length} rows. ${skippedCount} rows are missing a Family Name and will be skipped.`);
        } else {
          toast.success(`Parsed ${parsedRows.length} families successfully.`);
        }

      } catch (err) {
        console.error(err);
        toast.error("Failed to parse the file. Please check the format.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!term?.id || parsedData.length === 0) return;

    // Filter out invalid rows before sending to server
    const validRows = parsedData.filter(r => r._isValid);
    
    if (validRows.length === 0) {
      toast.error("No valid rows to import.");
      return;
    }

    if (!navigator.onLine) {
      toast.error("Excel import requires an internet connection.");
      return;
    }

    setIsImporting(true);
    
    try {
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

  const handleBackOrCancel = () => {
    if (parsedData.length > 0) {
      setShowCancelConfirm(true);
    } else {
      router.back();
    }
  };

  const confirmCancel = () => {
    setParsedData([]);
    setFileName("");
    setShowCancelConfirm(false);
    router.push("/admin?tab=fees");
  };

  const validRowsCount = parsedData.filter(r => r._isValid).length;

  return (
    <div className="min-h-screen bg-slate-50 w-full">
      <main className="max-w-lg mx-auto p-4 pb-24">
        
        <header className="flex items-center gap-2 mb-6">
          <button onClick={handleBackOrCancel} className="p-2 -ml-2 rounded-lg hover:bg-slate-200 transition">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">Import Fees</h1>
            <p className="text-sm text-slate-500">Upload your Excel spreadsheet</p>
          </div>
        </header>

        {/* TEMPLATE DOWNLOAD BUTTON */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-1">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-blue-900 mb-1">Need the correct format?</h3>
            <p className="text-xs text-blue-700 mb-3">Download our official template to ensure your data imports perfectly.</p>
            <button 
              onClick={handleDownloadTemplate}
              className="bg-blue-600 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" /> Download Template
            </button>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 border-dashed text-center mb-6">
          <div className="w-12 h-12 bg-slate-50 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 mb-1">Select Excel File</h3>
          <p className="text-xs text-slate-500 mb-4">Accepts .xlsx, .xls, or .csv</p>
          
          <label className="block w-full bg-slate-900 text-white font-bold py-3 rounded-xl cursor-pointer hover:bg-slate-800 transition">
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
              <h3 className="font-bold text-slate-900">Preview ({parsedData.length} rows)</h3>
              <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-1 rounded">Verify Data</span>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
              {parsedData.map((row, idx) => (
                <div key={idx} className={`p-4 flex justify-between items-center ${!row._isValid ? 'bg-red-50' : ''}`}>
                  <div>
                    <p className={`font-bold text-sm ${row._isValid ? 'text-slate-900' : 'text-red-700'}`}>
                      {row.familyName || "— Missing Family Name —"}
                    </p>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{row.children || "No children listed"}</p>
                    {!row._isValid && (
                      <p className="text-[10px] font-bold text-red-600 mt-1 uppercase tracking-wider">
                        Row {row._rowNumber} · Will be skipped
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-red-500 font-medium">Due: ₦{row.totalDue.toLocaleString()}</p>
                    <p className="text-xs text-green-600 font-bold">Paid: ₦{row.totalPaid.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <button
                onClick={handleImport}
                disabled={isImporting || validRowsCount === 0}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isImporting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Importing...</>
                ) : (
                  <>Confirm & Import {validRowsCount} Families</>
                )}
              </button>
              
              <button
                onClick={handleBackOrCancel}
                disabled={isImporting}
                className="w-full bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl hover:bg-slate-300 transition-colors disabled:opacity-50"
              >
                Cancel Import
              </button>
            </div>
          </div>
        )}

      </main>

      <ConfirmDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        title="Cancel Import?"
        description="Your uploaded file will be discarded and no families will be imported. Are you sure?"
        confirmLabel="Yes, cancel"
        destructive={true}
        onConfirm={confirmCancel}
      />
    </div>
  );
}