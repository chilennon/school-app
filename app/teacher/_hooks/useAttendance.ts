"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface AttendanceRow {
  enrolmentId: string;
  date: string;
  status: "present" | "absent";
}

export interface AttendanceState {
  loading: boolean;
  rows: AttendanceRow[];
  refresh: () => Promise<void>;
}

export function useAttendance(classId: string | null): AttendanceState {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AttendanceRow[]>([]);

  const refresh = useCallback(async () => {
    if (!classId) {
      setRows([]);
      return;
    }
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    const schoolId = profile?.school_id;
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const { data: enrols } = await supabase
      .from("enrolments")
      .select("id")
      .eq("class_id", classId)
      .eq("school_id", schoolId)
      .eq("status", "active");

    const enrolmentIds = (enrols || []).map((e) => e.id);
    if (enrolmentIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("attendance_logs")
      .select("enrolment_id, date, status")
      .in("enrolment_id", enrolmentIds)
      .eq("school_id", schoolId)
      .order("date", { ascending: false });

    setRows(
      (data || []).map((r: any) => ({
        enrolmentId: r.enrolment_id,
        date: r.date,
        status: r.status,
      })),
    );
    setLoading(false);
  }, [classId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { loading, rows, refresh };
}