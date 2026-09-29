"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { SchoolConfig, GradeBand } from "@/types/school";

interface UseSchoolConfigResult {
  config: SchoolConfig | null;
  gradeBands: GradeBand[];
  loading: boolean;
  error: string | null;
  gradeFor: (score: number | null) => { g: string; remark: string };
}

// Cache keyed by school_id — a signed-out user's cache doesn't
// leak into another user's session.
let cachedBySchool: Record<
  string,
  { config: SchoolConfig; bands: GradeBand[]; at: number }
> = {};
const CACHE_TTL = 5 * 60 * 1000;

export function useSchoolConfig(): UseSchoolConfigResult {
  const [config, setConfig] = useState<SchoolConfig | null>(null);
  const [gradeBands, setGradeBands] = useState<GradeBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      // 1. Get the caller's school_id from their profile
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setError("Not signed in");
          setLoading(false);
        }
        return;
      }

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (profileErr || !profile?.school_id) {
        if (!cancelled) {
          setError(profileErr?.message || "No school assigned to your account.");
          setLoading(false);
        }
        return;
      }

      const schoolId = profile.school_id;

      // 2. Serve from cache if fresh
      const cached = cachedBySchool[schoolId];
      if (cached && Date.now() - cached.at < CACHE_TTL) {
        if (!cancelled) {
          setConfig(cached.config);
          setGradeBands(cached.bands);
          setLoading(false);
        }
        return;
      }

      // 3. Fetch this school's row + bands
      const [schoolRes, bandsRes] = await Promise.all([
        supabase.from("schools").select("*").eq("id", schoolId).single(),
        supabase
          .from("grade_bands")
          .select("*")
          .eq("school_id", schoolId)
          .order("display_order", { ascending: true }),
      ]);

      if (schoolRes.error || !schoolRes.data) {
        if (!cancelled) {
          setError(schoolRes.error?.message || "School config not found.");
          setLoading(false);
        }
        return;
      }

      if (bandsRes.error) {
        if (!cancelled) {
          setError(bandsRes.error.message);
          setLoading(false);
        }
        return;
      }

      const schoolConfig = schoolRes.data as SchoolConfig;
      const bands = (bandsRes.data || []) as GradeBand[];

      cachedBySchool[schoolId] = {
        config: schoolConfig,
        bands,
        at: Date.now(),
      };

      if (!cancelled) {
        setConfig(schoolConfig);
        setGradeBands(bands);
        setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const gradeFor = (score: number | null) => {
    if (score === null || isNaN(score)) return { g: "—", remark: "—" };
    const band = gradeBands.find(
      (b) => score >= b.min_score && score <= b.max_score
    );
    return band
      ? { g: band.grade, remark: band.remark }
      : { g: "—", remark: "—" };
  };

  return { config, gradeBands, loading, error, gradeFor };
}