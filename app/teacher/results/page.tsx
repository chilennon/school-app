"use client";

import React, { useState, useMemo } from "react";
import "./SchoolResult.css";
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
import { Toast } from "./_components/Toast";

import type {
  GradeResult,
  ResultsPageProps,
  StudentAssessment,
  ToastState,
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
  const { subjects, replaceAll, removeRow, updateRow, addRow } = useSubjectRows(
    initialStudent,
  );

  const [toast, setToast] = useState<ToastState>({
    message: "",
    type: "",
    show: false,
  });

  const caWeight = config?.ca_weight ?? 40;
  const examWeight = config?.exam_weight ?? 60;

  const grade = (score: number | null): GradeResult => gradeFor(score);

  // Derived
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

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ message: msg, type, show: true });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 3500);
  };

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
      showToast(
        markCompleted
          ? "Result saved & finalized!"
          : "Draft progress saved successfully!",
        "success",
      );
    } catch (err: any) {
      console.error("Save threw:", err);
      showToast(err.message || "Save failed. Please try again.", "error");
    }
  };

  const exportPDF = () => {
    if (!form.studentName) {
      showToast("Please enter the student name.", "error");
      return;
    }
    if (processed.length === 0) {
      showToast("Please add at least one subject with scores.", "error");
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
      showToast("✅ PDF exported successfully!", "success");
    } catch (err: any) {
      console.error(err);
      showToast("Failed to export PDF.", "error");
    }
  };

  const handleAddFromCatalog = async (id: string, name: string) => {
    if (!onAddSubject) return;
    const classSubjectId = await onAddSubject(id, name);
    if (classSubjectId) {
      addRow(name);
    }
  };

  const handleClearAll = () => {
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
    showToast("Cleared compiler inputs.", "success");
  };

  return (
    <div className={`school-result ${readOnly ? "readonly" : ""}`}>
      <header>
        <div className="logo">🎓</div>
        <div>
          <h1>Result Compiler</h1>
          <p>
            {readOnly ? "Viewing" : "Editing"}: {form.studentName}
          </p>
        </div>
      </header>

      <div className="container">
        <ActionRow
          readOnly={readOnly}
          onSaveDraft={() => handleSaveDraft(false)}
          onExport={exportPDF}
        />

        <StepHeader>Step 1 — School & Student Details</StepHeader>
        <Step1StudentDetails form={form} setField={setField} readOnly={readOnly} />

        <StepHeader>Step 2 — Attendance</StepHeader>
        <Step2Attendance form={form} setField={setField} readOnly={readOnly} />

        <StepHeader>
          Step 3 — Cognitive Domain (Subjects & Scores)
        </StepHeader>
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

        <StepHeader>
          Step 4 — Affective Domain & Psychomotor Skills
        </StepHeader>
        <Step4Traits form={form} setField={setField} readOnly={readOnly} />

        <StepHeader>Step 5 — Remarks & Next Term</StepHeader>
        <Step5Remarks form={form} setField={setField} readOnly={readOnly} />

        <ExportRow
          readOnly={readOnly}
          onClearAll={handleClearAll}
          onSaveDraft={() => handleSaveDraft(false)}
          onExport={exportPDF}
        />
      </div>

      <Toast toast={toast} />
    </div>
  );
}