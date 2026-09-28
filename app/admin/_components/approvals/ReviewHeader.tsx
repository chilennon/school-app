"use client";

export function ReviewHeader({
  className,
  bulkComment,
  setBulkComment,
  batchPrinting,
  reviewLoading,
  onBack,
  onBatchPrint,
  onApproveAll,
}: {
  className: string;
  bulkComment: string;
  setBulkComment: (v: string) => void;
  batchPrinting: boolean;
  reviewLoading: boolean;
  onBack: () => void;
  onBatchPrint: () => void;
  onApproveAll: () => void;
}) {
  return (
    <div className="p-4 bg-white border-b border-slate-200 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="text-xs bg-slate-100 text-slate-700 font-semibold px-3 py-2 rounded-lg active:bg-slate-200"
        >
          ← Back
        </button>
        <div className="text-right min-w-0">
          <p className="text-[10px] uppercase font-bold text-slate-500">
            Reviewing
          </p>
          <p className="text-sm font-bold text-slate-800 truncate">
            {className}
          </p>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
          Head Teacher Comment (bulk approve)
        </label>
        <input
          type="text"
          value={bulkComment}
          onChange={(e) => setBulkComment(e.target.value)}
          placeholder="e.g. A good result. Keep it up."
          className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={onBatchPrint}
          disabled={reviewLoading || batchPrinting}
          className="flex-1 py-3 bg-slate-100 active:bg-slate-200 disabled:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm"
        >
          {batchPrinting ? "Preparing…" : "🖨 Print All"}
        </button>
        <button
          onClick={onApproveAll}
          disabled={reviewLoading}
          className="flex-1 py-3 bg-emerald-600 active:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold rounded-xl text-sm"
        >
          {reviewLoading ? "Approving…" : "Approve All"}
        </button>
      </div>
    </div>
  );
}