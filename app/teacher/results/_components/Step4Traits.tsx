"use client";

import { TraitRow } from "./TraitRow";
import {
  AFFECTIVE_LABELS,
  PSYCHOMOTOR_LABELS,
} from "../_lib/constants";
import type { CompilerForm } from "../_lib/types";

function ratedCount(
  values: Record<string, string>,
  prefix: "a" | "p",
  total: number,
) {
  let n = 0;
  for (let i = 0; i < total; i++) {
    if (values[`${prefix}${i}`]) n++;
  }
  return n;
}

export function Step4Traits({
  form,
  setField,
  readOnly,
}: {
  form: CompilerForm;
  setField: <K extends keyof CompilerForm>(k: K, v: CompilerForm[K]) => void;
  readOnly: boolean;
}) {
  const affectiveTotal = AFFECTIVE_LABELS.length;
  const psychomotorTotal = PSYCHOMOTOR_LABELS.length;
  const affectiveRated = ratedCount(form.affective, "a", affectiveTotal);
  const psychomotorRated = ratedCount(form.psychomotor, "p", psychomotorTotal);
  const totalRated = affectiveRated + psychomotorRated;
  const total = affectiveTotal + psychomotorTotal;

  // ── Read-only (admin review): compact two-column table ──
  if (readOnly) {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ReadOnlyTable
              title="Affective Domain"
              labels={AFFECTIVE_LABELS}
              prefix="a"
              values={form.affective}
            />
            <ReadOnlyTable
              title="Psychomotor Skills"
              labels={PSYCHOMOTOR_LABELS}
              prefix="p"
              values={form.psychomotor}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Teacher (interactive): big-circle rating ──
  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Rate each trait</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            1 = Below Average · 5 = Excellent
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-600">
          {totalRated} / {total} rated
        </span>
      </div>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            Affective Domain
          </h3>
          <span className="text-[11px] text-slate-500">
            {affectiveRated} / {affectiveTotal}
          </span>
        </div>
        <div className="space-y-2">
          {AFFECTIVE_LABELS.map((label, i) => (
            <TraitRow
              key={`a${i}`}
              label={label}
              value={form.affective[`a${i}`] || ""}
              onChange={(v) =>
                setField("affective", { ...form.affective, [`a${i}`]: v })
              }
              readOnly={false}
            />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            Psychomotor Skills
          </h3>
          <span className="text-[11px] text-slate-500">
            {psychomotorRated} / {psychomotorTotal}
          </span>
        </div>
        <div className="space-y-2">
          {PSYCHOMOTOR_LABELS.map((label, i) => (
            <TraitRow
              key={`p${i}`}
              label={label}
              value={form.psychomotor[`p${i}`] || ""}
              onChange={(v) =>
                setField("psychomotor", {
                  ...form.psychomotor,
                  [`p${i}`]: v,
                })
              }
              readOnly={false}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ReadOnlyTable({
  title,
  labels,
  prefix,
  values,
}: {
  title: string;
  labels: string[];
  prefix: "a" | "p";
  values: Record<string, string>;
}) {
  return (
    <div>
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
        {title}
      </h4>
      <div className="space-y-1">
        {labels.map((label, i) => {
          const v = values[`${prefix}${i}`] || "";
          return (
            <div
              key={`${prefix}${i}`}
              className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0"
            >
              <span className="text-sm text-slate-700">{label}</span>
              <span
                className={`text-sm font-bold ${
                  v ? "text-slate-900" : "text-slate-300"
                }`}
              >
                {v || "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}