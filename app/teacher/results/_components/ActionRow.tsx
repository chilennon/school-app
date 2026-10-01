"use client";

import { Download } from "lucide-react";

export function ActionRow({
  readOnly, onExport,
}: {
  readOnly: boolean;
  onExport: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
          Result Compiler
        </p>
      </div>
      <button
        onClick={onExport}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 active:bg-slate-100 rounded-md px-2 py-1.5"
      >
        <Download className="h-4 w-4" />
        Export PDF
      </button>
    </div>
  );
}