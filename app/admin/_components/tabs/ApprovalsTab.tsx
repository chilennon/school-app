"use client";

import { useState, useMemo } from "react";
import { PendingClassCard } from "../approvals/PendingClassCard";
import { ReviewHeader } from "../approvals/ReviewHeader";
import { ReviewList } from "../approvals/ReviewList";
import { ChevronDown, ChevronUp, Archive } from "lucide-react";
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
  onPromotionChange,
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
  onPromotionChange: (enrolmentId: string, v: string) => void;
  onView: (s: ReviewStudent) => void;
  onApprove: (s: ReviewStudent) => void;
  onReopen: (s: ReviewStudent) => void;
}) {
  const [showPastTerms, setShowPastTerms] = useState(false);

  // 🚨 GROUPING & SORTING
  const { currentTermClasses, pastTermClasses, activeSessionName } = useMemo(() => {
    const current: PendingClass[] = [];
    const past: PendingClass[] = [];
    let session = "Current Session";

    pendingClasses.forEach((c) => {
      session = c.sessionName;
      if (c.isCurrentTerm) {
        current.push(c);
      } else {
        past.push(c);
      }
    });

    // Sort current: Awaiting results first, then by class name
    current.sort((a, b) => {
      if (a.submittedCount > 0 && b.submittedCount === 0) return -1;
      if (a.submittedCount === 0 && b.submittedCount > 0) return 1;
      return a.className.localeCompare(b.className);
    });

    // Sort past terms descending (Third Term -> Second Term -> First Term)
    past.sort((a, b) => b.termSequence - a.termSequence);

    return { currentTermClasses: current, pastTermClasses: past, activeSessionName: session };
  }, [pendingClasses]);

  if (reviewClassId) {
    const current = pendingClasses.find((c) => c.classId === reviewClassId);
    
    // 🚨 Calculate how many students are still awaiting approval
    const pendingCount = reviewStudents.filter(s => s.status === "submitted").length;

    return (
      <div className="pb-24">
        <ReviewHeader
          className={current?.className || "—"}
          bulkComment={bulkComment}
          setBulkComment={setBulkComment}
          batchPrinting={batchPrinting}
          reviewLoading={reviewLoading}
          pendingCount={pendingCount} // 🚨 Pass this down
          onBack={onCloseReview}
          onBatchPrint={onBatchPrint}
          onApproveAll={onApproveAll}
        />
        <ReviewList
          students={reviewStudents}
          loading={reviewLoading}
          busyEnrolmentId={busyEnrolmentId}
          onCommentChange={onCommentChange}
          onPromotionChange={onPromotionChange}
          onView={onView}
          onApprove={onApprove}
          onReopen={onReopen}
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="pt-[env(safe-area-inset-top)]">
        <h1 className="text-2xl font-bold text-slate-900">Approvals</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Results awaiting your review
        </p>
      </header>

      {/* SESSION BANNER */}
      <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200 mb-0.5">
            Reviewing Session
          </p>
          <h2 className="text-xl font-black">{activeSessionName}</h2>
        </div>
        <div className="bg-blue-500/50 px-3 py-1.5 rounded-lg text-xs font-bold">
          {currentTermClasses.length} class{currentTermClasses.length !== 1 ? "es" : ""} this term
        </div>
      </div>

      {/* CURRENT TERM CLASSES */}
      {currentTermClasses.length === 0 ? (
        <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-sm text-slate-500">
          No classes pending approval for the current term.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Term</p>
          {currentTermClasses.map((c) => (
            <PendingClassCard
              key={`${c.classId}-${c.termId}`}
              item={c}
              onOpen={() => onOpenReview(c)}
            />
          ))}
        </div>
      )}

      {/* PAST TERMS (Collapsible Archive) */}
      {pastTermClasses.length > 0 && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden mt-8">
          <button
            onClick={() => setShowPastTerms(!showPastTerms)}
            className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-bold text-slate-700">Past Terms Archive</span>
              <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {pastTermClasses.length}
              </span>
            </div>
            {showPastTerms ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showPastTerms && (
            <div className="p-4 space-y-3 border-t border-slate-200 bg-slate-50/50">
              {pastTermClasses.map((c) => (
                <div key={`${c.classId}-${c.termId}`} className="opacity-75 hover:opacity-100 transition-opacity">
                  <PendingClassCard
                    item={c}
                    onOpen={() => {}}
                    readOnly={true}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}