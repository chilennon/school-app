"use client";

import type { ReviewStudent } from "../../_lib/types";

export function ReviewRow({
  student,
  busy,
  onCommentChange,
  onPromotionChange, // 🚨 NEW
  onView,
  onApprove,
  onReopen,
}: {
  student: ReviewStudent;
  busy: boolean;
  onCommentChange: (v: string) => void;
  onPromotionChange: (v: string) => void; // 🚨 NEW
  onView: () => void;
  onApprove: () => void;
  onReopen: () => void;
}) {
  const { status } = student;
  const border =
    status === "approved"
      ? "border-emerald-200 bg-emerald-50"
      : status === "submitted"
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-white";

  // Safely access promotion if it exists
  const promotion = (student as any).promotion || "";

  return (
    <div className={`p-4 rounded-2xl border ${border} space-y-3`}>
      {/* HEADER */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">
            {student.name}
          </p>
          <p className="text-[10px] font-mono text-slate-500 mt-0.5">
            {student.regNo}
          </p>
        </div>
        <span className="text-[11px] font-bold text-slate-600 flex-shrink-0 uppercase tracking-wider">
          {status === "submitted"
            ? "Awaiting"
            : status === "approved"
              ? "Approved"
              : "Draft"}
        </span>
      </div>

      {/* COMMENT & PROMOTION STATUS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          type="text"
          value={student.comment || ""}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Head teacher comment (optional)"
          disabled={status === "approved"}
          className="md:col-span-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
        />
        <select
          value={promotion}
          onChange={(e) => onPromotionChange(e.target.value)}
          disabled={status === "approved"}
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
        >
          <option value="">Promotion Status</option>
          <option value="Promoted">Promote</option>
          <option value="Repeated">Repeat</option>
          <option value="Graduated">Graduate</option>
        </select>
      </div>

      {/* ACTIONS */}
      <div className="flex gap-2">
        <button
          onClick={onView}
          className="flex-1 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          View
        </button>

        {status === "submitted" && (
          <>
            <button
              onClick={onReopen}
              disabled={busy}
              className="flex-1 py-2 text-xs font-bold text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 disabled:opacity-50 transition-colors"
            >
              Send Back
            </button>
            <button
              onClick={onApprove}
              disabled={busy}
              className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {busy ? "…" : "Approve"}
            </button>
          </>
        )}

        {status === "approved" && (
          <button
            onClick={onReopen}
            disabled={busy}
            className="flex-1 py-2 text-xs font-bold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            Reopen
          </button>
        )}

        {status === "draft" && (
          <span className="flex-1 py-2 text-xs text-slate-400 italic text-center">
            Waiting on teacher
          </span>
        )}
      </div>
    </div>
  );
}