"use client";

import { ClassPills } from "../scores/ClassPills";
import { TermTabs } from "../scores/TermTabs";
import { MixedBanner } from "../scores/MixedBanner";
import { RosterList } from "../scores/RosterList";
import { StickyActionBar } from "../scores/StickyActionBar";
import { StatusPill } from "../StatusPill";
import type {
  ClassInfo,
  ClassStatus,
  StudentInfo,
  TermInfo,
} from "../../_lib/types";

export function ScoresTab({
  assignedClasses,
  selectedClass,
  onSelectClass,
  classTerms,
  selectedTermId,
  onSelectTerm,
  students,
  classStatus,
  onEnterScores,
  submitting,
  onBatchPrint,
  onSubmit,
  onReopen,
}: {
  assignedClasses: ClassInfo[];
  selectedClass: ClassInfo | null;
  onSelectClass: (cls: ClassInfo) => void;
  classTerms: TermInfo[];
  selectedTermId: string | null;
  onSelectTerm: (termId: string) => void;
  students: StudentInfo[];
  classStatus: ClassStatus;
  onEnterScores: (student: StudentInfo) => void;
  submitting: boolean;
  onBatchPrint: () => void;
  onSubmit: () => void;
  onReopen: () => void;
}) {
  const draftCount = students.filter(
    (s) => s.assessment?.status === "draft",
  ).length;
  const selectedTermName =
    classTerms.find((t) => t.id === selectedTermId)?.name || "";

  return (
    <div className="p-4 space-y-4 pb-40">
      <header className="pt-[env(safe-area-inset-top)]">
        <h1 className="text-2xl font-bold text-slate-900">Scores</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Choose a class, then a term
        </p>
      </header>

      <ClassPills
        classes={assignedClasses}
        selectedId={selectedClass?.id ?? null}
        onSelect={onSelectClass}
      />

      <TermTabs
        terms={classTerms}
        selectedId={selectedTermId}
        onSelect={onSelectTerm}
      />

      {classStatus === "mixed" && <MixedBanner count={draftCount} />}

      {selectedClass && classTerms.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">
              Roster · {students.length}
            </p>
            {classStatus !== "draft" && <StatusPill status={classStatus} />}
          </div>
          <RosterList students={students} onEnterScores={onEnterScores} />
        </>
      )}

      {!selectedClass && assignedClasses.length === 0 && (
        <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 text-center">
          <p className="text-sm font-bold text-amber-900">
            No classes assigned
          </p>
          <p className="text-xs text-amber-700 mt-1">
            You can't enter scores until an admin assigns you a class.
          </p>
        </div>
      )}

      {selectedClass && students.length > 0 && (
        <StickyActionBar
          classStatus={classStatus}
          termName={selectedTermName}
          submitting={submitting}
          onBatchPrint={onBatchPrint}
          onSubmit={onSubmit}
          onReopen={onReopen}
        />
      )}
    </div>
  );
}