"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { useFeesSummary } from "./_hooks/useFeesSummary";
import { useAdminCrud } from "./_hooks/useAdminCrud";
import { useConfirmDialog, describeConfirm } from "./_hooks/useConfirmDialog";
import { fetchResultForView } from "./_lib/fetchResultForView";

import { AdminBottomNav } from "./_components/AdminBottomNav";
import { ActivityFeed } from "./_components/ActivityFeed";
import { SectionHeader } from "./_components/SectionHeader";
import { HomeTab } from "./_components/tabs/HomeTab";
import { StudentsTab } from "./_components/tabs/StudentsTab";
import { ApprovalsTab } from "./_components/tabs/ApprovalsTab";
import { FeesTab } from "./_components/tabs/FeesTab";
import { StudentImportWizard } from "./_components/tabs/StudentImportWizard";
import { TeachersSection } from "./_components/sections/TeachersSection";
import { AdminsSection } from "./_components/sections/AdminsSection";
import { SubjectsSection } from "./_components/sections/SubjectsSection";
import { ClassesSection } from "./_components/sections/ClassesSection";

import type { AdminView, PendingClass, ReviewStudent } from "./_lib/types";

const MAIN_TABS: AdminView[] = ["home", "fees", "attendance", "approvals"];

function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session: currentSession, term: currentTerm } = useCurrentTerm();
  const { config } = useSchoolConfig();
  const data = useAdminData();
  const approvals = useApprovals();
  const activity = useActivityFeed();
  const { feeSummary } = useFeesSummary(data.callerRole === "owner");

  const [adminName, setAdminName] = useState("");
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [view, setView] = useState<AdminView>("home");
  const [previousView, setPreviousView] = useState<AdminView>("home");
  const [activityOpen, setActivityOpen] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<{ student: any; classRoom: any } | null>(null);

  const [bulkComment, setBulkComment] = useState("");
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [busyEnrolmentId, setBusyEnrolmentId] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<any>(null);

  // --- CORE API WRAPPER ---
  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  const callAdminApi = async (action: string, payload: any) => {
    const token = await getToken();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Request failed");
    }
    return res.json();
  };

  // --- HOOKS ---
  const confirm = useConfirmDialog({
    callAdminApi,
    dataRefresh: data.refresh,
    approvals,
    bulkComment,
    setCreatedCredentials,
  });

  const crud = useAdminCrud({
    callAdminApi,
    dataRefresh: data.refresh,
    askConfirm: confirm.askConfirm,
  });

  // 🚨 NEW: LOCAL SAVE STUDENT FUNCTION to prevent dropping fields
  const handleSaveStudent = async (input: any) => {
    const action = input.id ? "update-student" : "create-student";
    
    await callAdminApi(action, {
      id: input.id,
      name: input.name,
      reg_no: input.regNo,
      class_id: input.classId || null,
      gender: input.gender,
      age: input.age,
      // Pass the family linking data!
      familyId: input.familyId,
      newFamilyGuardianName: input.newFamilyGuardianName,
      guardianPhone1: input.guardianPhone1,
      guardianPhone2: input.guardianPhone2,
    });
    
    await data.refresh();
  };

  // --- URL PARSING ---
  useEffect(() => {
    if (data.loading) return; 
    const tab = searchParams.get("tab");
    const isOwner = data.callerRole === "owner";

    if (tab === "fees") {
      if (isOwner) {
        setView("fees");
        setPreviousView("home");
      } else {
        setView("home");
        toast.error("Unauthorized: Only school owners can view the Fees module.");
        router.replace("/admin");
      }
    } else if (tab === "students") {
      setView("students");
      setPreviousView("home");
    }
  }, [searchParams, data.callerRole, data.loading, router]);

  // --- INITIALIZATION ---
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/sign-in/staff"); return; }
      const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      if (profile) setAdminName(profile.name);
      setCurrentAdminId(user.id);
    })();
  }, [router]);

  useEffect(() => {
    if (view === "approvals") approvals.load();
  }, [view]);

  // --- HANDLERS ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/sign-in/staff");
  };

  const handleViewResult = async (s: ReviewStudent) => {
    const current = approvals.pendingClasses.find((c) => c.classId === approvals.reviewClassId);
    if (!current) return;
    const result = await fetchResultForView(s.enrolmentId, current.classId, current.termId, current.sessionId);
    if (!result) { toast.error("Could not load student."); return; }
    setViewingStudent(result);
  };

  const handleApproveStudent = async (enrolmentId: string, termId: string, comment: string) => {
    setBusyEnrolmentId(enrolmentId);
    const success = await crud.handleApproveStudent(enrolmentId, termId, comment);
    if (success) {
      approvals.setReviewStudents((prev) => prev.map((s) => 
        s.enrolmentId === enrolmentId ? { ...s, status: "approved", comment, approvedAt: new Date().toISOString() } : s
      ));
    }
    setBusyEnrolmentId(null);
  };

  const handleBatchPrintReview = async () => {
    if (!approvals.reviewClassId) return;
    const current = approvals.pendingClasses.find((c) => c.classId === approvals.reviewClassId);
    if (!current) return;
    
    setBatchPrinting(true);
    try {
      const { classId, termId, sessionId } = current;
      const { data: cls } = await supabase.from("classes").select("id, name, session, school_id").eq("id", classId).single();
      if (!cls || !cls.school_id) { toast.error("Could not load class."); return; }

      const [schoolRes, bandsRes, termRes] = await Promise.all([
        supabase.from("schools").select("*").eq("id", cls.school_id).single(),
        supabase.from("grade_bands").select("*").eq("school_id", cls.school_id).order("display_order"),
        supabase.from("terms").select("name").eq("id", termId).maybeSingle(),
      ]);
      const school = schoolRes.data;
      const gradeBands = bandsRes.data || [];
      const termName = termRes.data?.name ? `${termRes.data.name} Term` : "";
      if (!school || gradeBands.length === 0) { toast.error("Could not load school config."); return; }

      const { data: csubs } = await supabase.from("class_subjects").select(`id, subject:subjects (id, name, display_order)`).eq("class_id", classId).eq("session_id", sessionId);
      const subjectOrder = (csubs || []).map((cs: any) => ({ name: cs.subject?.name, order: cs.subject?.display_order ?? 0, class_subject_id: cs.id })).filter((s: any) => s.name).sort((a: any, b: any) => a.order - b.order);
      
      const { data: enrols } = await supabase.from("enrolments").select(`id, student:students (id, name, reg_no, gender, age)`).eq("class_id", classId).eq("session_id", sessionId).eq("status", "active");
      if (!enrols || enrols.length === 0) { toast.error("No students in this class."); return; }

      const enrolmentIds = enrols.map((e: any) => e.id);
      const [scoresRes, traitsRes, recordsRes, termsRes] = await Promise.all([
        supabase.from("scores").select("*").in("enrolment_id", enrolmentIds),
        supabase.from("trait_ratings").select("*").in("enrolment_id", enrolmentIds).eq("term_id", termId),
        supabase.from("term_records").select("*").in("enrolment_id", enrolmentIds).eq("term_id", termId),
        supabase.from("terms").select("id, name, sequence").eq("session_id", sessionId).order("sequence"),
      ]);

      const allScores = scoresRes.data || [];
      const traits = traitsRes.data || [];
      const records = recordsRes.data || [];
      const sessionTerms = termsRes.data || [];
      const termAveragesByEnrolment = computeTermAverages(allScores.filter((s: any) => s.term_id !== termId) as any, sessionTerms as any, enrolmentIds);
      
      const scoresForPositions = allScores.filter((s: any) => s.term_id === termId);
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
      subjectOrder.forEach((so: any) => { csIdToName[so.class_subject_id] = so.name; });

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
      Object.entries(subjectAllTotals).forEach(([name, totals]) => { sortedBySubject[name] = [...totals].sort((a, b) => b - a); });
      const allTotals = Object.values(perEnrolment).map((subMap) => Object.values(subMap).reduce((a, b) => a + b, 0));
      const sortedTotals = [...allTotals].sort((a, b) => b - a);

      const items: ReportCardInput[] = enrols.map((e: any) => {
        const student = e.student;
        const enrolmentId = e.id;
        const scoreMap: Record<string, any> = {};
        scoresForPositions.filter((s: any) => s.enrolment_id === enrolmentId).forEach((s: any) => { scoreMap[s.class_subject_id] = s; });
        
        const subjects = subjectOrder.map((so: any) => {
          const row = scoreMap[so.class_subject_id];
          return { sub: so.name, ca: row?.ca_score != null ? String(row.ca_score) : "", exam: row?.exam_score != null ? String(row.exam_score) : "", sa: row?.sa_score != null ? String(row.sa_score) : "" };
        });

        const affective: Record<string, string> = {};
        const psychomotor: Record<string, string> = {};
        traits.filter((t: any) => t.enrolment_id === enrolmentId).forEach((t: any) => {
          if (t.trait_domain === "affective") affective[t.trait_key] = String(t.rating ?? "");
          else if (t.trait_domain === "psychomotor") psychomotor[t.trait_key] = String(t.rating ?? "");
        });

        const record = records.find((r: any) => r.enrolment_id === enrolmentId);
        const thisEnrolTotals = perEnrolment[enrolmentId] || {};
        const studentTotal = Object.values(thisEnrolTotals).reduce((a, b) => a + b, 0);
        const subjCount = Object.keys(thisEnrolTotals).length;
        const avg = subjCount > 0 ? studentTotal / subjCount : 0;
        const position = sortedTotals.indexOf(studentTotal) + 1;
        
        const subjectStats: Record<string, any> = {};
        Object.entries(thisEnrolTotals).forEach(([csId, tt]) => {
          const name = csIdToName[csId];
          if (!name) return;
          const stats = sortedBySubject[name];
          subjectStats[name] = { position: stats.indexOf(tt) + 1, highest: stats[0], lowest: stats[stats.length - 1], average: stats.reduce((a, b) => a + b, 0) / stats.length };
        });
        
        const termAvgs = termAveragesByEnrolment[enrolmentId] || { termAverages: {}, cumulativeAverage: null };

        return {
          schoolName: school.name, schoolAddress: school.address || "", schoolEmail: "", schoolPhone: school.phone || "",
          studentName: student?.name || "", studentId: student?.reg_no || "", sex: student?.gender || "", age: student?.age || "",
          className: cls.name, session: cls.session, term: termName, classAvg: "",
          daysOpened: record?.days_opened != null ? String(record.days_opened) : "",
          daysPresent: record?.days_present != null ? String(record.days_present) : "",
          daysAbsent: record?.days_absent != null ? String(record.days_absent) : "",
          subjects, affective, psychomotor, teacherName: "", headTeacherName: "",
          teacherRemark: record?.class_teacher_comment || "", headRemark: record?.head_teacher_comment || "",
          nextTerm: "", promotion: "",
          positions: { position, classSize: allTotals.length, average: avg, subjects: subjectStats },
          termAverages: termAvgs.termAverages, cumulativeAverage: termAvgs.cumulativeAverage, gradeBands,
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

  // --- LOADING ---
  if (viewingStudent) {
    return (
      <div className="min-h-screen bg-slate-100">
        <div className="max-w-lg mx-auto">
          <SectionHeader title="Result (read-only)" subtitle={viewingStudent.student.name} onBack={() => setViewingStudent(null)} />
          <div className="p-3">
            <ResultsPage initialStudent={viewingStudent.student} initialClass={viewingStudent.classRoom} term={viewingStudent.classRoom.term || ""} readOnly />
          </div>
        </div>
      </div>
    );
  }

  if (data.loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-3 w-32" /> <Skeleton className="h-7 w-56" /> <Skeleton className="h-3 w-44" />
          <div className="grid grid-cols-3 gap-3 mt-6">
            <Skeleton className="h-20 rounded-2xl" /> <Skeleton className="h-20 rounded-2xl" /> <Skeleton className="h-20 rounded-2xl" />
          </div>
          <Skeleton className="h-14 w-full rounded-2xl mt-3" /> <Skeleton className="h-14 w-full rounded-2xl" />
        </main>
      </div>
    );
  }

  // --- DERIVED STATE ---
  const termLabel = currentSession && currentTerm ? `${currentSession.name} · ${currentTerm.name} Term` : "";
  const totalPending = approvals.pendingClasses.reduce((n, c) => n + c.submittedCount, 0);
  const isMainTab = MAIN_TABS.includes(view);
  const confirmMeta = confirm.confirmAction ? describeConfirm(confirm.confirmAction, bulkComment) : null;
  const isOwner = data.callerRole === "owner";

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-lg md:max-w-7xl mx-auto pb-28">
        {view === "home" && (
          <HomeTab
            schoolName={config?.name || ""} adminName={adminName} termLabel={termLabel}
            stats={{ students: data.students.length, teachers: data.teachers.length, classes: data.classes.length }}
            pendingApprovals={totalPending} unreadActivity={activity.unreadCount}
            unassignedStudents={data.students.filter((s) => !s.currentClassId).length}
            isOwner={isOwner} feeSummary={feeSummary} teacherAbsence={null}
            onOpenFees={() => router.push("/admin?tab=fees")}
            onOpenSettings={() => { setPreviousView("home"); setView("settings"); }}
            onNavigate={(v) => { setPreviousView("home"); setView(v); }}
          />
        )}

        {view === "fees" && isOwner && (
          <FeesTab onNavigate={(v) => { setPreviousView("home"); setView(v); }} />
        )}

        {view === "attendance" && (
          <div className="p-4 pt-20 text-center space-y-4">
            <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
            <p className="text-slate-500">Admin attendance overview coming soon.</p>
            <button onClick={() => setView("home")} className="px-6 py-2 bg-slate-200 rounded-xl font-bold">Go Back</button>
          </div>
        )}

        {view === "students" && (
          <StudentsTab
            students={data.students}
            classes={data.classes}
            families={data.families || []}
            // 🚨 FIX: Use the local handleSaveStudent instead of crud.handleSaveStudent
            onSave={handleSaveStudent}
            onDelete={crud.askDeleteStudent}
            onBack={() => setView("home")}
            onOpenImport={() => setView("students-import")}
          />
        )}

        {view === "students-import" && (
          <StudentImportWizard
            callAdminApi={callAdminApi}
            existingClasses={data.classes}
            onBack={() => setView("students")}
            onSuccess={() => { setView("students"); data.refresh(); }}
          />
        )}

        {view === "approvals" && (
          <ApprovalsTab
            pendingClasses={approvals.pendingClasses} reviewClassId={approvals.reviewClassId}
            reviewStudents={approvals.reviewStudents} reviewLoading={approvals.reviewLoading}
            bulkComment={bulkComment} setBulkComment={setBulkComment} batchPrinting={batchPrinting} busyEnrolmentId={busyEnrolmentId}
            onOpenReview={(c: PendingClass) => approvals.openReview(c.classId, c.termId, c.sessionId)}
            onCloseReview={() => { approvals.closeReview(); setBulkComment(""); }}
            onBatchPrint={handleBatchPrintReview}
            onApproveAll={() => {
              const current = approvals.pendingClasses.find((c) => c.classId === approvals.reviewClassId);
              if (current) crud.askApproveAll(current.termId, approvals.reviewStudents.filter(s => s.status === "submitted").length);
            }}
            onCommentChange={(enrolmentId, v) => approvals.setReviewStudents((prev) => prev.map((x) => x.enrolmentId === enrolmentId ? { ...x, comment: v } : x))}
            onView={handleViewResult}
            onApprove={(s) => {
              const current = approvals.pendingClasses.find((c) => c.classId === approvals.reviewClassId);
              if (current) handleApproveStudent(s.enrolmentId, current.termId, s.comment);
            }}
            onReopen={(s) => {
              const current = approvals.pendingClasses.find((c) => c.classId === approvals.reviewClassId);
              if (current) crud.askReopenStudent(s.enrolmentId, current.termId, s.name);
            }}
          />
        )}

        {view === "teachers" && (
          <TeachersSection
            teachers={data.teachers} onBack={() => setView(previousView)}
            onCreate={crud.handleCreateTeacher} onUpdate={crud.handleUpdateTeacher}
            onDelete={(id) => { const t = data.teachers.find((x) => x.id === id); crud.askDeleteTeacher(id, t?.name || "this teacher"); }}
            onResetPassword={crud.askResetPassword} createdCredentials={createdCredentials} clearCredentials={() => setCreatedCredentials(null)}
          />
        )}

        {view === "admins" && (
          <AdminsSection
            admins={data.admins} currentAdminId={currentAdminId} onBack={() => setView("settings")}
            onCreate={crud.handleCreateAdmin} onResetPassword={crud.askResetPassword}
            createdCredentials={createdCredentials} clearCredentials={() => setCreatedCredentials(null)}
          />
        )}

        {view === "subjects" && (
          <SubjectsSection subjects={data.subjects} onBack={() => setView(previousView)} onAdd={crud.handleAddSubject} onDelete={crud.handleDeleteSubject} />
        )}

        {view === "classes" && (
          <ClassesSection
            classes={data.classes} subjects={data.subjects} teachers={data.teachers} classSubjectIds={data.classSubjectIds}
            onBack={() => setView(previousView)} onSave={crud.handleSaveClass}
            onDelete={(id) => { const c = data.classes.find((x) => x.id === id); crud.askDeleteClass(id, c?.name || "this class"); }}
            onAssignTeacher={crud.handleAssignTeacher}
          />
        )}

        {view === "settings" && (
          <>
            <SectionHeader title="Settings" onBack={() => setView("home")} />
            <div className="p-4">
              <SettingsTab callAdminApi={callAdminApi} onLogout={handleLogout} onNavigate={(v) => setView(v as AdminView)} />
            </div>
          </>
        )}
      </main>

      {isMainTab && !approvals.reviewClassId && (
        <AdminBottomNav
          active={view} pendingCount={totalPending} isOwner={isOwner}
          onChange={(newView) => {
            if (newView === "fees") {
              router.push("/admin?tab=fees");
            } else {
              if (searchParams.get("tab")) router.replace("/admin");
              setPreviousView("home"); setView(newView);
            }
          }}
        />
      )}

      <ConfirmDialog
        open={confirm.confirmAction !== null}
        onOpenChange={(open) => !open && confirm.askConfirm(null as any)}
        title={confirmMeta?.title || ""} description={confirmMeta?.description || ""}
        confirmLabel={confirmMeta?.confirmLabel || "Confirm"} destructive={confirmMeta?.destructive}
        loading={confirm.confirmBusy} onConfirm={confirm.runConfirm}
      />

      <ActivityFeed
        open={activityOpen} onClose={() => setActivityOpen(false)}
        activities={activity.activities} loading={activity.loading} onSeen={activity.markSeen}
      />
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50"><main className="max-w-lg mx-auto px-4 py-6 space-y-4"><Skeleton className="h-3 w-32" /><Skeleton className="h-7 w-56" /><Skeleton className="h-3 w-44" /><div className="grid grid-cols-3 gap-3 mt-6"><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" /></div><Skeleton className="h-14 w-full rounded-2xl mt-3" /><Skeleton className="h-14 w-full rounded-2xl" /></main></div>}>
      <AdminDashboardContent />
    </Suspense>
  );
}