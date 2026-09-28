"use client";

export function ActionRow({
  readOnly,
  onSaveDraft,
  onExport,
}: {
  readOnly: boolean;
  onSaveDraft: () => void;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5">
      <h2 className="text-lg font-bold text-slate-800">Assessment Compiler</h2>
      <div className="flex flex-col sm:flex-row gap-2">
        {!readOnly && (
          <button className="btn btn-ghost" onClick={onSaveDraft}>
            💾 Save Draft Progress
          </button>
        )}
        <button className="btn btn-gold" onClick={onExport}>
          ⬇ Export Full PDF Report
        </button>
      </div>
    </div>
  );
}