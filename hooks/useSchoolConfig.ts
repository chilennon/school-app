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

let cachedConfig: SchoolConfig | null = null;
let cachedBands: GradeBand[] = [];
let cachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

export function useSchoolConfig(): UseSchoolConfigResult {
  const [config, setConfig] = useState<SchoolConfig | null>(cachedConfig);
  const [gradeBands, setGradeBands] = useState<GradeBand[]>(cachedBands);
  const [loading, setLoading] = useState(!cachedConfig);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fresh = Date.now() - cachedAt < CACHE_TTL;
    if (fresh && cachedConfig) {
      setConfig(cachedConfig);
      setGradeBands(cachedBands);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: schoolRow, error: schoolErr } = await supabase
        .from("schools")
        .select("*")
        .limit(1)
        .single();

      if (schoolErr || !schoolRow) {
        if (!cancelled) {
          setError(schoolErr?.message || "No school config found.");
          setLoading(false);
        }
        return;
      }

      const { data: bands, error: bandsErr } = await supabase
        .from("grade_bands")
        .select("*")
        .eq("school_id", schoolRow.id)
        .order("display_order", { ascending: true });

      if (bandsErr) {
        if (!cancelled) {
          setError(bandsErr.message);
          setLoading(false);
        }
        return;
      }

      cachedConfig = schoolRow as SchoolConfig;
      cachedBands = (bands || []) as GradeBand[];
      cachedAt = Date.now();

      if (!cancelled) {
        setConfig(cachedConfig);
        setGradeBands(cachedBands);
        setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const gradeFor = (score: number | null) => {
    if (score === null || isNaN(score)) return { g: "—", remark: "—" };
    const band = gradeBands.find((b) => score >= b.min_score && score <= b.max_score);
    return band ? { g: band.grade, remark: band.remark } : { g: "—", remark: "—" };
  };

  return { config, gradeBands, loading, error, gradeFor };
}