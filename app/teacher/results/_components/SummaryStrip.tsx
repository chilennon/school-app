"use client";

import { cn } from "@/lib/utils";
import { cardCls } from "../_lib/ui";
import type { Summary } from "../_lib/types";

function Stat({ label, value, tone }: {
  label: string; value: React.ReactNode; tone?: "pass" | "fail";
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn(
        "text-base font-bold mt-0.5",
        tone === "pass" && "text-emerald-600",
        tone === "fail" && "text-red-500",
        !tone && "text-slate-900",
      )}>
        {value}
      </p>
    </div>
  );
}

export function SummaryStrip({
  summary, studentPosition, classSize,
}: {
  summary: Summary;
  studentPosition: number | null;
  classSize: number | null;
}) {
  return (
    <div className={cn(cardCls, "grid grid-cols-3 md:grid-cols-7 gap-3 mt-3")}>
      <Stat label="Subjects"   value={summary.count} />
      <Stat label="Term Avg"   value={summary.termAvg} />
      <Stat label="Final Avg"  value={summary.finalAvg} />
      <Stat label="Position"   value={`${studentPosition ?? "—"}/${classSize ?? "—"}`} />
      <Stat label="Highest"    value={summary.highest} tone="pass" />
      <Stat label="Lowest"     value={summary.lowest}  tone="fail" />
      <Stat label="Grade"      value={summary.finalGrade} />
    </div>
  );
}