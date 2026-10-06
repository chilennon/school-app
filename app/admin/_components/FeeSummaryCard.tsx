"use client";

import { ChevronRight } from "lucide-react";

export interface FeeSummary {
  termLabel: string;             // e.g. "First Term"
  collected: number;             // ₦ amount collected
  expected: number;              // ₦ amount expected
  outstandingStudents: number;   // count of students with balance > 0
}

function formatNaira(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}k`;
  return `₦${n}`;
}

export function FeeSummaryCard({
  feeSummary,
  onOpen,
}: {
  feeSummary: FeeSummary;
  onOpen: () => void;
}) {
  const pct =
    feeSummary.expected > 0
      ? Math.min(100, (feeSummary.collected / feeSummary.expected) * 100)
      : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {feeSummary.termLabel} fees
      </p>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-blue-600">
          {formatNaira(feeSummary.collected)}
        </span>
        <span className="text-sm text-slate-500">
          of {formatNaira(feeSummary.expected)} expected
        </span>
      </div>

      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {feeSummary.outstandingStudents > 0 && (
        <button
          onClick={onOpen}
          className="w-full flex items-center justify-between pt-2 text-left active:opacity-70"
        >
          <span className="text-sm font-semibold text-amber-800">
            {feeSummary.outstandingStudents} student
            {feeSummary.outstandingStudents === 1 ? "" : "s"} have outstanding
            balances
          </span>
          <ChevronRight className="w-4 h-4 text-amber-700" />
        </button>
      )}
    </div>
  );
}