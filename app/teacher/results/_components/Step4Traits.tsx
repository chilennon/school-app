"use client";

import { Sprout } from "lucide-react";
import { cardCls, cardTitleCls } from "../_lib/ui";
import { AFFECTIVE_LABELS, PSYCHOMOTOR_LABELS, RATING_OPTIONS } from "../_lib/constants";
import type { CompilerForm } from "../_lib/types";

export function Step4Traits({
  form, setField, readOnly,
}: {
  form: CompilerForm;
  setField: <K extends keyof CompilerForm>(k: K, v: CompilerForm[K]) => void;
  readOnly: boolean;
}) {
  const selectCls = "h-10 w-20 rounded-lg border border-slate-300 bg-white px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500";

  const Table = ({ title, labels, prefix, values }: {
    title: string; labels: string[]; prefix: "a" | "p";
    values: Record<string, string>;
  }) => (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
        {title}
      </h4>
      <div className="space-y-1.5">
        {labels.map((label, i) => (
          <div key={`${prefix}${i}`} className="flex items-center justify-between gap-2">
            <span className="text-sm text-slate-700 flex-1">{label}</span>
            <select
              className={selectCls}
              disabled={readOnly}
              value={values[`${prefix}${i}`] || ""}
              onChange={(e) => setField(
                prefix === "a" ? "affective" : "psychomotor",
                { ...values, [`${prefix}${i}`]: e.target.value },
              )}
            >
              <option value="">—</option>
              {RATING_OPTIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={cardCls}>
      <div className={cardTitleCls}>
        <Sprout className="h-4 w-4 text-slate-500" />
        <span>Behavioural &amp; Skills Assessment</span>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        5 = Excellent · 4 = Very Good · 3 = Good · 2 = Average · 1 = Below Average
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Table title="Affective Domain" labels={AFFECTIVE_LABELS} prefix="a" values={form.affective} />
        <Table title="Psychomotor Skills" labels={PSYCHOMOTOR_LABELS} prefix="p" values={form.psychomotor} />
      </div>
    </div>
  );
}