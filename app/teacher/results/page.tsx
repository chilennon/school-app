"use client";

import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSchoolConfig } from "@/hooks/useSchoolConfig";
import { generateSingleReportCard } from "@/lib/reportCardPdf";

import { useCompilerForm } from "./_hooks/useCompilerForm";
import { useSubjectRows } from "./_hooks/useSubjectRows";
import { collectSubjects, calculateSummary } from "./_lib/calculations";

import { StepHeader } from "./_components/StepHeader";
import { ActionRow } from "./_components/ActionRow";
import { Step1StudentDetails } from "./_components/Step1StudentDetails";
import { Step2Attendance } from "./_components/Step2Attendance";
import { Step3Subjects } from "./_components/Step3Subjects";
import { SummaryStrip } from "./_components/SummaryStrip";
import { CumulativeCard } from "./_components/CumulativeCard";
import { Step4Traits } from "./_components/Step4Traits";
import { Step5Remarks } from "./_components/Step5Remarks";
import { ExportRow } from "./_components/ExportRow";

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

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

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

  const handleSaveDraft = async (markCompleted = false) => {
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
      status: markCompleted ? "completed" : "draft",
    };

    const updatedStudent = {
      ...initialStudent,
      id: initialStudent.id,
      reg_no: initialStudent.reg_no || form.studentId || initialStudent.id,
      name: form.studentName,
      gender: form.sex,
      age: form.age,
      assessment: updatedAssessment,
    };

    try {
      if (markCompleted) {
        await onComplete?.(updatedStudent);
      } else {
        await onSaveDraft?.(updatedStudent);
      }
      toast.success(
        markCompleted
          ? "Result saved & finalized!"
          : "Draft progress saved successfully!",
      );
    } catch (err: any) {
      console.error("Save threw:", err);
      toast.error(err.message || "Save failed. Please try again.");
    }
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
      toast.success("PDF exported successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export PDF.");
    }
  };

  const handleAddFromCatalog = async (id: string, name: string) => {
    if (!onAddSubject) return;
    const classSubjectId = await onAddSubject(id, name);
    if (classSubjectId) {
      addRow(name);
    }
  };

  // Opens the dialog
  const handleClearAll = () => {
    setConfirmClearOpen(true);
  };

  // Does the work, called by dialog's onConfirm
  const confirmClearAll = () => {
    clearAll();
    replaceAll(
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        sub: "",
        ca: "",
        exam: "",
        sa: "",
      })),
    );
    toast.success("Cleared compiler inputs.");
    setConfirmClearOpen(false);
  };

  const meta = [form.studentId, form.className, form.term]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 pt-4 pb-32">
        {/* Page header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 mb-0.5">
              Result Compiler
            </p>
            <h1 className="text-xl font-bold text-slate-900 truncate">
              {form.studentName || "New Result"}
            </h1>
            {meta && <p className="text-xs text-slate-500 mt-0.5">{meta}</p>}
          </div>
          <Badge variant="secondary" className="shrink-0">
            {readOnly ? "Viewing" : "Draft"}
          </Badge>
        </div>

        <ActionRow readOnly={readOnly} onExport={exportPDF} onClearAll={handleClearAll} />

        <StepHeader>Step 1 — School &amp; Student Details</StepHeader>
        <Step1StudentDetails
          form={form}
          setField={setField}
          readOnly={readOnly}
        />

        <StepHeader>Step 2 — Attendance</StepHeader>
        <Step2Attendance form={form} setField={setField} readOnly={readOnly} />

        <StepHeader>Step 3 — Cognitive Domain</StepHeader>
        <Step3Subjects
          subjects={subjects}
          subjectStats={form.positions?.subjects || {}}
          availableSubjects={availableSubjects}
          caWeight={caWeight}
          examWeight={examWeight}
          readOnly={readOnly}
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

        <StepHeader>Step 4 — Affective &amp; Psychomotor</StepHeader>
        <Step4Traits form={form} setField={setField} readOnly={readOnly} />

        <StepHeader>Step 5 — Remarks &amp; Next Term</StepHeader>
        <Step5Remarks form={form} setField={setField} readOnly={readOnly} />
      </div>

      <ExportRow
        readOnly={readOnly}
        onSaveDraft={() => handleSaveDraft(false)}
        onSubmit={() => handleSaveDraft(true)}
      />

      <ConfirmDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title="Clear all inputs?"
        description="This will reset every field on this page for the current student. Nothing is saved to the server yet, so this can't be undone."
        confirmLabel="Clear All"
        destructive
        onConfirm={confirmClearAll}
      />
    </div>
  );
}
