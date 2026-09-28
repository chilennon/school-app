"use client";

import type { ReviewStudent } from "../../_lib/types";

export function ReviewRow({
  student,
  busy,
  onCommentChange,
  onView,
  onApprove,
  onReopen,
}: {
  student: ReviewStudent;
  busy: boolean;
  onCommentChange: (v: string) => void;
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

  return (
    <div className={`p-3 rounded-2xl border ${border} space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">
            {student.name}
          </p>
          <p className="text-[10px] font-mono text-slate-500 mt-0.5">
            {student.regNo}
          </p>
        </div>
        <span className="text-[11px] font-semibold text-slate-600 flex-shrink-0">
          {status === "submitted"
            ? "Awaiting"
            : status === "approved"
              ? "Approved"
              : "Draft"}
        </span>
      </div>

      <input
        type="text"
        value={student.comment}
        onChange={(e) => onCommentChange(e.target.value)}
        placeholder="Head teacher comment (optional)"
        disabled={status === "approved"}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
      />

      <div className="flex gap-2">
        <button
          onClick={onView}
          className="flex-1 py-2 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg active:bg-blue-100"
        >
          View
        </button>
        {status === "submitted" && (
          <button
            onClick={onApprove}
            disabled={busy}
            className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg active:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "…" : "Approve"}
          </button>
        )}
        {status === "approved" && (
          <button
            onClick={onReopen}
            disabled={busy}
            className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg active:bg-slate-200 disabled:opacity-50"
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