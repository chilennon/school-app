"use client";

import type { TermInfo } from "../../_lib/types";

export function TermTabs({
  terms,
  selectedId,
  onSelect,
}: {
  terms: TermInfo[];
  selectedId: string | null;
  onSelect: (termId: string) => void;
}) {
  if (terms.length === 0) return null;
  return (
    <div className="flex border-b border-slate-200">
      {terms.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 -mb-px transition ${
            selectedId === t.id
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500"
          }`}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}