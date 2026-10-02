"use client";

import type { Summary } from "../_lib/types";

export function SummaryStrip({
  summary,
  studentPosition,
  classSize,
}: {
  summary: Summary;
  studentPosition: number | null;
  classSize: number | null;
}) {
  const positionText =
    studentPosition != null && classSize != null
      ? `${studentPosition} / ${classSize}`
      : "—";

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="bg-white rounded-2xl border border-slate-200 py-3 text-center">
        <p className="text-xl font-bold text-blue-600">{summary.termAvg}</p>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
          Term Avg
        </p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 py-3 text-center">
        <p className="text-xl font-bold text-slate-800">{positionText}</p>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
          Position
        </p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 py-3 text-center">
        <p className="text-xl font-bold text-emerald-600">
          {summary.finalGrade}
        </p>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
          Grade
        </p>
      </div>
    </div>
  );
}