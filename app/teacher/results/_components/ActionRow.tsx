"use client";

import { Download, Trash2 } from "lucide-react";

export function ActionRow({
  readOnly,
  onExport,
  onClearAll,
}: {
  readOnly: boolean;
  onExport: () => void;
  onClearAll?: () => void;
}) {
  return (
    <div className="flex justify-end items-center gap-1 mb-3">
      {!readOnly && onClearAll && (
        <button
          onClick={onClearAll}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-red-600 active:bg-red-50 rounded-md px-2 py-1.5"
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </button>
      )}
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