"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { ClassRoom } from "@/types/school";
import { generateBatchReportCards, ReportCardInput } from "@/lib/reportCardPdf";
import { useSchoolConfig } from "@/hooks/useSchoolConfig";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import { useTeacherSession } from "./_hooks/useTeacherSession";
import { useTeacherClasses } from "./_hooks/useTeacherClasses";
import { useClassRoster } from "./_hooks/useClassRoster";
import { useAttendance } from "./_hooks/useAttendance";
import { saveResultToSupabase } from "./_hooks/useSaveResult";

import { TeacherBottomNav } from "./_components/TeacherBottomNav";
import { HomeTab } from "./_components/tabs/HomeTab";
import { ScoresTab } from "./_components/tabs/ScoresTab";
import { AttendanceTab } from "./_components/tabs/AttendanceTab";
import { ProfileTab } from "./_components/tabs/ProfileTab";
import { CompilerView } from "./_components/CompilerView";
import { RollCallScreen } from "./_components/attendance/RollCallScreen";

import type { MobileTab, StudentInfo } from "./_lib/types";
import { EMPTY_AFFECTIVE, EMPTY_PSYCHOMOTOR } from "./_lib/constants";

export default function TeacherDashboardPage() {
  const router = useRouter();
  const { config } = useSchoolConfig();

  const session = useTeacherSession();
  const classesData = useTeacherClasses(session.userId);

  // IMPORTANT: roster must be defined BEFORE useAttendance reads from it.
  const roster = useClassRoster(classesData.classes);
  const attendance = useAttendance(roster.selectedClass?.id ?? null);

  const [mobileTab, setMobileTab] = useState<MobileTab>("home");
  const [submitting, setSubmitting] = useState(false);
  const [rollCallDate, setRollCallDate] = useState<string | null>(null);
  const [activeCompilerData, setActiveCompilerData] = useState<{
    student: any;
    classRoom: ClassRoom;
  } | null>(null);

  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [confirmReopenOpen, setConfirmReopenOpen] = useState(false);

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  const callTeacherApi = async (action: string, payload: any) => {
    const token = await getAccessToken();
    const response = await fetch("/api/teacher", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Request failed");
    }
    return response.json();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/sign-in/staff");
  };

  const handleEnterScores = (student: StudentInfo) => {
    if (!roster.selectedClass || !roster.selectedTermId) return;

    const st = student.assessment?.status || "draft";
    if (st === "submitted") {
      toast.info("This student's result has already been submitted for approval.");
      return;
    }
    if (st === "approved") {
      toast.info("This student's result has been approved and locked.");
      return;
    }

    const formattedStudent = {
      id: student.id,
      reg_no: student.reg_no || student.id,
      name: student.name,
      gender: student.gender || "",
      age: student.age || "",
      enrolment_id: student.enrolment_id,
      assessment: student.assessment || {
        schoolName: config?.name || "",
        schoolAddress: config?.address || "",
        schoolEmail: "",
        schoolPhone: config?.phone || "",
        daysOpened: "",
        daysPresent: "",
        daysAbsent: "",
        subjects: [],
        affective: { ...EMPTY_AFFECTIVE },
        psychomotor: { ...EMPTY_PSYCHOMOTOR },
        teacherName: session.teacherName || "",
        headTeacherName: "",
        teacherRemark: "",
        headRemark: "",
        nextTerm: "",
        promotion: "",
        classAvg: "",
        status: "not_started",
      },
    };

    const formattedClassRoom: ClassRoom = {
      id: roster.selectedClass.id,
      name: roster.selectedClass.name,
      session: roster.selectedClass.session,
      assignedTeacherId: null,
      studentIds: roster.students.map((s) => s.id),
    };

    setActiveCompilerData({
      student: formattedStudent,
      classRoom: formattedClassRoom,
    });
  };

  const handleAddSubjectToClass = async (
    subjectId: string,
    subjectName: string,
  ): Promise<string | null> => {
    if (!roster.selectedClass) return null;
    try {
      const result = await callTeacherApi("add-class-subject", {
        classId: roster.selectedClass.id,
        subjectId,
      });
      if (result.classSubjectId) {
        roster.addSubjectLocally(subjectName, result.classSubjectId);
        return result.classSubjectId;
      }
      return null;
    } catch (err: any) {
      toast.error(err.message || "Couldn't add subject");
      return null;
    }
  };

  // ── Attendance ──
  const handleSaveAttendance = async (
    statuses: Record<string, "present" | "absent">,
  ): Promise<boolean> => {
    if (!roster.selectedClass || !rollCallDate) return false;
    try {
      const entries = Object.entries(statuses).map(([enrolmentId, status]) => ({
        enrolmentId,
        status,
      }));

      await callTeacherApi("save-attendance", {
        classId: roster.selectedClass.id,
        date: rollCallDate,
        entries,
      });

      toast.success("Attendance saved.");
      await attendance.refresh();
      setRollCallDate(null);
      return true;
    } catch (err: any) {
      toast.error(err.message || "Couldn't save attendance");
      return false;
    }
  };

  // ── Submit / Reopen ──
  const handleSubmitClassResults = () => {
    if (!roster.selectedClass || !roster.selectedTermId) return;
    setConfirmSubmitOpen(true);
  };

  const confirmSubmitClassResults = async () => {
    if (!roster.selectedClass || !roster.selectedTermId) return;

    setSubmitting(true);
    try {
      await callTeacherApi("submit-class-results", {
        classId: roster.selectedClass.id,
        termId: roster.selectedTermId,
      });
      await roster.refresh();
      toast.success("Results submitted for approval.");
      setConfirmSubmitOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopenClassResults = () => {
    if (!roster.selectedClass || !roster.selectedTermId) return;
    setConfirmReopenOpen(true);
  };

  const confirmReopenClassResults = async () => {
    if (!roster.selectedClass || !roster.selectedTermId) return;

    setSubmitting(true);
    try {
      await callTeacherApi("reopen-class-results", {
        classId: roster.selectedClass.id,
        termId: roster.selectedTermId,
      });
      await roster.refresh();
      toast.success("Class reopened for editing.");
      setConfirmReopenOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Couldn't reopen class");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Batch print ──
  const handleBatchPrint = () => {
    if (
      !roster.selectedClass ||
      !roster.selectedTermId ||
      roster.students.length === 0
    )
      return;
    if (!classesData.gradeBands || classesData.gradeBands.length === 0) {
      toast.info(
        "School config not loaded yet. Please wait a moment and try again.",
      );
      return;
    }

    const termName =
      roster.classTerms.find((t) => t.id === roster.selectedTermId)?.name ||
      "Term";

    const items: ReportCardInput[] = roster.students.map((s) => {
      const asm = s.assessment || {};
      return {
        schoolName: asm.schoolName || config?.name || "",
        schoolAddress: asm.schoolAddress || config?.address || "",
        schoolEmail: asm.schoolEmail || "",
        schoolPhone: asm.schoolPhone || config?.phone || "",
        studentName: s.name,
        studentId: s.reg_no || s.id,
        sex: s.gender || "",
        age: s.age || "",
        className: roster.selectedClass!.name,
        session: roster.selectedClass!.session,
        term: `${termName} Term`,
        classAvg: asm.classAvg || "",
        daysOpened: asm.daysOpened || "",
        daysPresent: asm.daysPresent || "",
        daysAbsent: asm.daysAbsent || "",
        subjects: asm.subjects || [],
        affective: asm.affective || {},
        psychomotor: asm.psychomotor || {},
        teacherName: asm.teacherName || session.teacherName || "",
        headTeacherName: asm.headTeacherName || "",
        teacherRemark: asm.teacherRemark || "",
        headRemark: asm.headRemark || "",
        nextTerm: asm.nextTerm || "",
        promotion: asm.promotion || "",
        positions: asm.positions,
        termAverages: asm.termAverages,
        cumulativeAverage: asm.cumulativeAverage,
        gradeBands: classesData.gradeBands,
      };
    });

    const doc = generateBatchReportCards(items);
    const safe = (s: string) => s.replace(/\s+/g, "_");
    doc.save(
      `${safe(roster.selectedClass.name)}_${safe(termName)}_Term_ReportCards.pdf`,
    );
  };

  const handleSave = async (
    updatedStudent: any,
    status: "draft" | "completed",
  ) => {
    const saved = await saveResultToSupabase({
      schoolId: session.schoolId,
      subjectMap: roster.subjectMap,
      termId: roster.selectedTermId,
      enrolmentId: activeCompilerData?.student?.enrolment_id,
      studentId: updatedStudent?.id || activeCompilerData?.student?.id,
      updatedStudent,
      status,
    });

    roster.patchStudent(saved.id, saved);
    setActiveCompilerData((prev) =>
      prev ? { ...prev, student: { ...prev.student, ...saved } } : prev,
    );
  };

  if (session.loading || classesData.loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-3 w-24 mt-6" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </main>
      </div>
    );
  }

  // ── Roll call (full-screen, hides bottom nav) ──
  if (rollCallDate && roster.selectedClass) {
    const dateObj = new Date(rollCallDate + "T12:00:00");
    const dateLabel = dateObj.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    const initialStatuses: Record<string, "present" | "absent"> = {};
    attendance.rows
      .filter((r) => r.date === rollCallDate)
      .forEach((r) => {
        initialStatuses[r.enrolmentId] = r.status;
      });

    const rollCallStudents = roster.students.map((s) => ({
      enrolmentId: s.enrolment_id,
      name: s.name,
      regNo: s.reg_no,
    }));

    return (
      <RollCallScreen
        className={roster.selectedClass.name}
        dateLabel={dateLabel}
        students={rollCallStudents}
        initialStatuses={initialStatuses}
        onBack={() => setRollCallDate(null)}
        onSave={handleSaveAttendance}
      />
    );
  }

  // ── Compiler (full-screen, hides bottom nav) ──
  if (activeCompilerData) {
    return (
      <CompilerView
        student={activeCompilerData.student}
        classRoom={activeCompilerData.classRoom}
        termName={
          roster.classTerms.find((t) => t.id === roster.selectedTermId)?.name ||
          "First"
        }
        classTerms={roster.classTerms}
        selectedTermId={roster.selectedTermId}
        catalogSubjects={classesData.catalogSubjects}
        onBack={() => setActiveCompilerData(null)}
        onAddSubject={handleAddSubjectToClass}
        onSaveDraft={(s) => handleSave(s, "draft")}
        onComplete={(s) => handleSave(s, "completed")}
      />
    );
  }

  const selectedTermName =
    roster.classTerms.find((t) => t.id === roster.selectedTermId)?.name || "";

  const submitDescription = roster.selectedClass
    ? `Submit ${roster.selectedClass.name} — ${selectedTermName || "this"} Term results for review?\n\nOnce submitted, you cannot edit scores until the head teacher either approves them or reopens the class.`
    : "";

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-lg mx-auto">
        {mobileTab === "home" && (
          <HomeTab
            schoolName={config?.name || ""}
            teacherName={session.teacherName}
            selectedClass={roster.selectedClass}
            selectedTermName={selectedTermName}
            assignedClasses={classesData.classes}
            onOpenScores={() => setMobileTab("scores")}
            onSelectClass={(cls) => {
              roster.selectClass(cls);
              setMobileTab("scores");
            }}
          />
        )}

        {mobileTab === "scores" && (
          <ScoresTab
            assignedClasses={classesData.classes}
            selectedClass={roster.selectedClass}
            onSelectClass={roster.selectClass}
            classTerms={roster.classTerms}
            selectedTermId={roster.selectedTermId}
            onSelectTerm={roster.selectTerm}
            students={roster.students}
            classStatus={roster.classStatus}
            onEnterScores={handleEnterScores}
            submitting={submitting}
            onBatchPrint={handleBatchPrint}
            onSubmit={handleSubmitClassResults}
            onReopen={handleReopenClassResults}
          />
        )}

        {mobileTab === "attendance" && (
          <AttendanceTab
            classes={classesData.classes}
            selectedClass={roster.selectedClass}
            onSelectClass={roster.selectClass}
            students={roster.students}
            attendanceRows={attendance.rows}
            onStartRollCall={(date) => setRollCallDate(date)}
          />
        )}

        {mobileTab === "profile" && (
          <ProfileTab
            teacherName={session.teacherName}
            userEmail={session.userEmail}
            onLogout={handleLogout}
          />
        )}
      </main>

      <TeacherBottomNav active={mobileTab} onChange={setMobileTab} />

      <ConfirmDialog
        open={confirmSubmitOpen}
        onOpenChange={setConfirmSubmitOpen}
        title="Submit results for approval?"
        description={submitDescription}
        confirmLabel="Submit"
        onConfirm={confirmSubmitClassResults}
        loading={submitting}
      />

      <ConfirmDialog
        open={confirmReopenOpen}
        onOpenChange={setConfirmReopenOpen}
        title="Reopen this class?"
        description="This will send all submitted results back to draft so you can edit scores again."
        confirmLabel="Reopen"
        destructive
        onConfirm={confirmReopenClassResults}
        loading={submitting}
      />
    </div>
  );
}