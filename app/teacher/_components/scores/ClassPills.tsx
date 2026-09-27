"use client";

import type { ClassInfo } from "../../_lib/types";

export function ClassPills({
  classes,
  selectedId,
  onSelect,
}: {
  classes: ClassInfo[];
  selectedId: string | null;
  onSelect: (cls: ClassInfo) => void;
}) {
  if (classes.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
      {classes.map((cls) => (
        <button
          key={cls.id}
          onClick={() => onSelect(cls)}
          className={`flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-semibold transition ${
            selectedId === cls.id
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-700"
          }`}
        >
          {cls.name}
        </button>
      ))}
    </div>
  );
}