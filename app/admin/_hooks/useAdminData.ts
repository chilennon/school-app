"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User, ClassRoom, Student } from "@/types/school";
import type { SubjectRow } from "../_lib/types";

export interface AdminData {
  loading: boolean;
  callerRole: "owner" | "admin" | "teacher" | null;
  teachers: User[];
  admins: User[];
  classes: ClassRoom[];
  students: Student[];
  subjects: SubjectRow[];
  families: { id: string; name: string }[];
  classSubjectIds: Record<string, string[]>;
  refresh: () => Promise<void>;
}

export function useAdminData(): AdminData {
  const [loading, setLoading] = useState(true);
  const [callerRole, setCallerRole] = useState<
    "owner" | "admin" | "teacher" | null
  >(null);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [families, setFamilies] = useState<{ id: string; name: string }[]>([]);
  const [classSubjectIds, setClassSubjectIds] = useState<
    Record<string, string[]>
  >({});

  const refresh = useCallback(async () => {
    setLoading(true);

    // Look up caller's role first
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const role = profile?.role || user.app_metadata?.role;

      if (role) {
        setCallerRole(role as "owner" | "admin" | "teacher");
      }
    }

    const [
      teachersRes,
      adminsRes,
      classesRes,
      studentsRes,
      subjectsRes,
      classSubsRes,
      familiesRes,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "teacher"),
      supabase.from("profiles").select("*").eq("role", "admin"),
      supabase.from("classes").select("*"),
      // 🚨 FIX: Only fetch ACTIVE students
      supabase.from("students").select("*").eq("status", "active"), 
      supabase.from("subjects").select("*").order("name"),
      supabase.from("class_subjects").select("class_id, subject_id"),
      supabase
        .from("families")
        .select("id, name")
        .is("deleted_at", null)
        .order("name"),
    ]);

    if (teachersRes.data) {
      setTeachers(
        teachersRes.data.map((t) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          role: t.role,
        })),
      );
    }

    if (adminsRes.data) {
      setAdmins(
        adminsRes.data.map((t) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          role: t.role,
        })),
      );
    }

    if (classesRes.data) {
      setClasses(
        classesRes.data.map((c) => ({
          id: c.id,
          name: c.name,
          session: c.session,
          session_id: c.session_id ?? null,
          teacher_id: c.teacher_id ?? null,
          studentIds: [],
        })),
      );
    }

    if (studentsRes.data) {
      setStudents(
        studentsRes.data.map((s) => ({
          id: s.id,
          name: s.name,
          regNo: s.reg_no,
          currentClassId: s.class_id,
          family_id: s.family_id,
          gender: s.gender || "",
          age: s.age || "",
        })),
      );
    }

    if (subjectsRes.data) setSubjects(subjectsRes.data as SubjectRow[]);
    if (familiesRes.data) setFamilies(familiesRes.data);

    const grouped: Record<string, string[]> = {};
    (classSubsRes.data || []).forEach((r: any) => {
      if (!grouped[r.class_id]) grouped[r.class_id] = [];
      grouped[r.class_id].push(r.subject_id);
    });
    setClassSubjectIds(grouped);

    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    loading,
    teachers,
    admins,
    classes,
    students,
    subjects,
    families,
    classSubjectIds,
    refresh,
    callerRole,
  };
}