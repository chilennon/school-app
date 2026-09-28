"use client";

import { useCallback, useEffect, useState } from "react";
import { EMPTY_SUBJECT_ROWS } from "../_lib/constants";
import type { ResultsPageProps, Subject } from "../_lib/types";

export function useSubjectRows(
  initialStudent: ResultsPageProps["initialStudent"],
) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [nextSubjectId, setNextSubjectId] = useState(0);

  // Hydrate when the student changes
  useEffect(() => {
    const asm = initialStudent?.assessment;
    const subs =
      asm?.subjects && asm.subjects.length > 0
        ? (asm.subjects as Subject[])
        : EMPTY_SUBJECT_ROWS();
    setSubjects(subs);
    setNextSubjectId(Math.max(...subs.map((s) => s.id), 0) + 1);
  }, [initialStudent]);

  const replaceAll = useCallback((rows: Subject[]) => {
    setSubjects(rows);
    setNextSubjectId(Math.max(...rows.map((s) => s.id), 0) + 1);
  }, []);

  const removeRow = useCallback((id: number) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateRow = useCallback(
    (id: number, field: keyof Omit<Subject, "id">, value: string) => {
      setSubjects((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
      );
    },
    [],
  );

  const addRow = useCallback(
    (name: string) => {
      setSubjects((prev) => [
        ...prev,
        { id: nextSubjectId, sub: name, ca: "", exam: "", sa: "" },
      ]);
      setNextSubjectId((prev) => prev + 1);
    },
    [nextSubjectId],
  );

  return {
    subjects,
    replaceAll,
    removeRow,
    updateRow,
    addRow,
  };
}