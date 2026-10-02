"use client";

import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { WIZARD_STEPS, type StepIndex } from "./WizardHeader";

export function WizardFooter({
  step,
  busy,
  onPrevious,
  onNext,
  onFinish,
  onSaveAndExit,
}: {
  step: StepIndex;
  busy: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onFinish: () => void;
  onSaveAndExit: () => void;
}) {
  const isFirst = step === 0;
  const isLast = step === WIZARD_STEPS.length - 1;
  const nextLabel = isLast
    ? "Finish"
    : `Next: ${WIZARD_STEPS[step + 1].label}`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-3xl mx-auto px-4 py-3 space-y-2">
        <div className="flex gap-2">
          {!isFirst && (
            <button
              type="button"
              onClick={onPrevious}
              disabled={busy}
              className="flex items-center gap-1.5 px-4 py-3.5 bg-slate-100 text-slate-700 font-semibold rounded-2xl active:bg-slate-200 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
          )}
          <button
            type="button"
            onClick={isLast ? onFinish : onNext}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 py-3.5 bg-blue-600 text-white font-bold rounded-2xl active:bg-blue-700 disabled:opacity-60"
          >
            {busy ? (
              "Saving…"
            ) : isLast ? (
              <>
                <Check className="w-4 h-4" />
                Finish
              </>
            ) : (
              <>
                {nextLabel}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={onSaveAndExit}
          disabled={busy}
          className="w-full text-center text-xs font-semibold text-slate-500 py-1 active:text-slate-700 disabled:opacity-50"
        >
          Save draft and exit
        </button>
      </div>
    </div>
  );
}