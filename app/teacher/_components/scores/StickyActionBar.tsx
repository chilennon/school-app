"use client";

import { Printer } from "lucide-react";
import type { ClassStatus } from "../../_lib/types";

export function StickyActionBar({
  classStatus,
  termName,
  submitting,
  onBatchPrint,
  onSubmit,
  onReopen,
}: {
  classStatus: ClassStatus;
  termName: string;
  submitting: boolean;
  onBatchPrint: () => void;
  onSubmit: () => void;
  onReopen: () => void;
}) {
  return (
    <div className="fixed left-0 right-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 px-4 pointer-events-none">
      <div className="max-w-lg mx-auto flex gap-2 pointer-events-auto">
        <button
          onClick={onBatchPrint}
          className="flex items-center justify-center gap-2 px-4 py-3.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-2xl shadow-sm active:bg-slate-50"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>

        {(classStatus === "draft" || classStatus === "mixed") && (
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="flex-1 py-3.5 bg-blue-600 disabled:bg-blue-400 text-white font-bold rounded-2xl shadow-sm active:bg-blue-700"
          >
            {submitting ? "Submitting…" : `Submit ${termName}`}
          </button>
        )}

        {classStatus === "submitted" && (
          <button
            onClick={onReopen}
            disabled={submitting}
            className="flex-1 py-3.5 bg-slate-100 disabled:bg-slate-50 text-slate-700 font-bold rounded-2xl shadow-sm active:bg-slate-200"
          >
            {submitting ? "Reopening…" : "Reopen for Edits"}
          </button>
        )}

        {classStatus === "approved" && (
          <div className="flex-1 py-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-2xl text-center text-sm">
            ✓ Approved — locked
          </div>
        )}
      </div>
    </div>
  );
}