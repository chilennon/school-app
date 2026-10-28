"use client";

import { useMemo } from "react";
import { ParsedRow, FeeModel } from "../_lib/types";
import { AlertTriangle, CheckCircle2, ArrowLeft, Loader2, Copy } from "lucide-react";

// Add onUpdateRow to props
export function ValidationStep({
  rows,
  feeModel,
  onUpdateRow, 
  onConfirm,
  onBack,
  isImporting,
}: {
  rows: ParsedRow[];
  feeModel: FeeModel;
  onUpdateRow: (index: number, updates: Partial<ParsedRow>) => void;
  onConfirm: () => void;
  onBack: () => void;
  isImporting: boolean;
}) {
  
  // Calculate which rows are valid, duplicates, or errors
  const validatedRows = useMemo(() => {
    return rows.map((row) => {
      const errors: string[] = [];
      
      if (!row.familyName || row.familyName.trim() === "") {
        errors.push("Name is required");
      }

      // Only block on errors. Duplicates are warnings.
      return { 
        ...row, 
        _errors: errors, 
        _isValid: errors.length === 0 
      };
    });
  }, [rows]);

  const errorCount = validatedRows.filter((r) => !r._isValid).length;
  const duplicateCount = validatedRows.filter((r) => r._isDuplicate && r._isValid).length;
  const hasErrors = errorCount > 0;

  // If they edit the row, we should clear the duplicate flag locally in the UI
  const handleEditName = (idx: number, val: string) => {
    onUpdateRow(idx, { familyName: val, _isDuplicate: false, _duplicateReason: "" });
  };
  const handleEditPhone = (idx: number, val: string) => {
    onUpdateRow(idx, { guardianPhone: val, _isDuplicate: false, _duplicateReason: "" });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
      {/* HEADER */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          Review Data
          <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-1 rounded-full">
            {rows.length} rows found
          </span>
        </h2>
        
        {hasErrors && (
          <p className="text-sm text-red-500 mt-1">We found {errorCount} rows with errors that must be fixed.</p>
        )}
        {duplicateCount > 0 && (
          <p className="text-sm text-orange-500 mt-1">
            We found {duplicateCount} possible duplicates. Edit them below to keep them, or they will be skipped.
          </p>
        )}
        {!hasErrors && duplicateCount === 0 && (
          <p className="text-sm text-slate-500 mt-1">Everything looks perfect. Ready to import.</p>
        )}
      </div>

      {/* EDITABLE TABLE */}
      <div className="overflow-y-auto flex-1 p-0">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 font-bold text-slate-900 w-12">Row</th>
              <th className="px-4 py-3 font-bold text-slate-900">
                {feeModel === "family" ? "Family Name" : "Student Name"}
              </th>
              <th className="px-4 py-3 font-bold text-slate-900">Phone</th>
              <th className="px-4 py-3 font-bold text-slate-900 text-right">Due (₦)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {validatedRows.map((row, idx) => (
              <tr
                key={row._rowNumber}
                className={
                  !row._isValid 
                    ? "bg-red-50/50" 
                    : row._isDuplicate 
                    ? "bg-orange-50/50" 
                    : "hover:bg-slate-50 transition-colors"
                }
              >
                <td className="px-4 py-2 text-xs font-medium text-slate-400">
                  {row._rowNumber}
                </td>
                
                {/* EDITABLE NAME CELL */}
                <td className="px-4 py-2 min-w-[200px]">
                  <input
                    type="text"
                    value={row.familyName}
                    onChange={(e) => handleEditName(idx, e.target.value)}
                    className={`w-full p-2 rounded-lg border text-sm font-medium transition-all ${
                      !row._isValid
                        ? "border-red-300 bg-white text-red-900 focus:ring-2 focus:ring-red-500 outline-none"
                        : row._isDuplicate
                        ? "border-orange-300 bg-white text-orange-900 focus:ring-2 focus:ring-orange-500 outline-none"
                        : "border-transparent bg-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 outline-none"
                    }`}
                    placeholder={!row._isValid ? "Required" : ""}
                  />
                  {row._isDuplicate && (
                    <p className="text-[10px] text-orange-600 font-bold mt-1 flex items-center gap-1">
                      <Copy className="w-3 h-3" /> {row._duplicateReason}
                    </p>
                  )}
                </td>

                {/* EDITABLE PHONE CELL */}
                <td className="px-4 py-2">
                   <input
                    type="text"
                    value={row.guardianPhone}
                    onChange={(e) => handleEditPhone(idx, e.target.value)}
                    className={`w-full p-2 rounded-lg border text-sm transition-all ${
                      row._isDuplicate
                        ? "border-orange-300 bg-white text-orange-900 focus:ring-2 focus:ring-orange-500 outline-none"
                        : "border-transparent bg-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 outline-none"
                    }`}
                    placeholder="—"
                  />
                </td>

                <td className="px-4 py-2 text-right font-medium text-red-600">
                  {row.totalDue > 0 ? row.totalDue.toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3">
        <button
          onClick={onBack}
          disabled={isImporting}
          className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        
        <button
          onClick={onConfirm}
          disabled={isImporting || hasErrors}
          className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isImporting ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Importing...</>
          ) : hasErrors ? (
            `Fix ${errorCount} row${errorCount === 1 ? "" : "s"} to continue`
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" /> Confirm & Import {validatedRows.filter(r => r._isValid).length} Rows
            </>
          )}
        </button>
      </div>
    </div>
  );
}