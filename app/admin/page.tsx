"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import ResultsPage from "../teacher/results/page";
import SettingsTab from "./SettingsTab";
import { generateBatchReportCards, ReportCardInput } from "@/lib/reportCardPdf";
import { useCurrentTerm } from "@/hooks/useCurrentTerm";
import { useSchoolConfig } from "@/hooks/useSchoolConfig";
import { computeTermAverages } from "@/lib/termAverages";

import { useAdminData } from "./_hooks/useAdminData";
import { useApprovals } from "./_hooks/useApprovals";
import { useActivityFeed } from "./_hooks/useActivityFeed";
import { fetchResultForView } from "./_lib/fetchResultForView";

import { AdminBottomNav } from "./_components/AdminBottomNav";
import { ActivityFeed } from "./_components/ActivityFeed";
import { SectionHeader } from "./_components/SectionHeader";
import { HomeTab } from "./_components/tabs/HomeTab";
import { StudentsTab } from "./_components/tabs/StudentsTab";
import { ApprovalsTab } from "./_components/tabs/ApprovalsTab";
import { MoreTab } from "./_components/tabs/MoreTab";
import { TeachersSection } from "./_components/sections/TeachersSection";
import { AdminsSection } from "./_components/sections/AdminsSection";
import { SubjectsSection } from "./_components/sections/SubjectsSection";
import { ClassesSection } from "./_components/sections/ClassesSection";

import type { AdminView, PendingClass, ReviewStudent } from "./_lib/types";

const MAIN_TABS: AdminView[] = ["home", "students", "approvals", "more"];

/**
 * Every confirmation on the page is expressed as one of these.
 * One state object → one ConfirmDialog. Add a case here, add a
 * handler case in `runConfirm`, and it works everywhere.
 */
type ConfirmAction =
  | { kind: "delete-student"; id: string }
  | { kind: "delete-teacher"; id: string; name: string }
  | { kind: "delete-class"; id: string; name: string }
  | { kind: "force-delete-subject"; id: string; name: string }
  | {
      kind: "reopen-student";
      enrolmentId: string;
      termId: string;
      name: string;
    }
  | { kind: "approve-all"; termId: string; count: number }
  | { kind: "reset-password"; id: string; name: string };

