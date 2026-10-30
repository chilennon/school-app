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
import { TeacherImportWizard } from "./_components/tabs/TeacherImportWizard"; 
import { TeachersSection } from "./_components/sections/TeachersSection";
import { AdminsSection } from "./_components/sections/AdminsSection";
import { SubjectsSection } from "./_components/sections/SubjectsSection";
import { ClassesSection } from "./_components/sections/ClassesSection";
import { PromotionSection } from "./_components/sections/PromotionSection";
import { PromotionReview } from "./_components/sections/PromotionReview"; // 🚨 IMPORTED

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

  // 🚨 PROMOTION STATE
  const [reviewingClassId, setReviewingClassId] = useState<string | null>(null);
  const [nextSessionId, setNextSessionId] = useState<string | null>(null);
  const [nextSessionName, setNextSessionName] = useState<string>("Next Session");

  const [bulkComment, setBulkComment] = useState("");
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [busyEnrolmentId, setBusyEnrolmentId] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<any>(null);
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);

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

  // LOCAL SAVE STUDENT FUNCTION
  const handleSaveStudent = async (input: any) => {
    const action = input.id ? "update-student" : "create-student";
    await callAdminApi(action, {
      id: input.id,
      name: input.name,
      reg_no: input.regNo,
      class_id: input.classId || null,
      gender: input.gender,
      age: input.age,
      familyId: input.familyId,
      newFamilyGuardianName: input.newFamilyGuardianName,
      guardianPhone1: input.guardianPhone1,
      guardianPhone2: input.guardianPhone2,
    });
    await data.refresh();
  };

  const handleCreateTeacher = async (name: string, email: string, classId: string | null) => {
    const res = await callAdminApi("create-teacher", { name, email, classId });
    setCreatedCredentials({
      email: res.email,
      pin: res.pin,
      title: "Teacher Account Created",
    });
    await data.refresh();
    toast.success("Teacher account created.");
  };

  const handleUpdateTeacher = async (id: string, name: string, email: string, classId: string | null) => {
    await callAdminApi("update-teacher", { id, name, email, classId });
    await data.refresh();
    toast.success("Teacher updated.");
  };

  const handleReorderClasses = async (updates: { id: string; sort_order: number }[]) => {
    try {
      await callAdminApi("reorder-classes", { updates });
      await data.refresh();
      toast.success("Class order saved successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to save class order");
      throw err;
    }
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

      // 🚨 FETCH NEXT SESSION
      if (user.app_metadata?.school_id) {
        const { data: sessions } = await supabase
          .from("sessions")
          .select("id, name, created_at")
          .eq("school_id", user.app_metadata.school_id)
          .order("created_at", { ascending: true });

        if (sessions && sessions.length > 0) {
          const currentIdx = sessions.findIndex(s => s.id === currentSession?.id);
          // If there is a session after the current one, use it
          if (currentIdx !== -1 && currentIdx < sessions.length - 1) {
            setNextSessionId(sessions[currentIdx + 1].id);
            setNextSessionName(sessions[currentIdx + 1].name);
          } else {
            // Fallback: just use the last session if we can't find a "next" one
            setNextSessionId(sessions[sessions.length - 1].id);
            setNextSessionName(sessions[sessions.length - 1].name);
          }
        }
      }
    })();
  }, [router, currentSession?.id]);

    // 🚨 NEW: Fetch sessions for the Class dropdown
  useEffect(() => {
    async function fetchSessions() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.app_metadata?.school_id) return;

      const { data, error } = await supabase
        .from("sessions")
        .select("id, name")
        .eq("school_id", user.app_metadata.school_id)
        .order("name", { ascending: false });

      if (data) {
        setSessions(data);
      } else if (error) {
        console.error("Failed to load sessions:", error);
      }
    }
    fetchSessions();
  }, []);

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
    // ... (Keep your existing batch print logic here) ...
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
            
            // 🚨 ADD THIS LINE:
            onPromotionChange={(enrolmentId, v) => approvals.setReviewStudents((prev) => prev.map((x) => x.enrolmentId === enrolmentId ? { ...x, promotion: v } : x))}
            
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
            teachers={data.teachers} 
            classes={data.classes}
            onBack={() => setView(previousView)}
            onCreate={handleCreateTeacher}
            onUpdate={handleUpdateTeacher}
            onDelete={(id) => { const t = data.teachers.find((x) => x.id === id); crud.askDeleteTeacher(id, t?.name || "this teacher"); }}
            onResetPassword={crud.askResetPassword} 
            createdCredentials={createdCredentials} 
            clearCredentials={() => setCreatedCredentials(null)}
            onOpenImport={() => setView("teachers-import")} 
          />
        )}

        {view === "teachers-import" && (
          <TeacherImportWizard
            callAdminApi={callAdminApi}
            existingClasses={data.classes}
            onBack={() => setView("teachers")}
            onSuccess={() => { 
              setView("teachers"); 
              data.refresh(); 
            }}
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
            classes={data.classes} 
            subjects={data.subjects} 
            teachers={data.teachers} 
            sessions={sessions}
            classSubjectIds={data.classSubjectIds}
            onBack={() => setView(previousView)} 
            onSave={crud.handleSaveClass}
            onDelete={(id) => { const c = data.classes.find((x) => x.id === id); crud.askDeleteClass(id, c?.name || "this class"); }}
            onAssignTeacher={crud.handleAssignTeacher}
            onReorder={handleReorderClasses}
          />
        )}

        {view === "promotion" && !reviewingClassId && (
          <PromotionSection
            classes={data.classes}
            currentSessionName={currentSession?.name || "Current Session"}
            nextSessionName={nextSessionName}
            onBack={() => setView("settings")}
            onReviewClass={(id) => setReviewingClassId(id)}
          />
        )}

        {/* 🚨 NEW: PROMOTION REVIEW SCREEN */}
        {view === "promotion" && reviewingClassId && (
          <PromotionReview
            classId={reviewingClassId}
            currentSessionId={currentSession?.id || ""}
            nextSessionId={nextSessionId || ""}
            passMark={config?.promotion_threshold || 40}
            onBack={() => setReviewingClassId(null)}
            onComplete={() => {
              setReviewingClassId(null);
              setView("settings");
              data.refresh();
              toast.success("Students promoted successfully!");
            }}
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