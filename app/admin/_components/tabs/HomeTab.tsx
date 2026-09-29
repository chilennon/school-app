"use client";

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
  onNavigate,
}: {
  schoolName: string;
  adminName: string;
  termLabel: string;
  stats: { students: number; teachers: number; classes: number };
  pendingCount: number;
  onNavigate: (v: AdminView) => void;
}) {
  return (
    <div className="p-4 space-y-5">
      <header className="pt-[env(safe-area-inset-top)]">
        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
          {schoolName}
        </p>
        <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
          Welcome, {adminName || "Admin"}
        </h1>
        {termLabel && (
          <p className="text-sm text-slate-500 mt-0.5">{termLabel}</p>
        )}
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