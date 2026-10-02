"use client";

import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import { useSchoolConfig } from "@/hooks/useSchoolConfig";
import { generateSingleReportCard } from "@/lib/reportCardPdf";

import { useCompilerForm } from "./_hooks/useCompilerForm";
import { useSubjectRows } from "./_hooks/useSubjectRows";
import { collectSubjects, calculateSummary } from "./_lib/calculations";

import {
  WizardHeader,
  WIZARD_STEPS,
  type StepIndex,
} from "./_components/WizardHeader";
import { WizardFooter } from "./_components/WizardFooter";
import { Step1StudentDetails } from "./_components/Step1StudentDetails";
import { Step2Attendance } from "./_components/Step2Attendance";
import { Step3Subjects } from "./_components/Step3Subjects";
import { SummaryStrip } from "./_components/SummaryStrip";
import { CumulativeCard } from "./_components/CumulativeCard";
import { Step4Traits } from "./_components/Step4Traits";
import { Step5Remarks } from "./_components/Step5Remarks";

import type {
  GradeResult,
  ResultsPageProps,
  StudentAssessment,
} from "./_lib/types";

export type {
  Subject,
  ProcessedSubject,
  StudentAssessment,
  ResultsPageProps,
} from "./_lib/types";

export default function ResultsPage({
  initialStudent,
  initialClass,
  term: initialTerm,
  availableSubjects = [],
  onAddSubject,
  onSaveDraft,
  onComplete,
  onExit,
  readOnly = false,
}: ResultsPageProps) {
  const { config, gradeBands, gradeFor } = useSchoolConfig();
  const { form, setField, clearAll } = useCompilerForm(
    initialStudent,
    initialClass,
    initialTerm,
    config,
  );
  const { subjects, replaceAll, removeRow, updateRow, addRow } =
    useSubjectRows(initialStudent);

  const [step, setStep] = useState<StepIndex>(0);
  const [busy, setBusy] = useState(false);

  const caWeight = config?.ca_weight ?? 40;
  const examWeight = config?.exam_weight ?? 60;
  const grade = (score: number | null): GradeResult => gradeFor(score);

  const processed = useMemo(
    () => collectSubjects(subjects, grade),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subjects, config],
  );
  const summary = useMemo(
    () => calculateSummary(processed, grade),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [processed, config],
  );

  const buildUpdatedStudent = (status: "draft" | "completed") => {
    const updatedAssessment: StudentAssessment = {
      schoolName: form.schoolName,
      schoolAddress: form.schoolAddress,
      schoolEmail: form.schoolEmail,
      schoolPhone: form.schoolPhone,
      daysOpened: form.daysOpened,
      daysPresent: form.daysPresent,
      daysAbsent: form.daysAbsent,
      subjects,
      affective: form.affective,
      psychomotor: form.psychomotor,
      teacherName: form.teacherName,
      headTeacherName: form.headTeacherName,
      teacherRemark: form.teacherRemark,
      headRemark: form.headRemark,
      nextTerm: form.nextTerm,
      promotion: form.promotion,
      classAvg: form.classAvg,
      status,
    };
    return {
      ...initialStudent,
      id: initialStudent.id,
      reg_no: initialStudent.reg_no || form.studentId || initialStudent.id,
      name: form.studentName,
      gender: form.sex,
      age: form.age,
      assessment: updatedAssessment,
    };
  };

  const saveSilently = async (): Promise<boolean> => {
    if (readOnly) return true;
    try {
      await onSaveDraft?.(buildUpdatedStudent("draft"));
      return true;
    } catch (err: any) {
      console.error("silent save failed:", err);
      toast.error(err.message || "Couldn't save. Please try again.");
      return false;
    }
  };

  const saveWithToast = async (completed: boolean): Promise<boolean> => {
    try {
      if (completed) {
        await onComplete?.(buildUpdatedStudent("completed"));
        toast.success("Result finalized.");
      } else {
        await onSaveDraft?.(buildUpdatedStudent("draft"));
        toast.success("Draft saved.");
      }
      return true;
    } catch (err: any) {
      console.error("save failed:", err);
      toast.error(err.message || "Save failed. Please try again.");
      return false;
    }
  };

  const handleNext = async () => {
    setBusy(true);
    const ok = await saveSilently();
    setBusy(false);
    if (ok && step < WIZARD_STEPS.length - 1) {
      setStep((step + 1) as StepIndex);
    }
  };

  const handlePrevious = async () => {
    if (step === 0) return;
    setBusy(true);
    const ok = await saveSilently();
    setBusy(false);
    if (ok) setStep((step - 1) as StepIndex);
  };

  const handleSaveAndExit = async () => {
    setBusy(true);
    const ok = await saveWithToast(false);
    setBusy(false);
    if (ok) onExit?.();
  };

  const handleFinish = async () => {
    setBusy(true);
    await saveWithToast(true);
    setBusy(false);
  };

  const handleAddFromCatalog = async (id: string, name: string) => {
    if (!onAddSubject) return;
    const classSubjectId = await onAddSubject(id, name);
    if (classSubjectId) addRow(name);
  };

  const exportPDF = () => {
    if (!form.studentName) {
      toast.error("Please enter the student name.");
      return;
    }
    if (processed.length === 0) {
      toast.error("Please add at least one subject with scores.");
      return;
    }
    try {
      const doc = generateSingleReportCard({
        schoolName: form.schoolName,
        schoolAddress: form.schoolAddress,
        schoolEmail: form.schoolEmail,
        schoolPhone: form.schoolPhone,
        studentName: form.studentName,
        studentId: form.studentId,
        sex: form.sex,
        age: form.age,
        className: form.className,
        session: form.session,
        term: form.term,
        classAvg: form.classAvg,
        daysOpened: form.daysOpened,
        daysPresent: form.daysPresent,
        daysAbsent: form.daysAbsent,
        subjects,
        affective: form.affective,
        psychomotor: form.psychomotor,
        teacherName: form.teacherName,
        headTeacherName: form.headTeacherName,
        teacherRemark: form.teacherRemark,
        headRemark: form.headRemark,
        nextTerm: form.nextTerm,
        promotion: form.promotion,
        positions: form.positions
          ? {
              position: form.positions.position,
              classSize: form.positions.classSize,
              average: form.positions.average,
              subjects: form.positions.subjects,
            }
          : undefined,
        termAverages: form.termAverages,
        cumulativeAverage: form.cumulativeAverage,
        gradeBands: gradeBands || [],
      });
      const fname = `${(form.studentName || "Student").replace(/\s+/g, "_")}_${(form.term || "Report").replace(/\s+/g, "_")}${form.session ? "_" + form.session : ""}.pdf`;
      doc.save(fname);
      toast.success("PDF exported.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export PDF.");
    }
  };

  const meta = [form.studentId, form.className, form.term]
    .filter(Boolean)
    .join(" · ");

  // ── Read-only view (admin): stacked, no wizard ──
  if (readOnly) {
    return (
      <div className="space-y-4">
        <Step1StudentDetails form={form} setField={setField} readOnly />
        <Step2Attendance form={form} setField={setField} readOnly />
        <Step3Subjects
          subjects={subjects}
          subjectStats={form.positions?.subjects || {}}
          availableSubjects={availableSubjects}
          caWeight={caWeight}
          examWeight={examWeight}
          readOnly
          grade={grade}
          onUpdate={updateRow}
          onRemove={removeRow}
          onAddFromCatalog={handleAddFromCatalog}
        />
        <SummaryStrip
          summary={summary}
          studentPosition={form.positions?.position ?? null}
          classSize={form.positions?.classSize ?? null}
        />
        <CumulativeCard
          termAverages={form.termAverages}
          cumulativeAverage={form.cumulativeAverage}
        />
        <Step4Traits form={form} setField={setField} readOnly />
        <Step5Remarks form={form} setField={setField} readOnly />
      </div>
    );
  }

  // ── Wizard mode ──
  return (
    <div className="min-h-screen bg-slate-50">
      <WizardHeader
        studentName={form.studentName}
        meta={meta}
        status="Draft"
        step={step}
        onExit={onExit}
        onExport={exportPDF}
      />

      <div className="mx-auto max-w-3xl px-4 py-5 pb-40">
        {step === 0 && (
          <Step1StudentDetails form={form} setField={setField} readOnly={false} />
        )}
        {step === 1 && (
          <Step2Attendance form={form} setField={setField} readOnly={false} />
        )}
        {step === 2 && (
          <div className="space-y-4">
            <Step3Subjects
              subjects={subjects}
              subjectStats={form.positions?.subjects || {}}
              availableSubjects={availableSubjects}
              caWeight={caWeight}
              examWeight={examWeight}
              readOnly={false}
              grade={grade}
              onUpdate={updateRow}
              onRemove={removeRow}
              onAddFromCatalog={handleAddFromCatalog}
            />
            <SummaryStrip
              summary={summary}
              studentPosition={form.positions?.position ?? null}
              classSize={form.positions?.classSize ?? null}
            />
            <CumulativeCard
              termAverages={form.termAverages}
              cumulativeAverage={form.cumulativeAverage}
            />
          </div>
        )}
        {step === 3 && (
          <Step4Traits form={form} setField={setField} readOnly={false} />
        )}
        {step === 4 && (
          <Step5Remarks form={form} setField={setField} readOnly={false} />
        )}
      </div>

      <WizardFooter
        step={step}
        busy={busy}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onFinish={handleFinish}
        onSaveAndExit={handleSaveAndExit}
      />
    </div>
  );
}