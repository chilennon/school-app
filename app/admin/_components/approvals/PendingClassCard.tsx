"use client";

import type { PendingClass } from "../../_lib/types";

export function PendingClassCard({
  item,
  onOpen,
}: {
  item: PendingClass;
  onOpen: () => void;
}) {
  return (
    <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
      <div>
        <p className="font-bold text-slate-900">{item.className}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {item.sessionName} · {item.termLabel}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {item.submittedCount > 0 && (
          <span className="bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-2.5 py-1 font-semibold">
            {item.submittedCount} awaiting
          </span>
        )}
        {item.approvedCount > 0 && (
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-2.5 py-1 font-semibold">
            {item.approvedCount} approved
          </span>
        )}
        <span className="text-slate-500 py-1">
          {item.totalStudents} student{item.totalStudents !== 1 ? "s" : ""}
        </span>
      </div>
      <button
        onClick={onOpen}
        className="w-full py-3 bg-blue-600 active:bg-blue-700 text-white font-bold rounded-xl text-sm"
      >
        Review Results
      </button>
    </div>
  );
}