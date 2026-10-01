"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface ActivityRow {
  id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  target_table: string;
  target_id: string | null;
  target_label: string | null;
  created_at: string;
}

const LAST_SEEN_KEY = "audit_last_seen_at";

export interface ActivityFeedState {
  activities: ActivityRow[];
  loading: boolean;
  unreadCount: number;
  refresh: () => Promise<void>;
  markSeen: () => void;
}

export function useActivityFeed(): ActivityFeedState {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSeen, setLastSeen] = useState<string>(() => {
    if (typeof window === "undefined") return new Date(0).toISOString();
    return localStorage.getItem(LAST_SEEN_KEY) || new Date(0).toISOString();
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_log")
      .select(
        "id, actor_id, actor_name, action, target_table, target_id, target_label, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("activity feed load failed:", error);
      setLoading(false);
      return;
    }

    setActivities((data || []) as ActivityRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const unreadCount = useMemo(() => {
    const seenMs = new Date(lastSeen).getTime();
    return activities.filter((a) => new Date(a.created_at).getTime() > seenMs)
      .length;
  }, [activities, lastSeen]);

  const markSeen = useCallback(() => {
    const now = new Date().toISOString();
    setLastSeen(now);
    if (typeof window !== "undefined") {
      localStorage.setItem(LAST_SEEN_KEY, now);
    }
  }, []);

  return { activities, loading, unreadCount, refresh, markSeen };
}