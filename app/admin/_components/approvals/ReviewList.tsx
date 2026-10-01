"use client";

import { Skeleton } from "@/components/ui/skeleton";
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
      <div className="p-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="p-3 rounded-2xl border border-slate-200 bg-white space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-3 w-16 flex-shrink-0" />
            </div>
            <Skeleton className="h-9 w-full rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-8 flex-1 rounded-lg" />
              <Skeleton className="h-8 flex-1 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
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