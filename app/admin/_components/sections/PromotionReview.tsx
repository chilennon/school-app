"use client";

import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { SectionHeader } from "../SectionHeader";

interface PromotionReviewProps {
  classId: string;
  currentSessionId: string;
  nextSessionId: string;
  passMark: number;
  onBack: () => void;
  onComplete: () => void;
}

type StudentReview = {
  id: string;
  name: string;
  enrolmentId: string;
  average: number;
  status: "draft" | "submitted" | "approved";
  action: "promote" | "repeat" | "graduate" | "withdrawn";
};

export function PromotionReview({
  classId,
  currentSessionId,
  nextSessionId,
  passMark,
  onBack,
  onComplete,
}: PromotionReviewProps) {
  const [loading, setLoading] = useState(true);
  const [classInfo, setClassInfo] = useState<any>(null);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [targetClassId, setTargetClassId] = useState<string>(""); // 🚨 Explicit Target
  const [students, setStudents] = useState<StudentReview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      // 1. Fetch the current class
      const { data: cls } = await supabase.from("classes").select("*").eq("id", classId).single();
      setClassInfo(cls);

      // 2. Fetch ALL classes in the NEXT session (except the one we are leaving)
      const { data: nextClasses } = await supabase
        .from("classes")
        .select("id, name")
        .eq("session_id", nextSessionId)
        .neq("name", cls?.name) // Don't promote to self
        .order("name", { ascending: true }); // Alphabetical for easy selection

      setAvailableClasses(nextClasses || []);
      
      // Default to the first available class (or Graduate if none exist)
      if (nextClasses && nextClasses.length > 0) {
        setTargetClassId(nextClasses[0].id);
      } else {
        setTargetClassId("graduate");
      }

      // 3. Fetch Enrolments
      const { data: enrols } = await supabase
        .from("enrolments")
        .select("id, student_id, student:students(name)")
        .eq("class_id", classId)
        .eq("session_id", currentSessionId)
        .eq("status", "active");

      if (!enrols) {
        setLoading(false);
        return;
      }

      const enrolmentIds = enrols.map((e) => e.id);

      const [scoresRes, recordsRes] = await Promise.all([
        supabase.from("scores").select("*").in("enrolment_id", enrolmentIds),
        supabase.from("term_records").select("enrolment_id, status, promotion_status").in("enrolment_id", enrolmentIds)
      ]);

      const allScores = scoresRes.data || [];
      const records = recordsRes.data || [];

      const reviewedStudents: StudentReview[] = enrols.map((e: any) => {
        const studentScores = allScores.filter((s) => s.enrolment_id === e.id);
        const totalScore = studentScores.reduce((sum, s) => sum + (s.ca_score || 0) + (s.exam_score || 0) + (s.sa_score || 0), 0);
        const subjectCount = studentScores.length;
        const avg = subjectCount > 0 ? totalScore / subjectCount : 0;
        
        const term3Record = records.find((r) => r.enrolment_id === e.id && r.status === "approved"); 
        
        // Default action: if a target class is selected, "promote". If "graduate", "graduate".
        let action: "promote" | "repeat" | "graduate" | "withdrawn" = 
          (nextClasses && nextClasses.length > 0) ? "promote" : "graduate";
          
        if (term3Record?.promotion_status === "repeat") action = "repeat";
        if (term3Record?.promotion_status === "graduated" || term3Record?.promotion_status === "withdrawn") action = "withdrawn";

        return {
          id: e.student_id,
          name: e.student?.name || "Unknown",
          enrolmentId: e.id,
          average: avg,
          status: term3Record?.status || "draft",
          action,
        };
      });

      setStudents(reviewedStudents);
      setLoading(false);
    }

    loadData();
  }, [classId, currentSessionId, nextSessionId]);

  const handleActionChange = (studentId: string, action: "promote" | "repeat" | "graduate" | "withdrawn") => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, action } : s))
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const decisions = students.map((s) => ({
        student_id: s.id,
        action: s.action,
        // If they are promoted, send the target class ID. If not, send their current class ID (repeat).
        next_class_id: s.action === "promote" ? targetClassId : (s.action === "repeat" ? classId : null),
      }));

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "promote-class",
          classId,
          currentSessionId,
          nextSessionId,
          decisions,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error || "Promotion failed");
      onComplete();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to promote students.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const counts = useMemo(() => {
    return students.reduce(
      (acc, curr) => {
        acc[curr.action]++;
        return acc;
      },
      { promote: 0, repeat: 0, graduate: 0, withdrawn: 0 }
    );
  }, [students]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading class results...</div>;

  const allApproved = students.every((s) => s.status === "approved");

  return (
    <div>
      <SectionHeader
        title={`${classInfo?.name} Rollover`}
        onBack={onBack}
      />
      
      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        {/* 🚨 THE CRITICAL FIX: TARGET CLASS DROPDOWN */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <label className="block text-sm font-bold text-blue-900 mb-2">
            Where are these students going?
          </label>
          <select
            value={targetClassId}
            onChange={(e) => {
              const val = e.target.value;
              setTargetClassId(val);
              // If they change the target to Graduate, automatically set all default actions to Graduate
              if (val === "graduate") {
                setStudents(prev => prev.map(s => s.action === "promote" ? { ...s, action: "graduate" } : s));
              } else {
                setStudents(prev => prev.map(s => s.action === "graduate" ? { ...s, action: "promote" } : s));
              }
            }}
            className="w-full bg-white border border-blue-300 rounded-xl px-4 py-3 text-lg font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-500"
          >
            {availableClasses.map((c) => (
              <option key={c.id} value={c.id}>Promote to {c.name}</option>
            ))}
            <option value="graduate">Graduate (Leave School)</option>
          </select>
        </div>

        {allApproved ? (
          <div className="bg-green-50 text-green-800 p-3 rounded-xl text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> Reports approved by the Head · pass mark {passMark}%
          </div>
        ) : (
          <div className="bg-orange-50 text-orange-800 p-3 rounded-xl text-sm font-medium flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> Warning: Some results are not yet approved by the Head.
          </div>
        )}

        <div className="flex gap-2">
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-bold flex-1 text-center">
            {counts.promote} promote
          </div>
          <div className="bg-orange-50 text-orange-700 px-4 py-2 rounded-xl text-sm font-bold flex-1 text-center">
            {counts.repeat} repeat
          </div>
          <div className="bg-red-50 text-red-700 px-4 py-2 rounded-xl text-sm font-bold flex-1 text-center">
            {counts.graduate + counts.withdrawn} leaving
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {students.map((s) => (
            <div key={s.id} className="p-4 border-b border-slate-100 last:border-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-bold text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-500 font-medium">
                  Average: {s.average.toFixed(1)}% 
                  {s.average < passMark && <span className="text-orange-500 ml-2">· Below pass mark</span>}
                </p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleActionChange(s.id, targetClassId === "graduate" ? "graduate" : "promote")}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                    (s.action === "promote" || s.action === "graduate") ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600"
                  }`}
                >
                  {targetClassId === "graduate" ? "Graduate" : "Promote"}
                </button>
                <button
                  onClick={() => handleActionChange(s.id, "repeat")}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                    s.action === "repeat" ? "bg-orange-500 text-white" : "bg-slate-50 text-slate-600"
                  }`}
                >
                  Repeat
                </button>
                <button
                  onClick={() => handleActionChange(s.id, "withdrawn")}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                    s.action === "withdrawn" ? "bg-red-500 text-white" : "bg-slate-50 text-slate-600"
                  }`}
                >
                  Left
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting || students.length === 0}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50"
        >
          {isSubmitting ? "Processing..." : `Finalize Rollover`}
        </button>

      </div>
    </div>
  );
}