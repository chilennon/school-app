"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { ClassRoom } from "@/types/school";
import { generateBatchReportCards, ReportCardInput } from "@/lib/reportCardPdf";
import { useSchoolConfig } from "@/hooks/useSchoolConfig";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLiveQuery } from "dexie-react-hooks";
import { Loader2 } from "lucide-react";

// 🚨 NEW IMPORTS FOR OFFLINE
import { useDexieBootstrap } from "@/hooks/useDexieBootstrap";
import { teacherRepository } from "@/lib/repositories/teacherRepository";

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
  
  // 1. Ignite the Offline Engine
  const { db, isReady, error } = useDexieBootstrap();

  // Local UI State
  const [mobileTab, setMobileTab] = useState<MobileTab>("home");
  const [submitting, setSubmitting] = useState(false);
  const [rollCallDate, setRollCallDate] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [activeCompilerData, setActiveCompilerData] = useState<{ student: any; classRoom: ClassRoom; } | null>(null);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [confirmReopenOpen, setConfirmReopenOpen] = useState(false);

  // Session Data
  const [userId, setUserId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [teacherName, setTeacherName] = useState("Teacher");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setUserId(data.session.user.id);
        setSchoolId(data.session.user.app_metadata?.school_id || "");
        setTeacherName(data.session.user.user_metadata?.name || "Teacher");
      }
    });
  }, []);

  // 🚨 2. READ DATA FROM DEXIE (With TypeScript Fallbacks)
  const classes = useLiveQuery(() => db ? db.classes.where("teacher_id").equals(userId).toArray() : [], [db, userId]) || [];
  const allStudents = useLiveQuery(() => db ? db.students.toArray() : [], [db]) || [];
  const allEnrolments = useLiveQuery(() => db ? db.enrolments.toArray() : [], [db]) || [];
  const allAttendance = useLiveQuery(() => db ? db.attendance_logs.toArray() : [], [db]) || [];
  const allTerms = useLiveQuery(() => db ? db.terms.toArray() : [], [db]) || [];
  const allSubjects = useLiveQuery(() => db ? db.subjects.toArray() : [], [db]) || [];
  const allGradeBands = useLiveQuery(() => db ? db.grade_bands.toArray() : [], [db]) || [];

  // Set default selected class & term
  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const selectedClass = classes.find(c => c.id === selectedClassId) || null;
  
  useEffect(() => {
    if (selectedClass && allTerms.length > 0 && !selectedTermId) {
      // Find the current term for this session
      const currentTerm = allTerms.find(t => t.is_current);
      if (currentTerm) setSelectedTermId(currentTerm.id);
    }
  }, [selectedClass, allTerms, selectedTermId]);

  // Build the roster for the selected class
  const rosterStudents: StudentInfo[] = useMemo(() => {
    if (!selectedClass || !allEnrolments || !allStudents) return [];
    return allEnrolments
      .filter(e => e.class_id === selectedClass.id && e.status === "active")
      .map(e => {
        const s = allStudents.find(st => st.id === e.student_id);
        if (!s) return null;
        return {
          id: s.id,
          name: s.name,
          reg_no: s.reg_no,
          gender: s.gender,
          age: s.age,
          enrolment_id: e.id,
          assessment: { status: "draft" } as any // Placeholder for compiler state
        };
      })
      .filter(Boolean) as StudentInfo[];
  }, [selectedClass, allEnrolments, allStudents]);

  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
  
  if (!isReady || !db) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
        <p className="text-sm text-slate-500 font-medium">Syncing school data to this device...</p>
      </div>
    );
  }

  const callTeacherApi = async (action: string, payload: any) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const response = await fetch("/api/teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!response.ok) throw new Error((await response.json()).error || "Request failed");
    return response.json();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/sign-in/staff");
  };

  // 🚨 3. OFFLINE WRITE PATH
  const handleSaveAttendance = async (statuses: Record<string, "present" | "absent">): Promise<boolean> => {
    if (!selectedClass || !rollCallDate || !db) return false;
    
    try {
      const entries = Object.entries(statuses).map(([enrolmentId, status]) => ({
        enrolmentId,
        status,
      }));

      await teacherRepository.saveAttendance(db, {
        classId: selectedClass.id,
        date: rollCallDate,
        entries,
        schoolId,
        userId
      });

      toast.success("Attendance saved offline.");
      setRollCallDate(null);
      return true;
    } catch (err: any) {
      toast.error(err.message || "Couldn't save attendance");
      return false;
    }
  };

  const handleSave = async (updatedStudent: any, status: "draft" | "completed") => {
    toast.info("Saving scores online...");
    // We will move this to Dexie repository in the next step
  };

  // ── Roll call (full-screen) ──
  if (rollCallDate && selectedClass) {
    const dateObj = new Date(rollCallDate + "T12:00:00");
    const dateLabel = dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

    const initialStatuses: Record<string, "present" | "absent"> = {};
    allAttendance.filter(r => r.date === rollCallDate).forEach(r => {
      initialStatuses[r.enrolment_id] = r.status;
    });

    return (
      <RollCallScreen
        className={selectedClass.name}
        dateLabel={dateLabel}
        students={rosterStudents.map(s => ({ enrolmentId: s.enrolment_id, name: s.name, regNo: s.reg_no }))}
        initialStatuses={initialStatuses}
        onBack={() => setRollCallDate(null)}
        onSave={handleSaveAttendance}
      />
    );
  }

  // ── Compiler (full-screen) ──
  if (activeCompilerData) {
    return (
      <CompilerView
        student={activeCompilerData.student}
        classRoom={activeCompilerData.classRoom}
        termName={allTerms.find(t => t.id === selectedTermId)?.name || "First"}
        classTerms={allTerms.filter(t => t.session_id === selectedClass?.session_id)}
        selectedTermId={selectedTermId || ""}
        catalogSubjects={allSubjects}
        onBack={() => setActiveCompilerData(null)}
        onAddSubject={async () => null}
        onSaveDraft={(s) => handleSave(s, "draft")}
        onComplete={(s) => handleSave(s, "completed")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-lg mx-auto pb-32">
        {mobileTab === "home" && (
          <HomeTab
            schoolName={config?.name || ""}
            teacherName={teacherName}
            selectedClass={selectedClass}
            selectedTermName={allTerms.find(t => t.id === selectedTermId)?.name || ""}
            assignedClasses={classes}
            onOpenScores={() => setMobileTab("scores")}
            onSelectClass={(cls) => { setSelectedClassId(cls.id); setMobileTab("scores"); }}
          />
        )}

        {mobileTab === "scores" && (
          <ScoresTab
            assignedClasses={classes}
            selectedClass={selectedClass}
            onSelectClass={(c) => setSelectedClassId(c.id)}
            classTerms={allTerms.filter(t => t.session_id === selectedClass?.session_id)}
            selectedTermId={selectedTermId || ""}
            onSelectTerm={setSelectedTermId}
            students={rosterStudents}
            classStatus="draft" // Replace with dynamic status later
            onEnterScores={(s) => setActiveCompilerData({ student: s, classRoom: selectedClass as any })}
            submitting={submitting}
            onBatchPrint={() => {}}
            onSubmit={() => setConfirmSubmitOpen(true)}
            onReopen={() => setConfirmReopenOpen(true)}
          />
        )}

        {mobileTab === "attendance" && (
          <AttendanceTab
            classes={classes}
            selectedClass={selectedClass}
            onSelectClass={(c) => setSelectedClassId(c.id)}
            students={rosterStudents}
            // 🚨 FIX: Map attendance_logs to the AttendanceRow format expected by the component
            attendanceRows={allAttendance.map(a => ({
              enrolmentId: a.enrolment_id,
              date: a.date,
              status: a.status,
              name: allStudents.find(s => s.id === allEnrolments.find(e => e.id === a.enrolment_id)?.student_id)?.name || ""
            }))}
            onStartRollCall={(date) => setRollCallDate(date)}
          />
        )}

        {mobileTab === "profile" && (
          <ProfileTab
            teacherName={teacherName}
            userEmail=""
            onLogout={handleLogout}
          />
        )}
      </main>

      <TeacherBottomNav active={mobileTab} onChange={setMobileTab} />
    </div>
  );
}