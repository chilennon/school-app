"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { ActivityRow } from "../_hooks/useActivityFeed";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rowDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor(
    (today.getTime() - rowDay.getTime()) / 86400000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildSentence(a: ActivityRow): string {
  const label = a.target_label ? ` ${a.target_label}` : "";
  switch (a.action) {
    case "teacher.created":
      return `added teacher${label}`;
    case "teacher.updated":
      return `updated teacher${label}`;
    case "teacher.deleted":
      return `deleted teacher${label}`;
    case "admin.created":
      return `added admin${label}`;
    case "password.reset":
      return `reset password for${label}`;
    case "student.created":
      return `added student${label}`;
    case "student.updated":
      return `updated student${label}`;
    case "student.deleted":
      return `deleted student${label}`;
    case "subject.created":
      return `added subject${label}`;
    case "subject.deleted":
      return `deleted subject${label}`;
    case "class.created":
      return `created class${label}`;
    case "class.updated":
      return `updated class${label}`;
    case "class.deleted":
      return `deleted class${label}`;
    case "class.teacher_assigned":
      return `assigned${label}`;
    case "class.subjects_changed":
      return `updated subjects for class${label}`;
    case "session.created":
      return `created session${label}`;
    case "session.current_changed":
      return `set current session to${label}`;
    case "term.current_changed":
      return `set current term to${label}`;
    case "term.updated":
      return `updated${label}`;
    case "result.approved":
      return `approved${label}'s result`;
    case "result.reopened":
      return `sent back${label}'s result`;
    default:
      return a.action.replace(/\./g, " ");
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ActivityFeed({
  open,
  onClose,
  activities,
  loading,
  onSeen,
}: {
  open: boolean;
  onClose: () => void;
  activities: ActivityRow[];
  loading: boolean;
  onSeen: () => void;
}) {
  // Mark everything seen the moment the drawer opens
  useEffect(() => {
    if (open) onSeen();
  }, [open, onSeen]);

  // Lock body scroll while open
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  if (!open) return null;

  // Group by day
  const groups: { label: string; items: ActivityRow[] }[] = [];
  activities.forEach((a) => {
    const label = dayLabel(a.created_at);
    const existing = groups.find((g) => g.label === label);
    if (existing) existing.items.push(a);
    else groups.push({ label, items: [a] });
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <button
        aria-label="Close activity feed"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      {/* Drawer */}
      <aside className="ml-auto relative w-full max-w-md bg-slate-50 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Activity</h2>
            <p className="text-xs text-slate-500">
              What your admins have been doing
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-slate-100"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-24">
          {loading ? (
            <div className="text-center text-sm text-slate-500 py-8">
              Loading…
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-12">
              <p className="font-semibold text-slate-700">No activity yet</p>
              <p className="text-xs mt-1">
                Actions by any admin will show up here.
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.label} className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {g.label}
                </p>
                <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                  {g.items.map((a) => (
                    <div key={a.id} className="p-3 flex gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {initials(a.actor_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 leading-snug">
                          <span className="font-semibold">
                            {a.actor_name}
                          </span>{" "}
                          {buildSentence(a)}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {relativeTime(a.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}