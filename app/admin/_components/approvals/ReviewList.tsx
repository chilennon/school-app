"use client";

import { ReviewRow } from "./ReviewRow";
import type { ReviewStudent } from "../../_lib/types";

export function ReviewList({
  students,
  loading,
  busyEnrolmentId,
  onCommentChange,
  onView,
  onApprove,
  onReopen,
}: {
  students: ReviewStudent[];
  loading: boolean;
  busyEnrolmentId: string | null;
  onCommentChange: (enrolmentId: string, v: string) => void;
  onView: (s: ReviewStudent) => void;
  onApprove: (s: ReviewStudent) => void;
  onReopen: (s: ReviewStudent) => void;
}) {
    if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
    );
  }
  if (students.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        No students in this class.
      </div>
    );
  }
  return (
    <div className="p-4 space-y-3">
      {students.map((s) => (
        <ReviewRow
          key={s.enrolmentId}
          student={s}
          busy={busyEnrolmentId === s.enrolmentId}
          onCommentChange={(v) => onCommentChange(s.enrolmentId, v)}
          onView={() => onView(s)}
          onApprove={() => onApprove(s)}
          onReopen={() => onReopen(s)}
        />
      ))}
    </div>
  );
}