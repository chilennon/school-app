"use client";

import { Fragment } from "react";
import { ArrowLeft, Download } from "lucide-react";

export const WIZARD_STEPS = [
  { key: "details", label: "Details" },
  { key: "attendance", label: "Attend." },
  { key: "subjects", label: "Subjects" },
  { key: "traits", label: "Traits" },
  { key: "remarks", label: "Remarks" },
] as const;

export type StepIndex = 0 | 1 | 2 | 3 | 4;

export function WizardHeader({
  studentName,
  meta,
  status,
  step,
  onExit,
  onExport,
}: {
  studentName: string;
  meta: string;
  status: string;
  step: StepIndex;
  onExit?: () => void;
  onExport?: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-start gap-2">
        {onExit && (
          <button
            onClick={onExit}
            className="p-2 -ml-2 rounded-lg active:bg-slate-100"
            aria-label="Back to roster"
          >
            <ArrowLeft className="w-5 h-5 text-slate-800" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-slate-900 truncate leading-tight">
            {studentName || "New Result"}
          </h1>
          {meta && (
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {meta}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
            {status}
          </span>
          {onExport && (
            <button
              onClick={onExport}
              className="w-9 h-9 rounded-full flex items-center justify-center active:bg-slate-100"
              aria-label="Export PDF"
            >
              <Download className="w-4 h-4 text-slate-700" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-3">
        <div className="flex items-center">
          {WIZARD_STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <Fragment key={s.key}>
                <div
                  className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0 ${
                    done
                      ? "bg-emerald-500 text-white"
                      : current
                        ? "bg-blue-600 text-white ring-4 ring-blue-600/15"
                        : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </div>
                {i < WIZARD_STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-1 ${
                      i < step ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                  />
                )}
              </Fragment>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Step {step + 1} of {WIZARD_STEPS.length} ·{" "}
          <span className="font-semibold text-slate-700">
            {WIZARD_STEPS[step].label}
          </span>
        </p>
      </div>
    </header>
  );
}