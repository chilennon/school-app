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

let cached: SessionWithTerms[] = [];
let cachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

export function useSessionsAndTerms(): Result {
  const [sessions, setSessions] = useState<SessionWithTerms[]>(cached);
  const [loading, setLoading] = useState(cached.length === 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fresh = Date.now() - cachedAt < CACHE_TTL;
    if (fresh && cached.length > 0) {
      setSessions(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: sess, error: sessErr } = await supabase
        .from("sessions")
        .select("*")
        .order("name", { ascending: false });

      if (sessErr) {
        if (!cancelled) {
          setError(sessErr.message);
          setLoading(false);
        }
        return;
      }

      const { data: trms, error: trmErr } = await supabase
        .from("terms")
        .select("*")
        .order("sequence", { ascending: true });

      if (trmErr) {
        if (!cancelled) {
          setError(trmErr.message);
          setLoading(false);
        }
        return;
      }

      const grouped: SessionWithTerms[] = (sess || []).map((s) => ({
        ...(s as Session),
        terms: (trms || []).filter((t) => t.session_id === s.id) as Term[],
      }));

      cached = grouped;
      cachedAt = Date.now();

      if (!cancelled) {
        setSessions(grouped);
        setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return { sessions, loading, error };
}