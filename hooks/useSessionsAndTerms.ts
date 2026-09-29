"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Session, Term } from "@/types/school";

export interface SessionWithTerms extends Session {
  terms: Term[];
}

interface Result {
  sessions: SessionWithTerms[];
  loading: boolean;
  error: string | null;
}

// Cache keyed by school_id
let cachedBySchool: Record<
  string,
  { sessions: SessionWithTerms[]; at: number }
> = {};
const CACHE_TTL = 5 * 60 * 1000;

export function useSessionsAndTerms(): Result {
  const [sessions, setSessions] = useState<SessionWithTerms[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

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

      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (!profile?.school_id) {
        if (!cancelled) {
          setError("No school assigned to your account.");
          setLoading(false);
        }
        return;
      }

      const schoolId = profile.school_id;

      const cached = cachedBySchool[schoolId];
      if (cached && Date.now() - cached.at < CACHE_TTL) {
        if (!cancelled) {
          setSessions(cached.sessions);
          setLoading(false);
        }
        return;
      }

      const [sessRes, trmsRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("*")
          .eq("school_id", schoolId)
          .order("name", { ascending: false }),
        supabase
          .from("terms")
          .select("*")
          .eq("school_id", schoolId)
          .order("sequence", { ascending: true }),
      ]);

      if (sessRes.error || trmsRes.error) {
        if (!cancelled) {
          setError(
            sessRes.error?.message || trmsRes.error?.message || "Load failed"
          );
          setLoading(false);
        }
        return;
      }

      const grouped: SessionWithTerms[] = (sessRes.data || []).map((s) => ({
        ...(s as Session),
        terms: ((trmsRes.data || []) as Term[]).filter(
          (t) => t.session_id === s.id
        ),
      }));

      cachedBySchool[schoolId] = { sessions: grouped, at: Date.now() };

      if (!cancelled) {
        setSessions(grouped);
        setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { sessions, loading, error };
}