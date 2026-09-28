"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ResultsPage from "../teacher/results/page";
import SettingsTab from "./SettingsTab";
import { generateBatchReportCards, ReportCardInput } from "@/lib/reportCardPdf";
import { useCurrentTerm } from "@/hooks/useCurrentTerm";
import { computeTermAverages } from "@/lib/termAverages";

import { useAdminData } from "./_hooks/useAdminData";
import { useApprovals } from "./_hooks/useApprovals";
import { fetchResultForView } from "./_lib/fetchResultForView";

import { AdminBottomNav } from "./_components/AdminBottomNav";
import { SectionHeader } from "./_components/SectionHeader";
import { HomeTab } from "./_components/tabs/HomeTab";
import { StudentsTab } from "./_components/tabs/StudentsTab";
import { ApprovalsTab } from "./_components/tabs/ApprovalsTab";
import { MoreTab } from "./_components/tabs/MoreTab";
import { TeachersSection } from "./_components/sections/TeachersSection";
import { SubjectsSection } from "./_components/sections/SubjectsSection";
import { ClassesSection } from "./_components/sections/ClassesSection";

import type { AdminView, PendingClass, ReviewStudent } from "./_lib/types";

const MAIN_TABS: AdminView[] = ["home", "students", "approvals", "more"];

