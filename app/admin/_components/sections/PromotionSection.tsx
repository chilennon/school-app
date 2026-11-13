"use client";

import { useState, useEffect } from "react";
import { AlertCircle, PlayCircle, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { SectionHeader } from "../SectionHeader";

interface PromotionSectionProps {
  currentSessionId: string;
  currentSessionName: string;
  currentTermSequence: number; // 🚨 Added prop
  onBack: () => void;
  onComplete: () => void;
}

type StudentDecision = {
  id: string;
  name: string;
  average: number;
  currentClass: string;
  action: "promote" | "repeat" | "graduate" | "withdrawn";
  targetClass: string;
  isFinalClass: boolean;
};

export function PromotionSection({
  currentSessionId,
  currentSessionName,
  currentTermSequence, // 🚨 Destructured
  onBack,
  onComplete,
}: PromotionSectionProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [students, setStudents] = useState<StudentDecision[]>([]);
  const [passMark, setPassMark] = useState(40);
  const [showModal, setShowModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");

  useEffect(() => {
    // 🚨 Don't fetch data if it's not Term 3
    if (currentTermSequence !== 3) {
      setLoading(false);
      return;
    }

    async function loadData() {
      // 1. Fetch school pass mark
      const { data: school } = await supabase
        .from("schools")
        .select("promotion_threshold")
        .single();
      setPassMark(school?.promotion_threshold ?? 40);

      // 2. Fetch all classes for this session to determine the ladder
      const { data: classData } = await supabase
        .from("classes")
        .select("id, name")
        .eq("session_id", currentSessionId)
        .order("name", { ascending: true });

      const sortedClasses = classData || [];

      // 3. Fetch all active enrolments + student names
      const { data: enrolData } = await supabase
        .from("enrolments")
        .select(`id, student:students(id, name), class_id`)
        .eq("session_id", currentSessionId)
        .eq("status", "active");

      if (!enrolData || enrolData.length === 0) {
        setLoading(false);
        return;
      }

      const enrolIds = enrolData.map((e) => e.id);

      // 4. Fetch scores and term records for these enrolments
      const [scoresRes, recordsRes] = await Promise.all([
        supabase.from("scores").select("*").in("enrolment_id", enrolIds),
        supabase
          .from("term_records")
          .select("enrolment_id, status")
          .in("enrolment_id", enrolIds),
      ]);

      const allScores = scoresRes.data || [];

      // 5. Build the decisions list
      const decisionList: StudentDecision[] = enrolData.map((e: any) => {
        const studentScores = allScores.filter((s) => s.enrolment_id === e.id);
        const total = studentScores.reduce(
          (sum, s) => sum + (s.ca_score || 0) + (s.exam_score || 0) + (s.sa_score || 0),
          0
        );
        const avg = studentScores.length > 0 ? total / studentScores.length : 0;

        const currentClassIndex = sortedClasses.findIndex((c) => c.id === e.class_id);
        const currentClassName =
          currentClassIndex !== -1 ? sortedClasses[currentClassIndex].name : "Unknown";
        const isFinalClass = currentClassIndex === sortedClasses.length - 1;
        const nextClassName = isFinalClass
          ? "Graduate"
          : sortedClasses[currentClassIndex + 1]?.name ?? "Graduate";

        return {
          id: e.student.id,
          name: e.student.name,
          average: avg,
          currentClass: currentClassName,
          action: isFinalClass ? "graduate" : "promote",
          targetClass: nextClassName,
          isFinalClass,
        };
      });

      decisionList.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(decisionList);
      setNewSessionName(suggestNextSession(currentSessionName));
      setLoading(false);
    }

    loadData();
  }, [currentSessionId, currentSessionName, currentTermSequence]);

  const handleActionChange = (
    studentId: string,
    action: "promote" | "repeat" | "graduate" | "withdrawn"
  ) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, action } : s))
    );
  };

  const handleExecute = async () => {
    if (!newSessionName.trim()) {
      toast.error("Please enter a name for the new session.");
      return;
    }

    setSubmitting(true);
    try {
      const decisions = students.map((s) => ({
        student_id: s.id,
        action: s.action,
        target_class_name: s.action === "promote" ? s.targetClass : s.currentClass,
      }));

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "execute-session-rollover",
          newSessionName: newSessionName.trim(),
          decisions,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error || "Rollover failed");

      toast.success("Session rolled over successfully!");
      setShowModal(false);
      onComplete();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
      </div>
    );
  }

  // 🚨 THE GUARDRAIL: Lock the page if it's not Term 3
  if (currentTermSequence !== 3) {
    return (
      <div>
        <SectionHeader title="Promotions" onBack={onBack} />
        <div className="p-8 max-w-lg mx-auto mt-8">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Lock className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Promotions Unlock in Term 3</h2>
            <p className="text-sm text-slate-500">
              Students only move to a new class at the end of the academic session (Third Term). 
              In Term 1 and Term 2, they simply move to the next term in the same class.
            </p>
            <button onClick={onBack} className="mt-4 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl w-full transition-colors">
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const promoteCount = students.filter((s) => s.action === "promote").length;
  const repeatCount = students.filter((s) => s.action === "repeat").length;
  const leavingCount = students.filter(
    (s) => s.action === "graduate" || s.action === "withdrawn"
  ).length;

  return (
    <div className="pb-24">
      <SectionHeader
        title="Promotion & Rollover"
        subtitle={`${currentSessionName} End of Session`}
        onBack={onBack}
      />

      <div className="p-4 max-w-3xl mx-auto space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-900 text-sm">
          Review the decisions below. Everyone defaults to <strong>Promote</strong>. Change only the exceptions (Repeat / Graduate / Left).
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {students.map((s) => {
            const isBelowPass = s.average < passMark;
            const isLeaving = s.action === "graduate" || s.action === "withdrawn";
            const showBelowPassBadge = isBelowPass && !isLeaving;

            return (
              <div
                key={s.id}
                className="p-4 border-b border-slate-100 last:border-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <p className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                    {s.name}
                    {showBelowPassBadge && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Below Pass Mark (
                        {s.average.toFixed(1)}%)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {s.currentClass}
                    {s.action === "promote" && ` → ${s.targetClass}`}
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {!s.isFinalClass && (
                    <button
                      onClick={() => handleActionChange(s.id, "promote")}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                        s.action === "promote"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Promote
                    </button>
                  )}
                  <button
                    onClick={() => handleActionChange(s.id, "repeat")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                      s.action === "repeat"
                        ? "bg-orange-500 text-white"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Repeat
                  </button>
                  {s.isFinalClass ? (
                    <button
                      onClick={() => handleActionChange(s.id, "graduate")}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                        s.action === "graduate"
                          ? "bg-slate-800 text-white"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Graduate
                    </button>
                  ) : null}
                  <button
                    onClick={() => handleActionChange(s.id, "withdrawn")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                      s.action === "withdrawn"
                        ? "bg-red-500 text-white"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Left
                  </button>
                </div>
              </div>
            );
          })}
          {students.length === 0 && (
            <p className="p-8 text-center text-slate-500 text-sm">
              No active students found for this session.
            </p>
          )}
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <p className="text-sm font-bold text-slate-700 hidden sm:block">
            {promoteCount} Promote · {repeatCount} Repeat · {leavingCount} Leaving
          </p>
          <button
            onClick={() => setShowModal(true)}
            disabled={students.length === 0}
            className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <PlayCircle className="w-5 h-5" /> Start Next Session
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-xl font-bold text-slate-900">Execute Rollover</h3>
            <p className="text-sm text-slate-500">
              This will close <strong>{currentSessionName}</strong>, create a new session, copy all classes, and move the students.
            </p>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                New Session Name
              </label>
              <input
                type="text"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="bg-amber-50 text-amber-900 p-3 rounded-lg text-xs">
              <strong>Summary:</strong> {promoteCount} promoted, {repeatCount} repeating, {leavingCount} leaving.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                disabled={submitting}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function suggestNextSession(current: string): string {
  const match = current.match(/(\d{4})\/(\d{4})/);
  if (match) {
    return `${parseInt(match[1]) + 1}/${parseInt(match[2]) + 1}`;
  }
  return "";
}