"use client";

import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { PendingClass, ReviewStudent } from "../_lib/types";

export interface ApprovalsState {
  pendingClasses: PendingClass[];
  reviewClassId: string | null;
  reviewStudents: ReviewStudent[];
  reviewLoading: boolean;
  loading: boolean;
  load: (currentSessionId: string) => Promise<void>;
  openReview: (classId: string, termId: string, sessionId: string) => Promise<void>;
  closeReview: () => void;
  setReviewStudents: React.Dispatch<React.SetStateAction<ReviewStudent[]>>;
}

export function useApprovals(): ApprovalsState {
  const [pendingClasses, setPendingClasses] = useState<PendingClass[]>([]);
  const [reviewClassId, setReviewClassId] = useState<string | null>(null);
  const [reviewStudents, setReviewStudents] = useState<ReviewStudent[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (currentSessionId: string) => {
    setLoading(true);

    const { data: classesData } = await supabase
      .from("classes")
      .select("id, name, session, session_id")
      .eq("session_id", currentSessionId);

    if (!classesData || classesData.length === 0) {
      setPendingClasses([]);
      setLoading(false);
      return;
    }

    const classIds = classesData.map(c => c.id);

    const { data: enrolsData } = await supabase
      .from("enrolments")
      .select("id, class_id")
      .in("class_id", classIds)
      .eq("status", "active");

    if (!enrolsData || enrolsData.length === 0) {
      setPendingClasses([]);
      setLoading(false);
      return;
    }

    const enrolmentIds = enrolsData.map(e => e.id);

    const { data: recordsData } = await supabase
      .from("term_records")
      .select("enrolment_id, term_id, status, promotion_status")
      .in("enrolment_id", enrolmentIds)
      .in("status", ["submitted", "approved"]);

    if (!recordsData || recordsData.length === 0) {
      setPendingClasses([]);
      setLoading(false);
      return;
    }

    const termIds = Array.from(new Set(recordsData.map(r => r.term_id)));
    
    // 🚨 Fetch is_current and sequence
    const { data: termsData } = await supabase
      .from("terms")
      .select("id, name, is_current, sequence")
      .in("id", termIds);

    const termInfoById: Record<string, any> = {};
    (termsData || []).forEach(t => termInfoById[t.id] = t);

    const classById: Record<string, any> = {};
    classesData.forEach(c => classById[c.id] = c);

    const enrolToClass: Record<string, string> = {};
    enrolsData.forEach(e => enrolToClass[e.id] = e.class_id);

    const totalByClass: Record<string, number> = {};
    enrolsData.forEach(e => {
      totalByClass[e.class_id] = (totalByClass[e.class_id] || 0) + 1;
    });

    const byKey: Record<string, { classId: string; termId: string; submitted: number; approved: number }> = {};

    recordsData.forEach((r) => {
      const classId = enrolToClass[r.enrolment_id];
      if (!classId) return;
      const key = `${classId}::${r.term_id}`;
      if (!byKey[key]) {
        byKey[key] = { classId, termId: r.term_id, submitted: 0, approved: 0 };
      }
      if (r.status === "submitted") byKey[key].submitted++;
      if (r.status === "approved") byKey[key].approved++;
    });

    const list: PendingClass[] = Object.values(byKey).map(
      ({ classId, termId, submitted, approved }) => {
        const c = classById[classId];
        const tInfo = termInfoById[termId] || {};
        
        return {
          classId,
          className: c?.name || "—",
          sessionName: c?.session || "—",
          termLabel: `${tInfo.name || "Term"} Term`,
          termId,
          sessionId: c?.session_id || "",
          submittedCount: submitted,
          approvedCount: approved,
          totalStudents: totalByClass[classId] || 0,
          isCurrentTerm: tInfo.is_current || false, // 🚨 Added
          termSequence: tInfo.sequence || 0,        // 🚨 Added
        };
      },
    );

    setPendingClasses(list);
    setLoading(false);
  }, []);

  const openReview = useCallback(
    async (classId: string, termId: string, sessionId: string) => {
      setReviewClassId(classId);
      setReviewLoading(true);
      setReviewStudents([]);

      const { data: enrols } = await supabase
        .from("enrolments")
        .select(`id, student:students (id, name, reg_no)`)
        .eq("class_id", classId)
        .eq("session_id", sessionId)
        .eq("status", "active");

      if (!enrols) {
        setReviewLoading(false);
        return;
      }

      const enrolmentIds = enrols.map((e: any) => e.id);

      const { data: records } = await supabase
        .from("term_records")
        .select("enrolment_id, status, head_teacher_comment, approved_at, promotion_status")
        .in("enrolment_id", enrolmentIds)
        .eq("term_id", termId);

      const recordByEnrolment: Record<string, any> = {};
      (records || []).forEach((r: any) => {
        recordByEnrolment[r.enrolment_id] = r;
      });

      const built: ReviewStudent[] = enrols.map((e: any) => {
        const rec = recordByEnrolment[e.id];
        return {
          enrolmentId: e.id,
          name: e.student?.name || "—",
          regNo: e.student?.reg_no || "—",
          status: rec?.status || "draft",
          comment: rec?.head_teacher_comment || "",
          promotion: rec?.promotion_status || "",
          approvedAt: rec?.approved_at || null,
        };
      });

      built.sort((a, b) => a.name.localeCompare(b.name));
      setReviewStudents(built);
      setReviewLoading(false);
    },
    [],
  );

  const closeReview = useCallback(() => {
    setReviewClassId(null);
    setReviewStudents([]);
  }, []);

  return {
    pendingClasses,
    reviewClassId,
    reviewStudents,
    reviewLoading,
    loading,
    load,
    openReview,
    closeReview,
    setReviewStudents,
  };
}