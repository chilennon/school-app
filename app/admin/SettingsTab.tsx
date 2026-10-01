"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ChangePasswordCard } from "./_components/ChangePasswordCard";

interface Term {
  id: string;
  name: string;
  sequence: number;
  is_current: boolean;
  days_opened: number | null;
  next_term_begins: string | null;
}

interface SessionWithTerms {
  id: string;
  name: string;
  is_current: boolean;
  terms: Term[];
}

interface Props {
  callAdminApi: (action: string, payload: any) => Promise<any>;
}

export default function SettingsTab({ callAdminApi }: Props) {
  const [sessions, setSessions] = useState<SessionWithTerms[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSessionName, setNewSessionName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  const [pendingCurrentSessionId, setPendingCurrentSessionId] = useState<string | null>(null);

  const [termEdits, setTermEdits] = useState<
    Record<string, { next_term_begins: string; days_opened: string }>
  >({});

  const fetchSessions = async () => {
    setLoading(true);
    const { data: sess } = await supabase
      .from("sessions")
      .select("*")
      .order("name", { ascending: false });

    const { data: terms } = await supabase
      .from("terms")
      .select("*")
      .order("sequence", { ascending: true });

    const grouped: SessionWithTerms[] = (sess || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      is_current: s.is_current,
      terms: (terms || []).filter((t: any) => t.session_id === s.id) as Term[],
    }));

    setSessions(grouped);

    const edits: Record<string, { next_term_begins: string; days_opened: string }> = {};
    (terms || []).forEach((t: any) => {
      edits[t.id] = {
        next_term_begins: t.next_term_begins || "",
        days_opened: t.days_opened != null ? String(t.days_opened) : "",
      };
    });
    setTermEdits(edits);

    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;
    setCreating(true);
    try {
      await callAdminApi("create-session", { name: newSessionName.trim() });
      setNewSessionName("");
      await fetchSessions();
      toast.success("Session created.");
    } catch (err: any) {
      toast.error(err.message || "Couldn't create session");
    } finally {
      setCreating(false);
    }
  };

  // Opens dialog
  const handleSetCurrentSession = (sessionId: string) => {
    setPendingCurrentSessionId(sessionId);
  };

  // Does the work
  const confirmSetCurrentSession = async () => {
    if (!pendingCurrentSessionId) return;
    setBusyId(pendingCurrentSessionId);
    try {
      await callAdminApi("set-current-session", { sessionId: pendingCurrentSessionId });
      await fetchSessions();
      toast.success("Current session updated.");
      setPendingCurrentSessionId(null);
    } catch (err: any) {
      toast.error(err.message || "Couldn't change session");
    } finally {
      setBusyId(null);
    }
  };

  const handleSetCurrentTerm = async (termId: string) => {
    setBusyId(termId);
    try {
      await callAdminApi("set-current-term", { termId });
      await fetchSessions();
      toast.success("Current term updated.");
    } catch (err: any) {
      toast.error(err.message || "Couldn't change term");
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveTerm = async (termId: string) => {
    setBusyId(termId);
    try {
      const edit = termEdits[termId];
      await callAdminApi("update-term", {
        termId,
        next_term_begins: edit.next_term_begins,
        days_opened: edit.days_opened,
      });
      await fetchSessions();
      toast.success("Term details saved.");
    } catch (err: any) {
      toast.error(err.message || "Couldn't save term");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        Loading settings...
      </div>
    );
  }

  const currentSession = sessions.find((s) => s.is_current);

  const pendingSessionName = pendingCurrentSessionId
    ? sessions.find((s) => s.id === pendingCurrentSessionId)?.name ?? "this session"
    : "";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Current session banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
          Current Session
        </p>
        {currentSession ? (
          <>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              {currentSession.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Current term:{" "}
              <span className="font-semibold">
                {currentSession.terms.find((t) => t.is_current)?.name || "none"}
              </span>
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500 mt-1">
            No session marked as current. Pick one below.
          </p>
        )}
      </div>

      {/* Create session */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-sm sm:text-base font-bold text-slate-800 mb-3">
          Create New Session
        </h2>
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
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition whitespace-nowrap"
          >
            {creating ? "Creating..." : "Create Session"}
          </button>
        </form>
        <p className="text-[10px] text-slate-400 mt-2">
          Each new session gets First, Second, and Third terms automatically.
        </p>
      </div>

      {/* Sessions list */}
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
                      <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase font-bold">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {sess.terms.length} term{sess.terms.length !== 1 ? "s" : ""}
                    {sess.terms.find((t) => t.is_current) && (
                      <> · on {sess.terms.find((t) => t.is_current)?.name}</>
                    )}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {expanded ? "▲" : "▼"}
                </span>
              </button>

              {expanded && (
                <div className="border-t border-slate-100 p-4 sm:p-5 space-y-3 bg-slate-50">
                  {!isCurrent && (
                    <button
                      onClick={() => handleSetCurrentSession(sess.id)}
                      disabled={busyId === sess.id}
                      className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold px-3 py-1.5 rounded-lg transition"
                    >
                      {busyId === sess.id
                        ? "Setting..."
                        : `Make ${sess.name} the current session`}
                    </button>
                  )}

                  {sess.terms.map((term) => {
                    const edit = termEdits[term.id] || {
                      next_term_begins: "",
                      days_opened: "",
                    };
                    return (
                      <div
                        key={term.id}
                        className={`p-4 rounded-xl border bg-white space-y-3 ${
                          term.is_current
                            ? "border-blue-400 ring-1 ring-blue-300/40"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-800 text-sm">
                              {term.name} Term
                            </h4>
                            {term.is_current && (
                              <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase font-bold">
                                Current
                              </span>
                            )}
                          </div>
                          {!term.is_current && isCurrent && (
                            <button
                              onClick={() => handleSetCurrentTerm(term.id)}
                              disabled={busyId === term.id}
                              className="text-[11px] bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 font-semibold px-2.5 py-1 rounded-lg transition"
                            >
                              Mark current
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                              Next term begins
                            </label>
                            <input
                              type="date"
                              value={edit.next_term_begins}
                              onChange={(e) =>
                                setTermEdits((prev) => ({
                                  ...prev,
                                  [term.id]: {
                                    ...prev[term.id],
                                    next_term_begins: e.target.value,
                                  },
                                }))
                              }
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                              Days opened
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={edit.days_opened}
                              onChange={(e) =>
                                setTermEdits((prev) => ({
                                  ...prev,
                                  [term.id]: {
                                    ...prev[term.id],
                                    days_opened: e.target.value,
                                  },
                                }))
                              }
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => handleSaveTerm(term.id)}
                          disabled={busyId === term.id}
                          className="text-[11px] bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold px-3 py-1.5 rounded-lg transition"
                        >
                          {busyId === term.id ? "Saving..." : "Save term details"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ChangePasswordCard />

      <ConfirmDialog
        open={pendingCurrentSessionId !== null}
        onOpenChange={(open) => !open && setPendingCurrentSessionId(null)}
        title="Make this the current session?"
        description={
          pendingSessionName
            ? `${pendingSessionName} will become the active session. Teachers and dashboards will reflect this immediately.`
            : "Teachers and dashboards will reflect this immediately."
        }
        confirmLabel="Set Current"
        loading={busyId === pendingCurrentSessionId}
        onConfirm={confirmSetCurrentSession}
      />
    </div>
  );
}