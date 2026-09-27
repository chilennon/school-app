"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Session, Term } from "@/types/school";

interface UseCurrentTermResult {
  session: Session | null;
  term: Term | null;
  loading: boolean;
  error: string | null;
}

let cachedSession: Session | null = null;
let cachedTerm: Term | null = null;
let cachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

export function useCurrentTerm(): UseCurrentTermResult {
  const [session, setSession] = useState<Session | null>(cachedSession);
  const [term, setTerm] = useState<Term | null>(cachedTerm);
  const [loading, setLoading] = useState(!cachedSession || !cachedTerm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fresh = Date.now() - cachedAt < CACHE_TTL;
    if (fresh && cachedSession && cachedTerm) {
      setSession(cachedSession);
      setTerm(cachedTerm);
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
        .eq("is_current", true)
        .limit(1)
        .maybeSingle();

      if (sessErr || !sess) {
        if (!cancelled) {
          setError(sessErr?.message || "No current session set.");
          setLoading(false);
        }
        return;
      }

      const { data: trm, error: trmErr } = await supabase
        .from("terms")
        .select("*")
        .eq("session_id", sess.id)
        .eq("is_current", true)
        .limit(1)
        .maybeSingle();

      if (trmErr || !trm) {
        if (!cancelled) {
          setError(trmErr?.message || "No current term set.");
          setLoading(false);
        }
        return;
      }

      cachedSession = sess as Session;
      cachedTerm = trm as Term;
      cachedAt = Date.now();

      if (!cancelled) {
        setSession(cachedSession);
        setTerm(cachedTerm);
        setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return { session, term, loading, error };
}