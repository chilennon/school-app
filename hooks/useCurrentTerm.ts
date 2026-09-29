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

let cachedBySchool: Record<
  string,
  { session: Session; term: Term; at: number }
> = {};
const CACHE_TTL = 5 * 60 * 1000;

export function useCurrentTerm(): UseCurrentTermResult {
  const [session, setSession] = useState<Session | null>(null);
  const [term, setTerm] = useState<Term | null>(null);
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

      const cached = cachedBySchool[schoolId];
      if (cached && Date.now() - cached.at < CACHE_TTL) {
        if (!cancelled) {
          setSession(cached.session);
          setTerm(cached.term);
          setLoading(false);
        }
        return;
      }

      const { data: sess, error: sessErr } = await supabase
        .from("sessions")
        .select("*")
        .eq("school_id", schoolId)
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
        .eq("school_id", schoolId)
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

      cachedBySchool[schoolId] = {
        session: sess as Session,
        term: trm as Term,
        at: Date.now(),
      };

      if (!cancelled) {
        setSession(sess as Session);
        setTerm(trm as Term);
        setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { session, term, loading, error };
}