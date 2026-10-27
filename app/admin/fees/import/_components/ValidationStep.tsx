"use client";

import { useMemo } from "react";
import { ParsedRow, FeeModel } from "../_lib/types";
import { AlertCircle, CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";

type Props = {
  rows: ParsedRow[];
  feeModel: FeeModel;
  onUpdateRow: (index: number, updates: Partial<ParsedRow>) => void;
  onConfirm: () => void;
  onBack: () => void;
  isImporting: boolean;
};

export function ValidationStep({
  rows,
  feeModel,
  onUpdateRow,
  onConfirm,
  onBack,
  isImporting,
}: Props) {
  // Determine which rows are valid
  const validatedRows = useMemo(() => {
    return rows.map((row) => {
      const errors: string[] = [];
      // The only hard requirement right now is a name.
      // If per-student, the "familyName" field actually holds the student name.
      if (!row.familyName || row.familyName.trim() === "") {
        errors.push("Name is required");
      }
      return { ...row, _errors: errors, _isValid: errors.length === 0 };
    });
  }, [rows]);

  const validCount = validatedRows.filter((r) => r._isValid).length;
  const errorCount = validatedRows.length - validCount;
  const hasErrors = errorCount > 0;

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
        <p className="text-sm text-slate-500 mt-1">
          {hasErrors
            ? `We found ${errorCount} row${errorCount === 1 ? "" : "s"} that need your attention. Please fill in the missing data below.`
            : "Everything looks perfect. Ready to import."}
        </p>
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
              <th className="px-4 py-3 font-bold text-slate-900 text-right">Paid (₦)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {validatedRows.map((row, idx) => (
              <tr
                key={row._rowNumber}
                className={!row._isValid ? "bg-red-50/50" : "hover:bg-slate-50 transition-colors"}
              >
                <td className="px-4 py-2 text-xs font-medium text-slate-400">
                  {row._rowNumber}
                </td>
                
                {/* EDITABLE NAME CELL */}
                <td className="px-4 py-2 min-w-[200px]">
                  <input
                    type="text"
                    value={row.familyName}
                    onChange={(e) => onUpdateRow(idx, { familyName: e.target.value })}
                    className={`w-full p-2 rounded-lg border text-sm font-medium transition-all ${
                      !row._isValid
                        ? "border-red-300 bg-white text-red-900 focus:ring-2 focus:ring-red-500 outline-none placeholder-red-300"
                        : "border-transparent bg-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 outline-none"
                    }`}
                    placeholder={!row._isValid ? "Type name here..." : ""}
                  />
                </td>

                <td className="px-4 py-2 text-xs">
                  {row.guardianPhone || <span className="text-slate-300 italic">—</span>}
                </td>
                <td className="px-4 py-2 text-right font-medium text-red-600">
                  {row.totalDue > 0 ? row.totalDue.toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2 text-right font-bold text-green-600">
                  {row.totalPaid > 0 ? row.totalPaid.toLocaleString() : "—"}
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
          disabled={isImporting || hasErrors || validCount === 0}
          className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isImporting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Importing...
            </>
          ) : hasErrors ? (
            `Fix ${errorCount} row${errorCount === 1 ? "" : "s"} to continue`
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" /> Confirm & Import {validCount} {feeModel === "family" ? "Families" : "Students"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}