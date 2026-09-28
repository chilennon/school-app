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
  load: () => Promise<void>;
  openReview: (
    classId: string,
    termId: string,
    sessionId: string,
  ) => Promise<void>;
  closeReview: () => void;
  setReviewStudents: React.Dispatch<React.SetStateAction<ReviewStudent[]>>;
}

export function useApprovals(): ApprovalsState {
  const [pendingClasses, setPendingClasses] = useState<PendingClass[]>([]);
  const [reviewClassId, setReviewClassId] = useState<string | null>(null);
  const [reviewStudents, setReviewStudents] = useState<ReviewStudent[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: records, error: recErr } = await supabase
      .from("term_records")
      .select("enrolment_id, term_id, status")
      .in("status", ["submitted", "approved"]);

    if (recErr) {
      console.error("Failed to load approvals:", recErr);
      setLoading(false);
      return;
    }
    if (!records || records.length === 0) {
      setPendingClasses([]);
      setLoading(false);
      return;
    }

    const enrolmentIds = Array.from(
      new Set(records.map((r) => r.enrolment_id)),
    );
    const termIds = Array.from(new Set(records.map((r) => r.term_id)));

    const [enrolsRes, termsRes] = await Promise.all([
      supabase
        .from("enrolments")
        .select("id, class_id, session_id")
        .in("id", enrolmentIds),
      supabase.from("terms").select("id, name").in("id", termIds),
    ]);

    const enrols = enrolsRes.data || [];
    const terms = termsRes.data || [];

    if (enrols.length === 0) {
      setPendingClasses([]);
      setLoading(false);
      return;
    }

    const classIds = Array.from(new Set(enrols.map((e) => e.class_id)));

    const [classRowsRes, allEnrolsRes] = await Promise.all([
      supabase
        .from("classes")
        .select("id, name, session, session_id")
        .in("id", classIds),
      supabase
        .from("enrolments")
        .select("id, class_id")
        .in("class_id", classIds)
        .eq("status", "active"),
    ]);

    const classRows = classRowsRes.data || [];
    const allEnrols = allEnrolsRes.data || [];

    const classById: Record<string, any> = {};
    classRows.forEach((c) => {
      classById[c.id] = c;
    });

    const termNameById: Record<string, string> = {};
    terms.forEach((t) => {
      termNameById[t.id] = t.name;
    });

    const totalByClass: Record<string, number> = {};
    allEnrols.forEach((e) => {
      totalByClass[e.class_id] = (totalByClass[e.class_id] || 0) + 1;
    });

    const enrolToClass: Record<string, string> = {};
    enrols.forEach((e) => {
      enrolToClass[e.id] = e.class_id;
    });

    const byKey: Record<
      string,
      { classId: string; termId: string; submitted: number; approved: number }
    > = {};

    records.forEach((r) => {
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
        return {
          classId,
          className: c?.name || "—",
          sessionName: c?.session || "—",
          termLabel: `${termNameById[termId] || "Term"} Term`,
          termId,
          sessionId: c?.session_id || "",
          submittedCount: submitted,
          approvedCount: approved,
          totalStudents: totalByClass[classId] || 0,
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
        .select("enrolment_id, status, head_teacher_comment, approved_at")
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