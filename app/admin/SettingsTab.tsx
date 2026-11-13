"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ChangePasswordCard } from "./_components/ChangePasswordCard";
import { CheckCircle2, AlertTriangle, PlayCircle, Lock, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

interface Term {
  id: string;
  name: string;
  sequence: number;
  is_current: boolean;
}

interface SessionWithTerms {
  id: string;
  name: string;
  is_current: boolean;
  terms: Term[];
}

interface Props {
  callAdminApi: (action: string, payload: any) => Promise<any>;
  onLogout: () => void;
  onNavigate: (view: string) => void;
  isOwner: boolean;
}

export default function SettingsTab({ callAdminApi, onLogout, onNavigate, isOwner }: Props) {
  const [sessions, setSessions] = useState<SessionWithTerms[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSessionName, setNewSessionName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Rollover State
  const [unapprovedResultsCount, setUnapprovedResultsCount] = useState(0);
  const [unpromotedStudentsCount, setUnpromotedStudentsCount] = useState(0);
  const [isStartingTerm, setIsStartingTerm] = useState(false);
  const [confirmStartOpen, setConfirmStartOpen] = useState(false);

  const fetchSettingsData = async () => {
    setLoading(true);

    const { data: sess } = await supabase.from("sessions").select("*").order("name", { ascending: false });
    const { data: terms } = await supabase.from("terms").select("*").order("sequence", { ascending: true });

    const grouped: SessionWithTerms[] = (sess || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      is_current: s.is_current,
      terms: (terms || []).filter((t: any) => t.session_id === s.id) as Term[],
    }));
    setSessions(grouped);

    const currentTerm = terms?.find((t: any) => t.is_current);
    if (currentTerm) {
      const { count: resultsCount } = await supabase
        .from("term_records")
        .select("id", { count: "exact", head: true })
        .eq("term_id", currentTerm.id)
        .eq("status", "submitted"); 
      setUnapprovedResultsCount(resultsCount || 0);
    }

    const currentSession = sess?.find((s: any) => s.is_current);
    if (currentSession) {
      const { data: activeEnrolments } = await supabase
        .from("enrolments")
        .select("student_id")
        .eq("session_id", currentSession.id)
        .eq("status", "active");
      
      const { data: nextSessionEnrolments } = await supabase
        .from("enrolments")
        .select("student_id")
        .neq("session_id", currentSession.id) 
        .in("student_id", activeEnrolments?.map(e => e.student_id) || []);

      const promotedCount = nextSessionEnrolments?.length || 0;
      const totalStudents = activeEnrolments?.length || 0;
      setUnpromotedStudentsCount(Math.max(0, totalStudents - promotedCount));
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchSettingsData();
  }, []);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;
    setCreating(true);
    try {
      await callAdminApi("create-session", { name: newSessionName.trim() });
      setNewSessionName("");
      await fetchSettingsData();
      toast.success("Session created.");
    } catch (err: any) {
      toast.error(err.message || "Couldn't create session");
    } finally {
      setCreating(false);
    }
  };

  const handleStartNextTerm = async () => {
    setIsStartingTerm(true);
    try {
      await callAdminApi("start-next-term", {});
      toast.success("Rollover successful! Next term/session started.");
      setConfirmStartOpen(false);
      await fetchSettingsData();
    } catch (err: any) {
      toast.error(err.message || "Failed to start next term");
    } finally {
      setIsStartingTerm(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 text-sm">Loading settings...</div>;

  const currentSession = sessions.find((s) => s.is_current);
  const currentTerm = currentSession?.terms.find((t) => t.is_current);
  
  const isLastTerm = currentTerm?.sequence === 3;
  const isLocked = 
    unapprovedResultsCount > 0 || 
    (isLastTerm && unpromotedStudentsCount > 0) || 
    !currentTerm;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24">
      
      {/* MANAGEMENT SHORTCUTS (Visible to everyone) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate("admins")}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:bg-slate-50 transition text-left"
        >
          <div>
            <h2 className="text-sm font-bold text-slate-800">Manage Admins</h2>
            <p className="text-xs text-slate-500 mt-1">Add or remove head teachers</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </button>

        {/* 🚨 ONLY SHOW PROMOTION BUTTON IN TERM 3 */}
        {isLastTerm && (
          <button
            onClick={() => onNavigate("promotion")}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:bg-slate-50 transition text-left"
          >
            <div>
              <h2 className="text-sm font-bold text-slate-800">Promote Students</h2>
              <p className="text-xs text-slate-500 mt-1">End of session rollover</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        )}
      </div>

      {/* 🚨 END OF TERM CHECKLIST (OWNER ONLY) */}
      {isOwner && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            {isLastTerm ? "End of Session Rollover" : "End of Term Rollover"}
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            You are currently in <strong>{currentSession?.name} · {currentTerm?.name} Term</strong>. 
            To move forward, complete the checklist below.
          </p>

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              {unapprovedResultsCount === 0 ? (
                <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-orange-500 shrink-0" />
              )}
              <div>
                <p className="font-bold text-slate-800">1. Approve all results</p>
                <p className="text-sm text-slate-500">
                  {unapprovedResultsCount === 0 
                    ? "All submitted results have been approved." 
                    : `${unapprovedResultsCount} result(s) are awaiting your approval.`}
                </p>
              </div>
            </div>

            {/* Promotion check only applies to Term 3 */}
            {isLastTerm && (
              <div className="flex items-start gap-3">
                {unpromotedStudentsCount === 0 ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-orange-500 shrink-0" />
                )}
                <div>
                  <p className="font-bold text-slate-800">2. Promote Students</p>
                  <p className="text-sm text-slate-500">
                    {unpromotedStudentsCount === 0 
                      ? "All students have been promoted to their next class." 
                      : `${unpromotedStudentsCount} student(s) have not been promoted.`}
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setConfirmStartOpen(true)}
            disabled={isLocked}
            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-colors ${
              isLocked 
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200" 
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg"
            }`}
          >
            {isLocked ? <Lock className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
            {/* 🚨 SMART BUTTON TEXT */}
            {isLastTerm ? "Start Next Session" : "Start Next Term"}
          </button>
          {isLocked && (
            <p className="text-xs text-center text-slate-400 mt-2">
              Complete the checklist above to enable this button.
            </p>
          )}
        </div>
      )}

      {/* CREATE NEW SESSION (OWNER ONLY) */}
      {isOwner && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-3">Create Next Session (If missing)</h2>
          <form onSubmit={handleCreateSession} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder="e.g. 2026/2027"
              required
              className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={creating}
              className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition whitespace-nowrap"
            >
              {creating ? "Creating..." : "Create Session"}
            </button>
          </form>
        </div>
      )}

      {/* SESSIONS LIST */}
      <div className="space-y-3">
        {sessions.map((sess) => {
          const expanded = expandedSessionId === sess.id;
          const isCurrent = sess.is_current;
          
          return (
            <div
              key={sess.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition ${
                isCurrent ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200"
              }`}
            >
              <button
                onClick={() => setExpandedSessionId(expanded ? null : sess.id)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-50 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900">{sess.name}</h3>
                    {isCurrent && (
                      <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase font-bold">Current</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {sess.terms.length} terms · currently on {sess.terms.find(t => t.is_current)?.name || "none"}
                  </p>
                </div>
                {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {expanded && (
                <div className="border-t border-slate-100 p-4 sm:p-5 space-y-3 bg-slate-50">
                  {/* TERMS LIST */}
                  {sess.terms.map((term) => (
                    <div
                      key={term.id}
                      className={`p-4 rounded-xl border bg-white space-y-3 ${
                        term.is_current ? "border-blue-400 ring-1 ring-blue-300/40" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800 text-sm">{term.name} Term</h4>
                          {term.is_current && (
                            <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase font-bold">Current</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ChangePasswordCard />
      <button onClick={onLogout} className="w-full p-4 bg-red-50 border border-red-200 rounded-2xl text-center font-bold text-red-600 active:bg-red-100 mt-8">Sign Out</button>

      {/* 🚨 SMART CONFIRM DIALOG */}
      <ConfirmDialog
        open={confirmStartOpen}
        onOpenChange={setConfirmStartOpen}
        title={isLastTerm ? "Start the Next Session?" : "Start the Next Term?"}
        description={
          isLastTerm 
            ? `This will close the ${currentSession?.name} session, automatically copy all classes into the next session, and start Term 1. This cannot be undone.`
            : `This will close ${currentTerm?.name} Term and make the next term current. This cannot be undone.`
        }
        confirmLabel={isLastTerm ? "Yes, Start Next Session" : "Yes, Start Next Term"}
        destructive={true}
        loading={isStartingTerm}
        onConfirm={handleStartNextTerm}
      />
    </div>
  );
}