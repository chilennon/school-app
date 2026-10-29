"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { SectionHeader } from "../SectionHeader";
import type { ClassRoom } from "@/types/school";

interface PromotionReviewProps {
  classId: string;
  currentSessionId: string;
  nextSessionId: string;
  passMark: number; // e.g., 40
  onBack: () => void;
  onComplete: () => void;
}

type StudentReview = {
  id: string;
  name: string;
  enrolmentId: string;
  average: number;
  status: "draft" | "submitted" | "approved";
  action: "promote" | "repeat" | "withdrawn";
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
  const [nextClass, setNextClass] = useState<any>(null);
  const [students, setStudents] = useState<StudentReview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      // 1. Fetch the current class
      const { data: cls } = await supabase.from("classes").select("*").eq("id", classId).single();
      
      // 2. Fetch the NEXT class from the ladder
      const { data: next } = await supabase
        .from("classes")
        .select("*")
        .eq("session_id", nextSessionId)
        .gt("sort_order", cls?.sort_order || 0)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();

      setClassInfo(cls);
      setNextClass(next);

      // 3. Fetch Enrolments for this class in the CURRENT session
      const { data: enrols } = await supabase
        .from("enrolments")
        .select("id, student_id, student:students(name)")
        .eq("class_id", classId)
        .eq("session_id", currentSessionId)
        .eq("status", "active");

      if (!enrols) return;

      const enrolmentIds = enrols.map((e) => e.id);

      // 4. Fetch Scores & Term Records to calculate averages and check approval
      const [scoresRes, recordsRes] = await Promise.all([
        supabase.from("scores").select("*").in("enrolment_id", enrolmentIds),
        supabase.from("term_records").select("enrolment_id, status").in("enrolment_id", enrolmentIds).eq("term_id", currentSessionId) // Assuming term_id or session_id link
      ]);

      const allScores = scoresRes.data || [];
      const records = recordsRes.data || [];

      // 5. Calculate averages and determine default action
      const reviewedStudents: StudentReview[] = enrols.map((e: any) => {
        // Calculate total score across all subjects for this student
        const studentScores = allScores.filter((s) => s.enrolment_id === e.id);
        const totalScore = studentScores.reduce((sum, s) => sum + (s.ca_score || 0) + (s.exam_score || 0), 0);
        const subjectCount = studentScores.length;
        const avg = subjectCount > 0 ? totalScore / subjectCount : 0;
        
        // Check approval status
        const record = records.find((r) => r.enrolment_id === e.id);
        const status = record?.status || "draft";

        return {
          id: e.student_id,
          name: e.student?.name || "Unknown",
          enrolmentId: e.id,
          average: avg,
          status,
          action: "promote",
        };
      });

      setStudents(reviewedStudents);
      setLoading(false);
    }

    loadData();
  }, [classId, currentSessionId, nextSessionId, passMark]);

  const handleActionChange = (studentId: string, action: "promote" | "repeat" | "withdrawn") => {
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
        next_class_id: s.action === "promote" ? nextClass?.id : classId,
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
    } catch (err) {
      console.error(err);
      alert("Failed to promote students.");
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
      { promote: 0, repeat: 0, withdrawn: 0 }
    );
  }, [students]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading class results...</div>;

  const allApproved = students.every((s) => s.status === "approved");

  return (
    <div>
      <SectionHeader
        title={`${classInfo?.name} to ${nextClass?.name || "Next"}`}
        onBack={onBack}
      />
      
      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        {/* STATUS BANNER */}
        {allApproved ? (
          <div className="bg-green-50 text-green-800 p-3 rounded-xl text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> Reports approved by the Head · pass mark {passMark}%
          </div>
        ) : (
          <div className="bg-orange-50 text-orange-800 p-3 rounded-xl text-sm font-medium flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> Warning: Some results are not yet approved by the Head.
          </div>
        )}

        {/* SUMMARY COUNTS */}
        <div className="flex gap-2">
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-bold flex-1 text-center">
            {counts.promote} promote
          </div>
          <div className="bg-orange-50 text-orange-700 px-4 py-2 rounded-xl text-sm font-bold flex-1 text-center">
            {counts.repeat} repeat
          </div>
          <div className="bg-red-50 text-red-700 px-4 py-2 rounded-xl text-sm font-bold flex-1 text-center">
            {counts.withdrawn} left
          </div>
        </div>

        {/* STUDENT LIST */}
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
                  onClick={() => handleActionChange(s.id, "promote")}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                    s.action === "promote" ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600"
                  }`}
                >
                  Promote
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

        {/* ACTION BUTTON */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50"
        >
          {isSubmitting ? "Promoting..." : `Promote ${counts.promote}, repeat ${counts.repeat}`}
        </button>

      </div>
    </div>
  );
}