"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

export function CumulativeCard({
  termAverages,
  cumulativeAverage,
}: {
  termAverages: Record<string, number>;
  cumulativeAverage: number | null;
}) {
  const [open, setOpen] = useState(false);
  const hasData =
    Object.keys(termAverages).length > 1 || cumulativeAverage != null;

  if (!hasData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
        <p className="text-xs text-slate-500">
          Cumulative average appears after the second term.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50"
      >
        <span className="font-semibold text-slate-800 text-sm">
          View cumulative average
        </span>
        <ChevronRight
          className={`w-4 h-4 text-slate-400 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3 grid grid-cols-2 gap-3">
          {(["First", "Second", "Third"] as const).map((t) => (
            <div key={t}>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                {t} Term
              </p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">
                {termAverages[t] != null
                  ? termAverages[t].toFixed(1) + "%"
                  : "—"}
              </p>
            </div>
          ))}
          <div className="col-span-2 border-t border-slate-100 pt-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Cumulative
            </p>
            <p className="text-lg font-bold text-blue-600 mt-0.5">
              {cumulativeAverage != null
                ? cumulativeAverage.toFixed(1) + "%"
                : "—"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}