"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import type { ResultsPageProps, Subject } from "../_lib/types";

export function useSubjectRows(
  initialStudent: ResultsPageProps["initialStudent"],
  availableSubjects: { id: string; name: string; class_subject_id?: string }[] = [],
) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [nextSubjectId, setNextSubjectId] = useState(0);
  const initialized = useRef(false);

  useEffect(() => {
    // 🚨 Guard: Only run this once on mount to prevent wiping user input
    if (initialized.current) return;

    const asm = initialStudent?.assessment;
    
    if (asm?.subjects && asm.subjects.length > 0) {
      // 1. Hydrate saved scores and remove any duplicate subjects from old data
      const uniqueSavedSubs = Array.from(new Map(asm.subjects.map(item => [item.sub, item])).values());
      const savedSubs = uniqueSavedSubs.map((s, idx) => ({ 
        ...s, 
        id: Date.now() + idx 
      }));
      setSubjects(savedSubs);
      setNextSubjectId(Date.now() + savedSubs.length);
      initialized.current = true;
      
    } else if (availableSubjects.length > 0) {
      // 2. Populate from class subjects and ensure no duplicates
      const uniqueSubjects = Array.from(new Map(availableSubjects.map(item => [item.name, item])).values());
      
      const classSubs = uniqueSubjects.map((sub, idx) => ({
        id: Date.now() + idx,
        sub: sub.name, 
        ca: "",
        exam: "",
        sa: "",
        // 🚨 CRITICAL FIX: Attach the database UUID so it saves correctly
        class_subject_id: sub.class_subject_id, 
      }));
      
      setSubjects(classSubs);
      setNextSubjectId(Date.now() + classSubs.length);
      initialized.current = true;
    }
  }, [initialStudent, availableSubjects]);

  const updateRow = useCallback(
    (id: number, field: keyof Omit<Subject, "id">, value: string) => {
      setSubjects((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
      );
    },
    [],
  );

  return { subjects, updateRow };
}