"use client";

import { Bell } from "lucide-react";
import { StatsRow } from "../StatsRow";
import { AttentionBanner } from "../AttentionBanner";
import { QuickActions } from "../QuickActions";
import type { AdminView } from "../../_lib/types";

export function HomeTab({
  schoolName,
  adminName,
  termLabel,
  stats,
  pendingCount,
  unreadActivityCount,
  onOpenActivity,
  onNavigate,
}: {
  schoolName: string;
  adminName: string;
  termLabel: string;
  stats: { students: number; teachers: number; classes: number };
  pendingCount: number;
  unreadActivityCount: number;
  onOpenActivity: () => void;
  onNavigate: (v: AdminView) => void;
}) {
  return (
    <div className="p-4 space-y-5">
      <header className="pt-[env(safe-area-inset-top)] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            {schoolName}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mt-0.5 truncate">
            Welcome, {adminName || "Admin"}
          </h1>
          {termLabel && (
            <p className="text-sm text-slate-500 mt-0.5">{termLabel}</p>
          )}
        </div>

        <button
          onClick={onOpenActivity}
          aria-label="Activity feed"
          className="relative flex-shrink-0 w-11 h-11 rounded-full bg-white border border-slate-200 flex items-center justify-center active:bg-slate-100"
        >
          <Bell className="w-5 h-5 text-slate-700" />
          {unreadActivityCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadActivityCount > 99 ? "99+" : unreadActivityCount}
            </span>
          )}
        </button>
      </header>

      <StatsRow {...stats} />

      <AttentionBanner
        count={pendingCount}
        onClick={() => onNavigate("approvals")}
      />

      <QuickActions
        onAddStudent={() => onNavigate("students")}
        onAddTeacher={() => onNavigate("teachers")}
      />
    </div>
  );
}