function describeConfirm(
  action: ConfirmAction,
  bulkComment: string,
): {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
} {
  switch (action.kind) {
    case "delete-student":
      return {
        title: "Delete this student?",
        description:
          "Their enrolment and any scores recorded for them will be removed. This can't be undone.",
        confirmLabel: "Delete",
        destructive: true,
      };
    case "delete-teacher":
      return {
        title: "Delete this teacher?",
        description:
          "Their account and any class assignments will be removed. This can't be undone.",
        confirmLabel: "Delete",
        destructive: true,
      };
    case "delete-class":
      return {
        title: "Delete this class?",
        description:
          "Students and teachers in this class will be unassigned. This can't be undone.",
        confirmLabel: "Delete",
        destructive: true,
      };
    case "force-delete-subject":
      return {
        title: `Delete "${action.name}"?`,
        description:
          "This subject is used in classes and has recorded scores. Deleting it will remove those scores. This can't be undone.",
        confirmLabel: "Delete Anyway",
        destructive: true,
      };
    case "reopen-student":
      return {
        title: "Send this result back?",
        description: `${action.name}'s result will return to draft so the teacher can edit it again.`,
        confirmLabel: "Send Back",
        destructive: true,
      };
    case "approve-all":
      return {
        title: "Approve all submitted results?",
        description:
          `You're about to approve ${action.count} submitted result${action.count === 1 ? "" : "s"}.` +
          (bulkComment ? `\n\nHead teacher comment: "${bulkComment}"` : ""),
        confirmLabel: "Approve All",
        destructive: false,
      };
    case "reset-password":
      return {
        title: "Reset this person's password?",
        description: `${action.name} will be signed out and given a new passcode. Their current password will stop working immediately. This cannot be undone.`,
        confirmLabel: "Reset Password",
        destructive: true,
      };
  }
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { session: currentSession, term: currentTerm } = useCurrentTerm();
  const { config } = useSchoolConfig();
  const data = useAdminData();
  const approvals = useApprovals();
  const activity = useActivityFeed();

  const [adminName, setAdminName] = useState("");
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [view, setView] = useState<AdminView>("home");
  const [activityOpen, setActivityOpen] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<{
    student: any;
    classRoom: any;
  } | null>(null);

  // Approvals UI state
  const [bulkComment, setBulkComment] = useState("");
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [busyEnrolmentId, setBusyEnrolmentId] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    pin: string;
    title: string;
    description?: string;
  } | null>(null);

  // One dialog, one state, one busy flag
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Load admin name once
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/sign-in/staff");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();
      if (profile) setAdminName(profile.name);
      setCurrentAdminId(user.id);
    })();
  }, [router]);

  // Load approvals when tab opens
  useEffect(() => {
    if (view === "approvals") approvals.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  const callAdminApi = async (action: string, payload: any) => {
    const token = await getToken();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Request failed");
    }
    return res.json();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/sign-in/staff");
  };

  // ── Immediate actions (no confirmation) ──

  const handleSaveStudent = async (input: {
    id?: string;
    name: string;
    regNo: string;
    classId: string;
    gender: string;
    age: string;
  }) => {
    const action = input.id ? "update-student" : "create-student";
    await callAdminApi(action, {
      id: input.id,
      name: input.name,
      reg_no: input.regNo,
      class_id: input.classId || null,
      gender: input.gender,
      age: input.age,
    });
    await data.refresh();
    toast.success(input.id ? "Student updated." : "Student added.");
  };

  const handleCreateTeacher = async (name: string, email: string) => {
    try {
      const result = await callAdminApi("create-teacher", { name, email });
      setCreatedCredentials({
        email: result.email,
        pin: result.pin,
        title: "Teacher Account Created",
      });
      await data.refresh();
      toast.success("Teacher account created.");
    } catch (err: any) {
      toast.error(err.message || "Couldn't create teacher");
    }
  };

  const handleUpdateTeacher = async (
    id: string,
    name: string,
    email: string,
  ) => {
    try {
      await callAdminApi("update-teacher", { id, name, email });
      await data.refresh();
      toast.success("Teacher updated.");
    } catch (err: any) {
      toast.error(err.message || "Couldn't update teacher");
    }
  };

  const handleCreateAdmin = async (name: string, email: string) => {
    try {
      const result = await callAdminApi("create-admin", { name, email });
      setCreatedCredentials({
        email: result.email,
        pin: result.pin,
        title: "Admin Account Created",
      });
      await data.refresh();
      toast.success("Admin account created.");
    } catch (err: any) {
      toast.error(err.message || "Couldn't create admin");
    }
  };

  const handleAddSubject = async (name: string) => {
    try {
      await callAdminApi("add-subject", { name });
      await data.refresh();
      toast.success("Subject added.");
    } catch (err: any) {
      toast.error(err.message || "Couldn't add subject");
    }
  };

  const handleDeleteSubject = async (id: string, name: string) => {
    const first = await callAdminApi("delete-subject", { id }).catch((err) => ({
      error: err.message,
      requiresForce: true,
    }));
    if (first?.error && first?.requiresForce) {
      setConfirmAction({ kind: "force-delete-subject", id, name });
      return;
    }
    if (first?.error) {
      toast.error(first.error);
      return;
    }
    await data.refresh();
    toast.success("Subject deleted.");
  };

  const handleSaveClass = async (input: {
    id?: string;
    name: string;
    session: string;
    subjectIds: string[];
  }) => {
    try {
      if (input.id) {
        await callAdminApi("update-class", {
          id: input.id,
          name: input.name,
          session: input.session,
        });
        await callAdminApi("set-class-subjects", {
          classId: input.id,
          subjectIds: input.subjectIds,
        });
      } else {
        await callAdminApi("create-class", {
          name: input.name,
          session: input.session,
          subject_ids: input.subjectIds,
        });
      }
      await data.refresh();
      toast.success(input.id ? "Class updated." : "Class created.");
    } catch (err: any) {
      toast.error(err.message || "Couldn't save class");
    }
  };

  const handleAssignTeacher = async (classId: string, teacherId: string) => {
    try {
      await callAdminApi("assign-teacher", {
        classId,
        teacherId: teacherId || null,
      });
      await data.refresh();
    } catch (err: any) {
      toast.error(err.message || "Couldn't assign teacher");
    }
  };

  const handleApproveStudent = async (
    enrolmentId: string,
    termId: string,
    comment: string,
  ) => {
    setBusyEnrolmentId(enrolmentId);
    try {
      await callAdminApi("approve-student", {
        enrolmentId,
        termId,
        headComment: comment || null,
      });
      approvals.setReviewStudents((prev) =>
        prev.map((s) =>
          s.enrolmentId === enrolmentId
            ? {
                ...s,
                status: "approved",
                comment,
                approvedAt: new Date().toISOString(),
              }
            : s,
        ),
      );
      toast.success("Result approved.");
    } catch (err: any) {
      toast.error(err.message || "Couldn't approve result");
    } finally {
      setBusyEnrolmentId(null);
    }
  };

  // ── Confirmation triggers (set state; the single dialog does the work) ──

  const askDeleteStudent = (id: string) =>
    setConfirmAction({ kind: "delete-student", id });

  const askDeleteTeacher = (id: string, name: string) =>
    setConfirmAction({ kind: "delete-teacher", id, name });

  const askDeleteClass = (id: string, name: string) =>
    setConfirmAction({ kind: "delete-class", id, name });

  const askReopenStudent = (
    enrolmentId: string,
    termId: string,
    name: string,
  ) =>
    setConfirmAction({ kind: "reopen-student", enrolmentId, termId, name });

  const askApproveAll = (termId: string) => {
    const toApprove = approvals.reviewStudents.filter(
      (s) => s.status === "submitted",
    );
    if (toApprove.length === 0) {
      toast.info("No submitted results to approve.");
      return;
    }
    setConfirmAction({
      kind: "approve-all",
      termId,
      count: toApprove.length,
    });
  };

  const askResetPassword = (id: string, name: string) =>
    setConfirmAction({ kind: "reset-password", id, name });

  // ── Single dispatcher — runs the action, then closes ──

  const runConfirm = async () => {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      switch (confirmAction.kind) {
        case "delete-student": {
          await callAdminApi("delete-student", { id: confirmAction.id });
          await data.refresh();
          toast.success("Student deleted.");
          break;
        }
        case "delete-teacher": {
          await callAdminApi("delete-teacher", { id: confirmAction.id });
          await data.refresh();
          toast.success("Teacher deleted.");
          break;
        }
        case "delete-class": {
          await callAdminApi("delete-class", { id: confirmAction.id });
          await data.refresh();
          toast.success("Class deleted.");
          break;
        }
        case "force-delete-subject": {
          await callAdminApi("delete-subject", {
            id: confirmAction.id,
            force: true,
          });
          await data.refresh();
          toast.success(`"${confirmAction.name}" deleted.`);
          break;
        }
        case "reopen-student": {
          await callAdminApi("reopen-student", {
            enrolmentId: confirmAction.enrolmentId,
            termId: confirmAction.termId,
          });
          approvals.setReviewStudents((prev) =>
            prev.map((s) =>
              s.enrolmentId === confirmAction.enrolmentId
                ? { ...s, status: "draft", approvedAt: null }
                : s,
            ),
          );
          toast.success("Result sent back to teacher.");
          break;
        }
        case "approve-all": {
          const toApprove = approvals.reviewStudents.filter(
            (s) => s.status === "submitted",
          );
          for (const s of toApprove) {
            await callAdminApi("approve-student", {
              enrolmentId: s.enrolmentId,
              termId: confirmAction.termId,
              headComment: bulkComment || null,
            });
          }
          const current = approvals.pendingClasses.find(
            (c) => c.classId === approvals.reviewClassId,
          );
          if (current) {
            await approvals.openReview(
              current.classId,
              current.termId,
              current.sessionId,
            );
          }
          await approvals.load();
          toast.success(
            `Approved ${toApprove.length} result${toApprove.length === 1 ? "" : "s"}.`,
          );
          break;
        }
        case "reset-password": {
          const result = await callAdminApi("reset-password", {
            id: confirmAction.id,
          });
          setCreatedCredentials({
            email: result.email,
            pin: result.pin,
            title: "Password Reset",
            description: `Share the new passcode with ${confirmAction.name} privately. They can change it after signing in.`,
          });
          toast.success("Password reset.");
          break;
        }
      }
      setConfirmAction(null);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setConfirmBusy(false);
    }
  };

  // ── Approvals helpers ──

  const handleViewResult = async (s: ReviewStudent) => {
    const current = approvals.pendingClasses.find(
      (c) => c.classId === approvals.reviewClassId,
    );
    if (!current) return;
    const result = await fetchResultForView(
      s.enrolmentId,
      current.classId,
      current.termId,
      current.sessionId,
    );
    if (!result) {
      toast.error("Could not load student.");
      return;
    }
    setViewingStudent(result);
  };

  const handleBatchPrintReview = async () => {
    if (!approvals.reviewClassId) return;
    const current = approvals.pendingClasses.find(
      (c) => c.classId === approvals.reviewClassId,
    );
    if (!current) return;

    setBatchPrinting(true);
    try {
      const { classId, termId, sessionId } = current;

      const { data: cls } = await supabase
        .from("classes")
        .select("id, name, session, school_id")
        .eq("id", classId)
        .single();

      if (!cls || !cls.school_id) {
        toast.error("Could not load class or class has no school.");
        return;
      }

      const [schoolRes, bandsRes, termRes] = await Promise.all([
        supabase.from("schools").select("*").eq("id", cls.school_id).single(),
        supabase
          .from("grade_bands")
          .select("*")
          .eq("school_id", cls.school_id)
          .order("display_order"),
        supabase.from("terms").select("name").eq("id", termId).maybeSingle(),
      ]);

      const school = schoolRes.data;
      const gradeBands = bandsRes.data || [];
      const termName = termRes.data?.name ? `${termRes.data.name} Term` : "";

      if (!school || gradeBands.length === 0) {
        toast.error("Could not load school config.");
        return;
      }

      const { data: csubs } = await supabase
        .from("class_subjects")
        .select(`id, subject:subjects (id, name, display_order)`)
        .eq("class_id", classId)
        .eq("session_id", sessionId);

      const subjectOrder = (csubs || [])
        .map((cs: any) => ({
          name: cs.subject?.name,
          order: cs.subject?.display_order ?? 0,
          class_subject_id: cs.id,
        }))
        .filter((s: any) => s.name)
        .sort((a: any, b: any) => a.order - b.order);

      const { data: enrols } = await supabase
        .from("enrolments")
        .select(`id, student:students (id, name, reg_no, gender, age)`)
        .eq("class_id", classId)
        .eq("session_id", sessionId)
        .eq("status", "active");

      if (!enrols || enrols.length === 0) {
        toast.error("No students in this class.");
        return;
      }

      const enrolmentIds = enrols.map((e: any) => e.id);

      const [scoresRes, traitsRes, recordsRes, termsRes] = await Promise.all([
        supabase.from("scores").select("*").in("enrolment_id", enrolmentIds),
        supabase
          .from("trait_ratings")
          .select("*")
          .in("enrolment_id", enrolmentIds)
          .eq("term_id", termId),
        supabase
          .from("term_records")
          .select("*")
          .in("enrolment_id", enrolmentIds)
          .eq("term_id", termId),
        supabase
          .from("terms")
          .select("id, name, sequence")
          .eq("session_id", sessionId)
          .order("sequence"),
      ]);

      const allScores = scoresRes.data || [];
      const traits = traitsRes.data || [];
      const records = recordsRes.data || [];
      const sessionTerms = termsRes.data || [];

      const termAveragesByEnrolment = computeTermAverages(
        allScores.filter((s: any) => s.term_id !== termId) as any,
        sessionTerms as any,
        enrolmentIds,
      );

      const scoresForPositions = allScores.filter(
        (s: any) => s.term_id === termId,
      );
      const perEnrolment: Record<string, Record<string, number>> = {};
      scoresForPositions.forEach((s: any) => {
        const ca = s.ca_score != null ? Number(s.ca_score) : null;
        const ex = s.exam_score != null ? Number(s.exam_score) : null;
        if (ca === null && ex === null) return;
        const tt = (ca || 0) + (ex || 0);
        if (!perEnrolment[s.enrolment_id]) perEnrolment[s.enrolment_id] = {};
        perEnrolment[s.enrolment_id][s.class_subject_id] = tt;
      });

      const csIdToName: Record<string, string> = {};
      subjectOrder.forEach((so: any) => {
        csIdToName[so.class_subject_id] = so.name;
      });

      const subjectAllTotals: Record<string, number[]> = {};
      Object.values(perEnrolment).forEach((subMap) => {
        Object.entries(subMap).forEach(([csId, tt]) => {
          const name = csIdToName[csId];
          if (!name) return;
          if (!subjectAllTotals[name]) subjectAllTotals[name] = [];
          subjectAllTotals[name].push(tt);
        });
      });
      const sortedBySubject: Record<string, number[]> = {};
      Object.entries(subjectAllTotals).forEach(([name, totals]) => {
        sortedBySubject[name] = [...totals].sort((a, b) => b - a);
      });

      const allTotals = Object.values(perEnrolment).map((subMap) =>
        Object.values(subMap).reduce((a, b) => a + b, 0),
      );
      const sortedTotals = [...allTotals].sort((a, b) => b - a);

      const items: ReportCardInput[] = enrols.map((e: any) => {
        const student = e.student;
        const enrolmentId = e.id;
        const scoreMap: Record<string, any> = {};
        scoresForPositions
          .filter((s: any) => s.enrolment_id === enrolmentId)
          .forEach((s: any) => {
            scoreMap[s.class_subject_id] = s;
          });

        const subjects = subjectOrder.map((so: any) => {
          const row = scoreMap[so.class_subject_id];
          return {
            sub: so.name,
            ca: row?.ca_score != null ? String(row.ca_score) : "",
            exam: row?.exam_score != null ? String(row.exam_score) : "",
            sa: row?.sa_score != null ? String(row.sa_score) : "",
          };
        });

        const affective: Record<string, string> = {};
        const psychomotor: Record<string, string> = {};
        traits
          .filter((t: any) => t.enrolment_id === enrolmentId)
          .forEach((t: any) => {
            if (t.trait_domain === "affective")
              affective[t.trait_key] = String(t.rating ?? "");
            else if (t.trait_domain === "psychomotor")
              psychomotor[t.trait_key] = String(t.rating ?? "");
          });

        const record = records.find((r: any) => r.enrolment_id === enrolmentId);

        const thisEnrolTotals = perEnrolment[enrolmentId] || {};
        const studentTotal = Object.values(thisEnrolTotals).reduce(
          (a, b) => a + b,
          0,
        );
        const subjCount = Object.keys(thisEnrolTotals).length;
        const avg = subjCount > 0 ? studentTotal / subjCount : 0;
        const position = sortedTotals.indexOf(studentTotal) + 1;

        const subjectStats: Record<string, any> = {};
        Object.entries(thisEnrolTotals).forEach(([csId, tt]) => {
          const name = csIdToName[csId];
          if (!name) return;
          const stats = sortedBySubject[name];
          subjectStats[name] = {
            position: stats.indexOf(tt) + 1,
            highest: stats[0],
            lowest: stats[stats.length - 1],
            average: stats.reduce((a, b) => a + b, 0) / stats.length,
          };
        });

        const termAvgs = termAveragesByEnrolment[enrolmentId] || {
          termAverages: {},
          cumulativeAverage: null,
        };

        return {
          schoolName: school.name,
          schoolAddress: school.address || "",
          schoolEmail: "",
          schoolPhone: school.phone || "",
          studentName: student?.name || "",
          studentId: student?.reg_no || "",
          sex: student?.gender || "",
          age: student?.age || "",
          className: cls.name,
          session: cls.session,
          term: termName,
          classAvg: "",
          daysOpened:
            record?.days_opened != null ? String(record.days_opened) : "",
          daysPresent:
            record?.days_present != null ? String(record.days_present) : "",
          daysAbsent:
            record?.days_absent != null ? String(record.days_absent) : "",
          subjects,
          affective,
          psychomotor,
          teacherName: "",
          headTeacherName: "",
          teacherRemark: record?.class_teacher_comment || "",
          headRemark: record?.head_teacher_comment || "",
          nextTerm: "",
          promotion: "",
          positions: {
            position,
            classSize: allTotals.length,
            average: avg,
            subjects: subjectStats,
          },
          termAverages: termAvgs.termAverages,
          cumulativeAverage: termAvgs.cumulativeAverage,
          gradeBands,
        };
      });

      const doc = generateBatchReportCards(items);
      const safe = (s: string) => s.replace(/\s+/g, "_");
      doc.save(`${safe(cls.name)}_${safe(termName)}_ReportCards.pdf`);
      toast.success("Report cards generated.");
    } catch (err) {
      console.error("Batch print failed:", err);
      toast.error("Failed to generate report cards.");
    } finally {
      setBatchPrinting(false);
    }
  };

  // ── Full-screen read-only result view ──
  if (viewingStudent) {
    return (
      <div className="min-h-screen bg-slate-100">
        <div className="max-w-lg mx-auto">
          <SectionHeader
            title="Result (read-only)"
            subtitle={viewingStudent.student.name}
            onBack={() => setViewingStudent(null)}
          />
          <div className="p-3">
            <ResultsPage
              initialStudent={viewingStudent.student}
              initialClass={viewingStudent.classRoom}
              term={viewingStudent.classRoom.term || ""}
              readOnly
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Main tabs loading state ──
  if (data.loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-3 w-44" />
          <div className="grid grid-cols-3 gap-3 mt-6">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
          <Skeleton className="h-14 w-full rounded-2xl mt-3" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </main>
      </div>
    );
  }

  const termLabel =
    currentSession && currentTerm
      ? `${currentSession.name} · ${currentTerm.name} Term`
      : "";

  const totalPending = approvals.pendingClasses.reduce(
    (n, c) => n + c.submittedCount,
    0,
  );

  const isMainTab = MAIN_TABS.includes(view);
  const confirmMeta = confirmAction
    ? describeConfirm(confirmAction, bulkComment)
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-lg mx-auto">
        {view === "home" && (
          <HomeTab
            schoolName={config?.name || ""}
            adminName={adminName}
            termLabel={termLabel}
            stats={{
              students: data.students.length,
              teachers: data.teachers.length,
              classes: data.classes.length,
            }}
            pendingCount={totalPending}
            unreadActivityCount={activity.unreadCount}
            onOpenActivity={() => setActivityOpen(true)}
            onNavigate={setView}
          />
        )}

        {view === "students" && (
          <StudentsTab
            students={data.students}
            classes={data.classes}
            onSave={handleSaveStudent}
            onDelete={askDeleteStudent}
          />
        )}

        {view === "approvals" && (
          <ApprovalsTab
            pendingClasses={approvals.pendingClasses}
            reviewClassId={approvals.reviewClassId}
            reviewStudents={approvals.reviewStudents}
            reviewLoading={approvals.reviewLoading}
            bulkComment={bulkComment}
            setBulkComment={setBulkComment}
            batchPrinting={batchPrinting}
            busyEnrolmentId={busyEnrolmentId}
            onOpenReview={(c: PendingClass) =>
              approvals.openReview(c.classId, c.termId, c.sessionId)
            }
            onCloseReview={() => {
              approvals.closeReview();
              setBulkComment("");
            }}
            onBatchPrint={handleBatchPrintReview}
            onApproveAll={() => {
              const current = approvals.pendingClasses.find(
                (c) => c.classId === approvals.reviewClassId,
              );
              if (current) askApproveAll(current.termId);
            }}
            onCommentChange={(enrolmentId, v) =>
              approvals.setReviewStudents((prev) =>
                prev.map((x) =>
                  x.enrolmentId === enrolmentId ? { ...x, comment: v } : x,
                ),
              )
            }
            onView={handleViewResult}
            onApprove={(s) => {
              const current = approvals.pendingClasses.find(
                (c) => c.classId === approvals.reviewClassId,
              );
              if (current)
                handleApproveStudent(s.enrolmentId, current.termId, s.comment);
            }}
            onReopen={(s) => {
              const current = approvals.pendingClasses.find(
                (c) => c.classId === approvals.reviewClassId,
              );
              if (current)
                askReopenStudent(s.enrolmentId, current.termId, s.name);
            }}
          />
        )}

        {view === "more" && (
          <MoreTab onNavigate={setView} onLogout={handleLogout} />
        )}

        {view === "teachers" && (
          <TeachersSection
            teachers={data.teachers}
            onBack={() => setView("more")}
            onCreate={handleCreateTeacher}
            onUpdate={handleUpdateTeacher}
            onDelete={(id) => {
              const t = data.teachers.find((x) => x.id === id);
              askDeleteTeacher(id, t?.name || "this teacher");
            }}
            onResetPassword={askResetPassword}
            createdCredentials={createdCredentials}
            clearCredentials={() => setCreatedCredentials(null)}
          />
        )}

        {view === "admins" && (
          <AdminsSection
            admins={data.admins}
            currentAdminId={currentAdminId}
            onBack={() => setView("more")}
            onCreate={handleCreateAdmin}
            onResetPassword={askResetPassword}
            createdCredentials={createdCredentials}
            clearCredentials={() => setCreatedCredentials(null)}
          />
        )}

        {view === "subjects" && (
          <SubjectsSection
            subjects={data.subjects}
            onBack={() => setView("more")}
            onAdd={handleAddSubject}
            onDelete={handleDeleteSubject}
          />
        )}

        {view === "classes" && (
          <ClassesSection
            classes={data.classes}
            subjects={data.subjects}
            teachers={data.teachers}
            classSubjectIds={data.classSubjectIds}
            onBack={() => setView("more")}
            onSave={handleSaveClass}
            onDelete={(id) => {
              const c = data.classes.find((x) => x.id === id);
              askDeleteClass(id, c?.name || "this class");
            }}
            onAssignTeacher={handleAssignTeacher}
          />
        )}

        {view === "settings" && (
          <>
            <SectionHeader title="Settings" onBack={() => setView("more")} />
            <div className="p-4">
              <SettingsTab callAdminApi={callAdminApi} />
            </div>
          </>
        )}
      </main>

      {isMainTab && !approvals.reviewClassId && (
        <AdminBottomNav
          active={view}
          pendingCount={totalPending}
          onChange={setView}
        />
      )}

      {/* One dialog for everything */}
      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmMeta?.title || ""}
        description={confirmMeta?.description || ""}
        confirmLabel={confirmMeta?.confirmLabel || "Confirm"}
        destructive={confirmMeta?.destructive}
        loading={confirmBusy}
        onConfirm={runConfirm}
      />

      {/* Activity drawer — mounted once, works from any view */}
      <ActivityFeed
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        activities={activity.activities}
        loading={activity.loading}
        onSeen={activity.markSeen}
      />
    </div>
  );
}