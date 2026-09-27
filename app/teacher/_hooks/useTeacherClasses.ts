"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { CatalogSubject, ClassInfo } from "../_lib/types";

export interface TeacherClasses {
  loading: boolean;
  classes: ClassInfo[];
  catalogSubjects: CatalogSubject[];
  gradeBands: any[];
}

export function useTeacherClasses(userId: string | null): TeacherClasses {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [catalogSubjects, setCatalogSubjects] = useState<CatalogSubject[]>([]);
  const [gradeBands, setGradeBands] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      const [catalogRes, bandsRes, classRes] = await Promise.all([
        supabase.from("subjects").select("id, name").order("name"),
        supabase.from("grade_bands").select("*").order("display_order"),
        supabase
          .from("classes")
          .select("id, name, session, session_id")
          .eq("teacher_id", userId),
      ]);

      if (cancelled) return;

      if (catalogRes.data) setCatalogSubjects(catalogRes.data as CatalogSubject[]);
      if (bandsRes.error) console.error("grade_bands fetch failed:", bandsRes.error);
      if (bandsRes.data) setGradeBands(bandsRes.data);
      if (classRes.data) setClasses(classRes.data as ClassInfo[]);

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { loading, classes, catalogSubjects, gradeBands };
}