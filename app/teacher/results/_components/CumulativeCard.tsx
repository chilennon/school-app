"use client";

import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardCls, cardTitleCls } from "../_lib/ui";

export function CumulativeCard({
  termAverages, cumulativeAverage,
}: {
  termAverages: Record<string, number>;
  cumulativeAverage: number | null;
}) {
  const hasData = Object.keys(termAverages).length > 1 || cumulativeAverage != null;
  if (!hasData) return null;

  return (
    <div className={cn(cardCls, "mt-3")}>
      <div className={cardTitleCls}>
        <TrendingUp className="h-4 w-4 text-slate-500" />
        <span>Session Cumulative Average</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {["First", "Second", "Third"].map((t) => (
          <div key={t} className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {t} Term
            </p>
            <p className="text-base font-bold text-slate-900 mt-0.5">
              {termAverages[t] != null ? termAverages[t].toFixed(1) + "%" : "—"}
            </p>
          </div>
        ))}
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Cumulative
          </p>
          <p className="text-base font-bold text-blue-600 mt-0.5">
            {cumulativeAverage != null ? cumulativeAverage.toFixed(1) + "%" : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}