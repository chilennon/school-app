"use client";

import { PendingClassCard } from "../approvals/PendingClassCard";
import { ReviewHeader } from "../approvals/ReviewHeader";
import { ReviewList } from "../approvals/ReviewList";
import type { PendingClass, ReviewStudent } from "../../_lib/types";

export function ApprovalsTab({
  pendingClasses,
  reviewClassId,
  reviewStudents,
  reviewLoading,
  bulkComment,
  setBulkComment,
  batchPrinting,
  busyEnrolmentId,
  onOpenReview,
  onCloseReview,
  onBatchPrint,
  onApproveAll,
  onCommentChange,
  onView,
  onApprove,
  onReopen,
}: {
  pendingClasses: PendingClass[];
  reviewClassId: string | null;
  reviewStudents: ReviewStudent[];
  reviewLoading: boolean;
  bulkComment: string;
  setBulkComment: (v: string) => void;
  batchPrinting: boolean;
  busyEnrolmentId: string | null;
  onOpenReview: (c: PendingClass) => void;
  onCloseReview: () => void;
  onBatchPrint: () => void;
  onApproveAll: () => void;
  onCommentChange: (enrolmentId: string, v: string) => void;
  onView: (s: ReviewStudent) => void;
  onApprove: (s: ReviewStudent) => void;
  onReopen: (s: ReviewStudent) => void;
}) {
  if (reviewClassId) {
    const current = pendingClasses.find((c) => c.classId === reviewClassId);
    return (
      <div className="pb-24">
        <ReviewHeader
          className={current?.className || "—"}
          bulkComment={bulkComment}
          setBulkComment={setBulkComment}
          batchPrinting={batchPrinting}
          reviewLoading={reviewLoading}
          onBack={onCloseReview}
          onBatchPrint={onBatchPrint}
          onApproveAll={onApproveAll}
        />
        <ReviewList
          students={reviewStudents}
          loading={reviewLoading}
          busyEnrolmentId={busyEnrolmentId}
          onCommentChange={onCommentChange}
          onView={onView}
          onApprove={onApprove}
          onReopen={onReopen}
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      <header className="pt-[env(safe-area-inset-top)]">
        <h1 className="text-2xl font-bold text-slate-900">Approvals</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Results awaiting your review
        </p>
      </header>

      {pendingClasses.length === 0 ? (
        <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-sm text-slate-500">
          No classes pending approval right now.
        </div>
      ) : (
        <div className="space-y-3">
          {pendingClasses.map((c) => (
            <PendingClassCard
              key={`${c.classId}-${c.termId}`}
              item={c}
              onOpen={() => onOpenReview(c)}
            />
          ))}
        </div>
      )}
    </div>
  );
}