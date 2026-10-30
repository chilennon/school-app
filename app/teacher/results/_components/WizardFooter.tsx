"use client";

import { ChevronLeft, ChevronRight, Save, Check } from "lucide-react";
import { WIZARD_STEPS, type StepIndex } from "./WizardHeader";

export function WizardFooter({
  step,
  busy,
  readOnly,
  onPrevious,
  onNext,
  onFinish,
  onSaveAndExit,
}: {
  step: StepIndex;
  busy: boolean;
  readOnly?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onFinish: () => void;
  onSaveAndExit: () => void;
}) {
  const isLastStep = step === WIZARD_STEPS.length - 1;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 pb-8 sm:pb-4 z-40">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
        
        {/* Previous Button */}
        <button
          onClick={onPrevious}
          disabled={step === 0 || busy}
          className="flex items-center gap-1 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl disabled:opacity-50 hover:bg-slate-200 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        {/* Center: Save and Exit (Hidden if read-only) */}
        {!readOnly && (
          <button
            onClick={onSaveAndExit}
            disabled={busy}
            className="hidden sm:flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Save draft and exit
          </button>
        )}

        {/* Next / Finish Button */}
        {isLastStep ? (
          <button
            onClick={onFinish}
            disabled={busy}
            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-colors disabled:opacity-50 ${
              readOnly ? "bg-slate-600 hover:bg-slate-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            <Check className="w-4 h-4" /> {readOnly ? "Close" : "Finish"}
          </button>
        ) : (
          <button
            onClick={onNext}
            disabled={busy}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {/* 🚨 FIX: Use .label to render the string */}
            Next: {WIZARD_STEPS[step + 1]?.label || "Next"} 
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}