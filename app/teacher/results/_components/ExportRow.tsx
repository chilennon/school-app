"use client";

export function ExportRow({
  readOnly,
  onClearAll,
  onSaveDraft,
  onExport,
}: {
  readOnly: boolean;
  onClearAll: () => void;
  onSaveDraft: () => void;
  onExport: () => void;
}) {
  return (
    <div className="export-row">
      {!readOnly && (
        <>
          <button className="btn btn-ghost" onClick={onClearAll}>
            🗑 Clear All
          </button>
          <button className="btn btn-ghost" onClick={onSaveDraft}>
            💾 Save Draft Progress
          </button>
        </>
      )}
      <button className="btn btn-gold" onClick={onExport}>
        ⬇ Export Full PDF Report
      </button>
    </div>
  );
}