export default function AdminDashboardPage() {
  const router = useRouter();
  const { session: currentSession, term: currentTerm } = useCurrentTerm();
  const data = useAdminData();
  const approvals = useApprovals();

  const [adminName, setAdminName] = useState("");
  const [view, setView] = useState<AdminView>("home");
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
  } | null>(null);

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

  // ── Handlers ──

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/sign-in/staff");
  };

  // Students
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
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("Delete this student?")) return;
    await callAdminApi("delete-student", { id });
    await data.refresh();
  };

  // Teachers
  const handleCreateTeacher = async (name: string, email: string) => {
    const result = await callAdminApi("create-teacher", { name, email });
    setCreatedCredentials({ email: result.email, pin: result.pin });
    await data.refresh();
  };

  const handleUpdateTeacher = async (
    id: string,
    name: string,
    email: string,
  ) => {
    await callAdminApi("update-teacher", { id, name, email });
    await data.refresh();
  };

  const handleDeleteTeacher = async (id: string) => {
    if (!confirm("Delete this teacher?")) return;
    await callAdminApi("delete-teacher", { id });
    await data.refresh();
  };

  // Subjects
  const handleAddSubject = async (name: string) => {
    await callAdminApi("add-subject", { name });
    await data.refresh();
  };

  const handleDeleteSubject = async (id: string, name: string) => {
    const first = await callAdminApi("delete-subject", { id }).catch(
      (err) => ({ error: err.message, requiresForce: true }),
    );
    if (first?.error && first?.requiresForce) {
      if (
        !confirm(
          `"${name}" is used in classes and has scores. Delete anyway?`,
        )
      )
        return;
      await callAdminApi("delete-subject", { id, force: true });
      await data.refresh();
      return;
    }
    if (first?.error) {
      alert(`Error: ${first.error}`);
      return;
    }
    await data.refresh();
  };

  // Classes
  const handleSaveClass = async (input: {
    id?: string;
    name: string;
    session: string;
    subjectIds: string[];
  }) => {
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
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm("Delete this class? Students and teachers will be unassigned."))
      return;
    await callAdminApi("delete-class", { id });
    await data.refresh();
  };

  const handleAssignTeacher = async (classId: string, teacherId: string) => {
    await callAdminApi("assign-teacher", {
      classId,
      teacherId: teacherId || null,
    });
    await data.refresh();
  };

  // Approvals
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
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setBusyEnrolmentId(null);
    }
  };

  const handleReopenStudent = async (enrolmentId: string, termId: string) => {
    if (!confirm("Send this student's result back to the teacher?")) return;
    setBusyEnrolmentId(enrolmentId);
    try {
      await callAdminApi("reopen-student", { enrolmentId, termId });
      approvals.setReviewStudents((prev) =>
        prev.map((s) =>
          s.enrolmentId === enrolmentId
            ? { ...s, status: "draft", approvedAt: null }
            : s,
        ),
      );
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setBusyEnrolmentId(null);
    }
  };

  const handleApproveAll = async (termId: string) => {
    const toApprove = approvals.reviewStudents.filter(
      (s) => s.status === "submitted",
    );
    if (toApprove.length === 0) {
      alert("No submitted results to approve.");
      return;
    }
    if (
      !confirm(
        `Approve all ${toApprove.length} submitted result${toApprove.length > 1 ? "s" : ""}?` +
          (bulkComment ? `\n\nHead teacher comment: "${bulkComment}"` : ""),
      )
    )
      return;
    try {
      for (const s of toApprove) {
        await callAdminApi("approve-student", {
          enrolmentId: s.enrolmentId,
          termId,
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
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
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

      const [schoolRes, bandsRes, classRes, termRes] = await Promise.all([
        supabase.from("schools").select("*").limit(1).single(),
        supabase.from("grade_bands").select("*").order("display_order"),
        supabase
          .from("classes")
          .select("id, name, session")
          .eq("id", classId)
          .single(),
        supabase.from("terms").select("name").eq("id", termId).maybeSingle(),
      ]);

      const school = schoolRes.data;
      const gradeBands = bandsRes.data || [];
      const cls = classRes.data;
      const termName = termRes.data?.name ? `${termRes.data.name} Term` : "";

      if (!school || !cls || gradeBands.length === 0) {
        alert("Could not load school config or class.");
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
        alert("No students in this class.");
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

        const record = records.find(
          (r: any) => r.enrolment_id === enrolmentId,
        );

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
    } catch (err) {
      console.error("Batch print failed:", err);
      alert("Failed to generate report cards.");
    } finally {
      setBatchPrinting(false);
    }
  };

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
      alert("Could not load student.");
      return;
    }
    setViewingStudent(result);
  };

  // ── Read-only result view ──
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

  // ── Section views (open from More tab) ──
  if (view === "teachers") {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-lg mx-auto">
          <TeachersSection
            teachers={data.teachers}
            onBack={() => setView("more")}
            onCreate={handleCreateTeacher}
            onUpdate={handleUpdateTeacher}
            onDelete={handleDeleteTeacher}
            createdCredentials={createdCredentials}
            clearCredentials={() => setCreatedCredentials(null)}
          />
        </div>
      </div>
    );
  }

  if (view === "subjects") {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-lg mx-auto">
          <SubjectsSection
            subjects={data.subjects}
            onBack={() => setView("more")}
            onAdd={handleAddSubject}
            onDelete={handleDeleteSubject}
          />
        </div>
      </div>
    );
  }

  if (view === "classes") {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-lg mx-auto">
          <ClassesSection
            classes={data.classes}
            subjects={data.subjects}
            teachers={data.teachers}
            classSubjectIds={data.classSubjectIds}
            onBack={() => setView("more")}
            onSave={handleSaveClass}
            onDelete={handleDeleteClass}
            onAssignTeacher={handleAssignTeacher}
          />
        </div>
      </div>
    );
  }

  if (view === "settings") {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-lg mx-auto">
          <SectionHeader
            title="Settings"
            onBack={() => setView("more")}
          />
          <div className="p-4">
            <SettingsTab callAdminApi={callAdminApi} />
          </div>
        </div>
      </div>
    );
  }

  // ── Main tabs ──
  if (data.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-slate-500 font-medium">
            Loading admin console…
          </p>
        </div>
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

  const activeMainTab = MAIN_TABS.includes(view) ? view : "more";

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-lg mx-auto">
        {view === "home" && (
          <HomeTab
            adminName={adminName}
            termLabel={termLabel}
            stats={{
              students: data.students.length,
              teachers: data.teachers.length,
              classes: data.classes.length,
            }}
            pendingCount={totalPending}
            onNavigate={setView}
          />
        )}

        {view === "students" && (
          <StudentsTab
            students={data.students}
            classes={data.classes}
            onSave={handleSaveStudent}
            onDelete={handleDeleteStudent}
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
              if (current) handleApproveAll(current.termId);
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
              if (current) handleReopenStudent(s.enrolmentId, current.termId);
            }}
          />
        )}

        {view === "more" && (
          <MoreTab onNavigate={setView} onLogout={handleLogout} />
        )}
      </main>

      {!approvals.reviewClassId && (
        <AdminBottomNav
          active={activeMainTab}
          pendingCount={totalPending}
          onChange={setView}
        />
      )}
    </div>
  );
}