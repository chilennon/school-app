"use client";

import type { TermInfo } from "../../_lib/types";

export function TermTabs({
  terms,
  selectedId,
  onSelect,
  currentTermId, // 🚨 ADD THIS
}: {
  terms: TermInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentTermId?: string | null; // 🚨 ADD THIS
}) {
  return (
    <div className="flex border-b border-slate-200 bg-white rounded-t-xl">
      {terms.map((term) => {
        const isActive = term.id === selectedId;
        // 🚨 Check if this term is the current one set by admin
        const isCurrent = term.id === currentTermId || term.is_current;

        return (
          <button
            key={term.id}
            onClick={() => onSelect(term.id)}
            // 🚨 DISABLE if it's not the current term
            disabled={!isCurrent}
            className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${
              isActive
                ? "border-blue-600 text-blue-600"
                : isCurrent
                ? "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                : "border-transparent text-slate-300 cursor-not-allowed"
            }`}
          >
            {term.name}
          </button>
        );
      })}
    </div>
  );
}