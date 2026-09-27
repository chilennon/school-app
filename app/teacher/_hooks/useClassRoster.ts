"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fetchClassRoster } from "../_lib/fetchClassRoster";
import type {
  ClassInfo,
  ClassStatus,
  StudentInfo,
  TermInfo,
} from "../_lib/types";

export interface ClassRosterState {
  selectedClass: ClassInfo | null;
  selectedTermId: string | null;
  classTerms: TermInfo[];
  students: StudentInfo[];
  subjectMap: Record<string, string>;
  classStatus: ClassStatus;
  loading: boolean;
  selectClass: (cls: ClassInfo) => void;
  selectTerm: (termId: string) => Promise<void>;
  refresh: () => Promise<void>;
  patchStudent: (id: string, updates: any) => void;
  addSubjectLocally: (name: string, classSubjectId: string) => void;
}

export function useClassRoster(classes: ClassInfo[]): ClassRosterState {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [classTerms, setClassTerms] = useState<TermInfo[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [subjectMap, setSubjectMap] = useState<Record<string, string>>({});
  const [classStatus, setClassStatus] = useState<ClassStatus>("draft");
  const [loading, setLoading] = useState(false);

  // Derived — no setState needed to pick the "first" class.
  // If the user hasn't picked one, or the picked one no longer exists,
  // fall back to classes[0].
  const selectedClass = useMemo(() => {
    if (classes.length === 0) return null;
    if (!selectedClassId) return classes[0];
    return classes.find((c) => c.id === selectedClassId) ?? classes[0];
  }, [classes, selectedClassId]);

  const loadRosterFor = useCallback(
    async (cls: ClassInfo, termId: string) => {
      setLoading(true);
      const result = await fetchClassRoster(cls, termId);
      setStudents(result.students);
      setSubjectMap(result.subjectMap);
      setClassStatus(result.classStatus);
      setLoading(false);
    },
    [],
  );

  const selectClass = useCallback((cls: ClassInfo) => {
    setSelectedClassId(cls.id);
    setSelectedTermId(null);
    setStudents([]);
    setClassTerms([]);
  }, []);

  const selectTerm = useCallback(
    async (termId: string) => {
      if (!selectedClass) return;
      setSelectedTermId(termId);
      await loadRosterFor(selectedClass, termId);
    },
    [selectedClass, loadRosterFor],
  );

  const refresh = useCallback(async () => {
    if (!selectedClass || !selectedTermId) return;
    await loadRosterFor(selectedClass, selectedTermId);
  }, [selectedClass, selectedTermId, loadRosterFor]);

  // When the effective class changes, load its terms, pick a default term,
  // and fetch the roster. All setState is inside the async flow — not
  // synchronously in the effect body.
  useEffect(() => {
    if (!selectedClass) return;
    let cancelled = false;

    (async () => {
      const { data: termsData } = await supabase
        .from("terms")
        .select("id, name, sequence, is_current")
        .eq("session_id", selectedClass.session_id)
        .order("sequence");

      if (cancelled) return;

      if (!termsData || termsData.length === 0) {
        setClassTerms([]);
        setSelectedTermId(null);
        setStudents([]);
        return;
      }

      const terms = termsData as TermInfo[];
      setClassTerms(terms);

      const defaultTerm = [...terms].sort(
        (a, b) => a.sequence - b.sequence,
      )[0];
      setSelectedTermId(defaultTerm.id);
      await loadRosterFor(selectedClass, defaultTerm.id);
    })();

    return () => {
      cancelled = true;
    };
    // Only re-run when the effective class id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass?.id]);

  const patchStudent = useCallback((id: string, updates: any) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
  }, []);

  const addSubjectLocally = useCallback(
    (name: string, classSubjectId: string) => {
      setSubjectMap((prev) => ({
        ...prev,
        [name.toLowerCase()]: classSubjectId,
      }));
    },
    [],
  );

  return {
    selectedClass,
    selectedTermId,
    classTerms,
    students,
    subjectMap,
    classStatus,
    loading,
    selectClass,
    selectTerm,
    refresh,
    patchStudent,
    addSubjectLocally,
  };
}