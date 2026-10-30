"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { ClassRoom } from "@/types/school";
import { useSchoolConfig } from "@/hooks/useSchoolConfig";
import { useLiveQuery } from "dexie-react-hooks";
import { Loader2, CloudOff } from "lucide-react";

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

export default function TeacherDashboardPage() {
  const router = useRouter();
  const { config } = useSchoolConfig();
  const { db, isReady, error } = useDexieBootstrap();

  const [mobileTab, setMobileTab] = useState<MobileTab>("home");
  const [submitting, setSubmitting] = useState(false);
  const [rollCallDate, setRollCallDate] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  
  // 🚨 ADDED: readOnly to state
  const [activeCompilerData, setActiveCompilerData] = useState<{
    student: any;
    classRoom: ClassRoom;
    readOnly: boolean;
  } | null>(null);

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

  // 🚨 READ FROM DEXIE
  const classes =
    useLiveQuery(
      () => (db ? db.classes.where("teacher_id").equals(userId).toArray() : []),
      [db, userId],
    ) || [];
  const allStudents =
    useLiveQuery(() => (db ? db.students.toArray() : []), [db]) || [];
  const allEnrolments =
    useLiveQuery(() => (db ? db.enrolments.toArray() : []), [db]) || [];
  const allAttendance =
    useLiveQuery(() => (db ? db.attendance_logs.toArray() : []), [db]) || [];
  const allTerms =
    useLiveQuery(() => (db ? db.terms.toArray() : []), [db]) || [];
  const allSubjects =
    useLiveQuery(() => (db ? db.subjects.toArray() : []), [db]) || [];
  const allClassSubjects =
    useLiveQuery(() => (db ? db.class_subjects.toArray() : []), [db]) || [];
  const allTermRecords = 
    useLiveQuery(() => db ? db.term_records.toArray() : [], [db]) || [];

  // 🚨 OUTBOX BADGE
  const pendingSyncs =
    useLiveQuery(
      () => (db ? db.outbox.where("status").equals("pending").count() : 0),
      [db],
    ) || 0;

  useEffect(() => {
    if (classes.length > 0 && !selectedClassId)
      setSelectedClassId(classes[0].id);
  }, [classes, selectedClassId]);

  const selectedClass = classes.find((c) => c.id === selectedClassId) || null;

  useEffect(() => {
    if (selectedClass && allTerms.length > 0 && !selectedTermId) {
      const currentTerm = allTerms.find((t) => t.is_current);
      if (currentTerm) setSelectedTermId(currentTerm.id);
    }
  }, [selectedClass, allTerms, selectedTermId]);

  const rosterStudents: StudentInfo[] = useMemo(() => {
    if (!selectedClass || !allEnrolments || !allStudents) return [];
    return allEnrolments
      .filter(e => e.class_id === selectedClass.id && e.status === "active")
      .map(e => {
        const s = allStudents.find(st => st.id === e.student_id);
        if (!s) return null;
        
        // Find the actual status from Dexie
        const termRecord = allTermRecords.find(tr => tr.enrolment_id === e.id && tr.term_id === selectedTermId);
        const actualStatus = termRecord?.status || "draft";
        
        return { 
          id: s.id, 
          name: s.name, 
          reg_no: s.reg_no, 
          gender: s.gender, 
          age: s.age, 
          enrolment_id: e.id, 
          assessment: { status: actualStatus } as any 
        };
      }).filter(Boolean) as StudentInfo[];
  }, [selectedClass, allEnrolments, allStudents, allTermRecords, selectedTermId]);

  // 🚨 SUBJECT NAME → UUID MAP (for fallback during save)
  const subjectMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (!selectedClass) return map;

    const classSubs = allClassSubjects.filter(
      (cs) => cs.class_id === selectedClass.id,
    );
    classSubs.forEach((cs) => {
      const subj = allSubjects.find((s) => s.id === cs.subject_id);
      if (subj) map[subj.name] = cs.id;
    });

    return map;
  }, [selectedClass, allClassSubjects, allSubjects]);

  // 🚨 DEDUPLICATE SUBJECTS AND ATTACH UUID
  const uniqueClassSubjects = useMemo(() => {
    if (!selectedClass) return [];

    const classSubs = allClassSubjects.filter(
      (cs) => cs.class_id === selectedClass.id,
    );
    const seen = new Set<string>();
    const result: { id: string; name: string; class_subject_id: string }[] = [];

    for (const cs of classSubs) {
      if (seen.has(cs.subject_id)) continue;
      seen.add(cs.subject_id);

      const subj = allSubjects.find((s) => s.id === cs.subject_id);
      if (subj) {
        result.push({
          id: subj.id,
          name: subj.name,
          class_subject_id: cs.id,
        });
      }
    }

    return result;
  }, [selectedClass, allClassSubjects, allSubjects]);

  // 🚨 EARLY RETURNS
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
  if (!isReady || !db)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
        <p className="text-sm text-slate-500 font-medium">Syncing...</p>
      </div>
    );

  // 🚨 HANDLERS
  const handleSaveAttendance = async (
    statuses: Record<string, "present" | "absent">,
  ): Promise<boolean> => {
    if (!selectedClass || !rollCallDate || !db) return false;
    try {
      await teacherRepository.saveAttendance(db, {
        classId: selectedClass.id,
        date: rollCallDate,
        entries: Object.entries(statuses).map(([id, status]) => ({
          enrolmentId: id,
          status,
        })),
        schoolId,
        userId,
      });
      toast.success("Attendance saved offline.");
      setRollCallDate(null);
      return true;
    } catch (err: any) {
      toast.error(err.message);
      return false;
    }
  };

  const handleEnterScores = async (student: StudentInfo) => {
    if (!db || !selectedTermId || !selectedClass) return;

    try {
      const rawScores = await db.scores
        .where({ enrolment_id: student.enrolment_id, term_id: selectedTermId })
        .toArray();
      const traits = await db.trait_ratings
        .where({ enrolment_id: student.enrolment_id, term_id: selectedTermId })
        .toArray();
      const termRecord = await db.term_records
        .where({ enrolment_id: student.enrolment_id, term_id: selectedTermId })
        .first();

      // 🚨 FIX: Use the status from the roster directly. 
      // If it's not "draft", it's read-only.
      const isReadOnly = student.assessment?.status !== "draft" && student.assessment?.status !== "not_started";

      // Deduplicate scores
      const uniqueScoresMap = new Map();
      rawScores.forEach((s) => uniqueScoresMap.set(s.class_subject_id, s));
      const uniqueScores = Array.from(uniqueScoresMap.values());

      const assessment = {
        status: student.assessment?.status || "draft",
        subjects: uniqueScores.map((s) => {
          // ... same as before
          const classSub = allClassSubjects.find((cs) => cs.id === s.class_subject_id);
          const subject = allSubjects.find((subj) => subj.id === classSub?.subject_id);
          return {
            class_subject_id: s.class_subject_id,
            sub: subject?.name || "",
            ca: s.ca_score?.toString() || "",
            exam: s.exam_score?.toString() || "",
            sa: s.sa_score?.toString() || "",
          };
        }),
        affective: traits.filter((t) => t.trait_domain === "affective").reduce((acc, t) => ({ ...acc, [t.trait_key]: t.rating?.toString() || "" }), {}),
        psychomotor: traits.filter((t) => t.trait_domain === "psychomotor").reduce((acc, t) => ({ ...acc, [t.trait_key]: t.rating?.toString() || "" }), {}),
        daysOpened: termRecord?.days_opened?.toString() || "",
        daysPresent: termRecord?.days_present?.toString() || "",
        daysAbsent: termRecord?.days_absent?.toString() || "",
        teacherRemark: termRecord?.class_teacher_comment || "",
        headRemark: termRecord?.head_teacher_comment || "",
        schoolName: config?.name || "",
        schoolAddress: config?.address || "",
        schoolEmail: "",
        schoolPhone: config?.phone || "",
        teacherName: teacherName,
        headTeacherName: "",
        nextTerm: "",
        promotion: "",
        classAvg: "",
      };

      const uiClassRoom: ClassRoom = {
        id: selectedClass.id,
        name: selectedClass.name,
        session: selectedClass.session || "",
        assignedTeacherId: selectedClass.teacher_id || null,
        studentIds: rosterStudents.map((s) => s.id),
      };

      setActiveCompilerData({
        student: { ...student, assessment },
        classRoom: uiClassRoom,
        readOnly: isReadOnly, // 🚨 Pass the calculated flag
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to load student data from device.");
    }
  };

  const handleSave = async (
    updatedStudent: any,
    status: "draft" | "completed",
  ) => {
    if (!db)
      throw new Error("Offline database not ready. Try again in a moment.");
    if (!selectedClass) throw new Error("No class selected.");
    if (!selectedTermId) throw new Error("No term selected.");
    if (!activeCompilerData) throw new Error("No student selected.");

    await teacherRepository.saveTermResult(db, {
      classId: selectedClass.id,
      enrolmentId: activeCompilerData.student.enrolment_id,
      studentId: activeCompilerData.student.id,
      termId: selectedTermId,
      updatedStudent,
      status,
      schoolId,
      userId,
    });
  };

  const handleSubmitClass = async () => {
    if (!db || !selectedClass || !selectedTermId) return;
    
    setSubmitting(true);
    try {
      await teacherRepository.submitClassResults(db, {
        classId: selectedClass.id,
        termId: selectedTermId,
        sessionId: selectedClass.session_id || "",
        schoolId,
        userId,
      });
      toast.success("Class results submitted for approval!");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to submit class results.");
    } finally {
      setSubmitting(false);
    }
  };

  if (rollCallDate && selectedClass) {
    const dateObj = new Date(rollCallDate + "T12:00:00");
    const initialStatuses: Record<string, "present" | "absent"> = {};
    allAttendance
      .filter((r) => r.date === rollCallDate)
      .forEach((r) => {
        initialStatuses[r.enrolment_id] = r.status;
      });
    return (
      <RollCallScreen
        className={selectedClass.name}
        dateLabel={dateObj.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })}
        students={rosterStudents.map((s) => ({
          enrolmentId: s.enrolment_id,
          name: s.name,
          regNo: s.reg_no,
        }))}
        initialStatuses={initialStatuses}
        onBack={() => setRollCallDate(null)}
        onSave={handleSaveAttendance}
      />
    );
  }

  if (activeCompilerData) {
    return (
      <CompilerView
        student={activeCompilerData.student}
        classRoom={activeCompilerData.classRoom}
        termName={
          allTerms.find((t) => t.id === selectedTermId)?.name || "First"
        }
        classTerms={allTerms.filter(
          (t) => t.session_id === selectedClass?.session_id,
        )}
        selectedTermId={selectedTermId || ""}
        catalogSubjects={uniqueClassSubjects}
        readOnly={activeCompilerData.readOnly} // 🚨 PASS PROP HERE
        onBack={() => setActiveCompilerData(null)}
        onSaveDraft={(s) => handleSave(s, "draft")}
        onComplete={(s) => handleSave(s, "completed")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {pendingSyncs > 0 && (
        <div className="bg-orange-500 text-white text-xs font-bold text-center py-1.5 flex items-center justify-center gap-1.5">
          <CloudOff className="w-3.5 h-3.5" /> {pendingSyncs} record
          {pendingSyncs !== 1 ? "s" : ""} waiting to sync
        </div>
      )}
      <main className="max-w-lg mx-auto pb-32">
        {mobileTab === "home" && (
          <HomeTab
            schoolName={config?.name || ""}
            teacherName={teacherName}
            selectedClass={selectedClass}
            selectedTermName={
              allTerms.find((t) => t.id === selectedTermId)?.name || ""
            }
            assignedClasses={classes}
            onOpenScores={() => setMobileTab("scores")}
            onSelectClass={(cls) => {
              setSelectedClassId(cls.id);
              setMobileTab("scores");
            }}
          />
        )}
        {mobileTab === "scores" && (
          <ScoresTab
            assignedClasses={classes}
            selectedClass={selectedClass}
            onSelectClass={(c) => setSelectedClassId(c.id)}
            classTerms={allTerms.filter(
              (t) => t.session_id === selectedClass?.session_id,
            )}
            selectedTermId={selectedTermId || ""}
            onSelectTerm={setSelectedTermId}
            students={rosterStudents}
            classStatus="draft"
            onEnterScores={handleEnterScores}
            submitting={submitting}
            onBatchPrint={() => {}}
            onSubmit={handleSubmitClass}
            onReopen={() => {}}
          />
        )}
        {mobileTab === "attendance" && (
          <AttendanceTab
            classes={classes}
            selectedClass={selectedClass}
            onSelectClass={(c) => setSelectedClassId(c.id)}
            students={rosterStudents}
            attendanceRows={allAttendance.map((a) => ({
              enrolmentId: a.enrolment_id,
              date: a.date,
              status: a.status,
              name:
                allStudents.find(
                  (s) =>
                    s.id ===
                    allEnrolments.find((e) => e.id === a.enrolment_id)
                      ?.student_id,
                )?.name || "",
            }))}
            onStartRollCall={(date) => setRollCallDate(date)}
          />
        )}
        {mobileTab === "profile" && (
          <ProfileTab
            teacherName={teacherName}
            userEmail=""
            onLogout={async () => {
              await supabase.auth.signOut();
              router.push("/sign-in/staff");
            }}
          />
        )}
      </main>
      <TeacherBottomNav active={mobileTab} onChange={setMobileTab} />
    </div>
  );
}