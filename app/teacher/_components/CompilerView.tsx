"use client";
import ResultsPage from "../results/page";
import type { CatalogSubject, TermInfo } from "../_lib/types";

export function CompilerView({
  student, classRoom, termName, catalogSubjects, readOnly, onBack, onSaveDraft, onComplete,
}: {
  student: any;
  classRoom: any;
  termName: string;
  classTerms: TermInfo[];
  selectedTermId: string | null;
  catalogSubjects: CatalogSubject[];
  readOnly?: boolean; // 🚨 Must be here
  onBack: () => void;
  onSaveDraft: (s: any) => void | Promise<void>;
  onComplete: (s: any) => void | Promise<void>;
}) {
  return (
    <ResultsPage
      initialStudent={student}
      initialClass={classRoom}
      term={termName}
      availableSubjects={catalogSubjects}
      readOnly={readOnly} // 🚨 Passed here
      onSaveDraft={onSaveDraft}
      onComplete={onComplete}
      onExit={onBack}
    />
  );
}