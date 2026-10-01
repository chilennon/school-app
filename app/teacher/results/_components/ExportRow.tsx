"use client";

import { Button } from "@/components/ui/button";

export function ExportRow({
  readOnly, onSaveDraft, onSubmit,
}: {
  readOnly: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
}) {
  if (readOnly) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-3 flex gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          variant="outline"
          onClick={onSaveDraft}
          className="flex-1 h-12 text-base font-semibold border-blue-600 text-blue-600 hover:bg-blue-50"
        >
          Save Draft
        </Button>
        <Button
          onClick={onSubmit}
          className="flex-1 h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700"
        >
          Submit for Approval
        </Button>
      </div>
    </div>
  );
}