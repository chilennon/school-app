"use client";

import { useCallback, useEffect, useState } from "react";
import { EMPTY_AFFECTIVE, EMPTY_PSYCHOMOTOR } from "../_lib/constants";
import type { CompilerForm, ResultsPageProps } from "../_lib/types";

interface SchoolConfig {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
}

export function useCompilerForm(
  initialStudent: ResultsPageProps["initialStudent"],
  initialClass: ResultsPageProps["initialClass"],
  initialTerm: string,
  config: SchoolConfig | null | undefined,
) {
  const [form, setFormState] = useState<CompilerForm>({
    schoolName: "",
    schoolAddress: "",
    schoolEmail: "",
    schoolPhone: "",
    studentName: "",
    studentId: "",
    sex: "",
    age: "",
    className: "",
    session: "",
    term: "",
    classAvg: "",
    daysOpened: "",
    daysPresent: "",
    daysAbsent: "",
    affective: { ...EMPTY_AFFECTIVE },
    psychomotor: { ...EMPTY_PSYCHOMOTOR },
    teacherName: "",
    headTeacherName: "",
    teacherRemark: "",
    headRemark: "",
    nextTerm: "",
    promotion: "",
    positions: undefined,
    termAverages: {},
    cumulativeAverage: null,
  });

  // Hydrate from props
  useEffect(() => {
    if (!initialStudent || !initialClass) return;

    const asm = initialStudent.assessment || {};

    setFormState({
      schoolName: asm.schoolName || config?.name || "",
      schoolAddress: asm.schoolAddress || config?.address || "",
      schoolEmail: asm.schoolEmail || "",
      schoolPhone: asm.schoolPhone || config?.phone || "",
      studentName: initialStudent.name || "",
      studentId: initialStudent.reg_no || initialStudent.id || "",
      sex: initialStudent.gender || "",
      age: initialStudent.age || "",
      className: initialClass.name || "",
      session: initialClass.session || "",
      term: initialTerm || "",
      classAvg: asm.classAvg || "",
      daysOpened: asm.daysOpened || "",
      daysPresent: asm.daysPresent || "",
      daysAbsent: asm.daysAbsent || "",
      affective: asm.affective || { ...EMPTY_AFFECTIVE },
      psychomotor: asm.psychomotor || { ...EMPTY_PSYCHOMOTOR },
      teacherName: asm.teacherName || "",
      headTeacherName: asm.headTeacherName || "",
      teacherRemark: asm.teacherRemark || "",
      headRemark: asm.headRemark || "",
      nextTerm: asm.nextTerm || "",
      promotion: asm.promotion || "",
      positions: asm.positions,
      termAverages: asm.termAverages || {},
      cumulativeAverage: asm.cumulativeAverage ?? null,
    });
  }, [initialStudent, initialClass, initialTerm, config]);

  const setField = useCallback(
    <K extends keyof CompilerForm>(key: K, value: CompilerForm[K]) => {
      setFormState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const setForm = useCallback((updates: Partial<CompilerForm>) => {
    setFormState((prev) => ({ ...prev, ...updates }));
  }, []);

  const clearAll = useCallback(() => {
    if (!window.confirm("Clear all data and start fresh for this student?"))
      return;
    setFormState((prev) => ({
      ...prev,
      schoolName: "",
      schoolAddress: "",
      schoolEmail: "",
      schoolPhone: "",
      studentName: initialStudent.name || "",
      studentId: initialStudent.reg_no || initialStudent.id || "",
      sex: initialStudent.gender || "",
      age: initialStudent.age || "",
      className: initialClass.name || "",
      session: initialClass.session || "",
      term: initialTerm || "",
      classAvg: "",
      daysOpened: "",
      daysPresent: "",
      daysAbsent: "",
      affective: { ...EMPTY_AFFECTIVE },
      psychomotor: { ...EMPTY_PSYCHOMOTOR },
      teacherName: "",
      headTeacherName: "",
      teacherRemark: "",
      headRemark: "",
      nextTerm: "",
      promotion: "",
    }));
  }, [initialStudent, initialClass, initialTerm]);

  // Auto-calculate days absent
  useEffect(() => {
    const o = parseFloat(form.daysOpened) || 0;
    const p = parseFloat(form.daysPresent) || 0;
    const absent = Math.max(0, o - p).toString();
    if (absent !== form.daysAbsent) {
      setField("daysAbsent", absent);
    }
  }, [form.daysOpened, form.daysPresent, form.daysAbsent, setField]);

  return { form, setField, setForm, clearAll };
}