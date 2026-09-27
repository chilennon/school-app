"use client";

import ResultsPage from "../results/page";
import type { CatalogSubject, TermInfo } from "../_lib/types";

export function CompilerView({
  student,
  classRoom,
  termName,
  classTerms,
  selectedTermId,
  catalogSubjects,
  onBack,
  onAddSubject,
  onSaveDraft,
  onComplete,
}: {
  student: any;
  classRoom: any;
  termName: string;
  classTerms: TermInfo[];
  selectedTermId: string | null;
  catalogSubjects: CatalogSubject[];
  onBack: () => void;
  onAddSubject: (
    subjectId: string,
    subjectName: string,
  ) => Promise<string | null>;
  onSaveDraft: (s: any) => void | Promise<void>;
  onComplete: (s: any) => void | Promise<void>;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg active:bg-slate-100"
          aria-label="Back"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 truncate">
            {classRoom.name} ·{" "}
            {classTerms.find((t) => t.id === selectedTermId)?.name || "First"}{" "}
            Term
          </p>
          <p className="font-bold text-slate-900 truncate text-sm">
            {student.name}
          </p>
        </div>
      </header>

      <div className="p-3 md:p-6">
        <ResultsPage
          initialStudent={student}
          initialClass={classRoom}
          term={termName}
          availableSubjects={catalogSubjects}
          onAddSubject={onAddSubject}
          onSaveDraft={onSaveDraft}
          onComplete={onComplete}
        />
      </div>
    </div>
  );
}