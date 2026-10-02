"use client";

import ResultsPage from "../results/page";
import type { CatalogSubject, TermInfo } from "../_lib/types";

export function CompilerView({
  student,
  classRoom,
  termName,
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
    <ResultsPage
      initialStudent={student}
      initialClass={classRoom}
      term={termName}
      availableSubjects={catalogSubjects}
      onAddSubject={onAddSubject}
      onSaveDraft={onSaveDraft}
      onComplete={onComplete}
      onExit={onBack}
    />
  );
}