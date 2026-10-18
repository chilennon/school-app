"use client";

import { Bell, UserX, CheckSquare, Activity } from "lucide-react";
import { StatsRow } from "../StatsRow";
import { AlertCard } from "../AlertCard";
import { FeeSummaryCard, type FeeSummary } from "../FeeSummaryCard";
import { ManageGrid } from "../ManageGrid";
import type { AdminView } from "../../_lib/types";

export interface TeacherAbsenceSummary {
  count: number;
  uncoveredClasses: string[];
}

export function HomeTab({
  schoolName,
  adminName,
  termLabel,
  stats,
  pendingApprovals,
  unreadActivity,
  unassignedStudents,
  isOwner,
  feeSummary,
  teacherAbsence,
  onOpenActivity,
  onOpenFees,
  onNavigate,
}: {
  schoolName: string;
  adminName: string;
  termLabel: string;
  stats: { students: number; teachers: number; classes: number };
  pendingApprovals: number;
  unreadActivity: number;
  unassignedStudents: number;
  isOwner: boolean;
  feeSummary: FeeSummary | null;
  teacherAbsence: TeacherAbsenceSummary | null;
  onOpenActivity: () => void;
  onOpenFees: () => void;
  onNavigate: (v: AdminView) => void;
}) {
  const showFeeCard = isOwner && feeSummary !== null;
  const showTeacherAbsence = teacherAbsence !== null && teacherAbsence.count > 0;

  return (
    <div className="p-4 space-y-4 pb-24">
      <header className="pt-[env(safe-area-inset-top)] flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wider text-blue-600">
            {schoolName}
          </p>
          {/* Matched to mockup: "Admin Console" */}
          <h1 className="text-[28px] font-black text-slate-900 mt-1 leading-tight">
            Admin Console
          </h1>
        </div>

        <button
          onClick={onOpenActivity}
          aria-label="Activity feed"
          className="relative flex-shrink-0 w-11 h-11 rounded-full bg-white border border-slate-200 flex items-center justify-center active:bg-slate-100 mt-1 shadow-sm"
        >
          <Bell className="w-5 h-5 text-slate-700" />
          {unreadActivity > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
              {unreadActivity > 99 ? "99+" : unreadActivity}
            </span>
          )}
        </button>
      </header>

      {/* Owner-only fee card */}
      {showFeeCard && (
        <FeeSummaryCard feeSummary={feeSummary!} onOpen={onOpenFees} />
      )}

      {showTeacherAbsence && (
        <AlertCard
          icon={UserX}
          variant="danger"
          title={`${teacherAbsence!.count} teacher${teacherAbsence!.count === 1 ? "" : "s"} absent today`}
          subtitle={
            teacherAbsence!.uncoveredClasses.length > 0
              ? `${teacherAbsence!.uncoveredClasses.join(", ")} have no cover assigned`
              : undefined
          }
          onClick={() => onNavigate("teachers")}
        />
      )}

      {pendingApprovals > 0 && (
        <AlertCard
          icon={CheckSquare}
          variant="warning"
          title={`${pendingApprovals} class${pendingApprovals === 1 ? "" : "es"} await your approval`}
          subtitle="Results submitted, ready to review"
          onClick={() => onNavigate("approvals")}
        />
      )}

      {unassignedStudents > 0 && (
        <AlertCard
          icon={Activity}
          variant="default"
          title={`${unassignedStudents} student${unassignedStudents === 1 ? "" : "s"} without a class`}
          subtitle="Assign them so teachers can see them"
          onClick={() => onNavigate("students")}
        />
      )}

      <StatsRow {...stats} />

      <ManageGrid onNavigate={onNavigate} />
    </div>
  );
}