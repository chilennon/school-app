"use client";

import { Bell, UserX, CheckSquare, Activity } from "lucide-react";
import { StatsRow } from "../StatsRow";
import { AlertCard } from "../AlertCard";
import { FeeSummaryCard, type FeeSummary } from "../FeeSummaryCard";
import { ManageGrid } from "../ManageGrid";
import type { AdminView } from "../../_lib/types";

export interface TeacherAbsenceSummary {
  count: number;
  uncoveredClasses: string[]; // class names without a form teacher present
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

  // Live signals
  pendingApprovals: number;
  unreadActivity: number;
  unassignedStudents: number;

  isOwner: boolean;

  // Framework slots — pass null until the feature ships
  feeSummary: FeeSummary | null;
  teacherAbsence: TeacherAbsenceSummary | null;

  onOpenActivity: () => void;
  onOpenFees: () => void;
  onNavigate: (v: AdminView) => void;
}) {
  const showFeeCard = isOwner && feeSummary !== null;
  const showTeacherAbsence =
    teacherAbsence !== null && teacherAbsence.count > 0;

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
          {unreadActivity > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadActivity > 99 ? "99+" : unreadActivity}
            </span>
          )}
        </button>
      </header>

      {/* Owner-only fee slot — hidden until fees ship */}
      {showFeeCard && (
        <FeeSummaryCard feeSummary={feeSummary!} onOpen={onOpenFees} />
      )}

      {/* Alert stack — each hides itself when its trigger is 0 */}
      {showTeacherAbsence && (
        <AlertCard
          icon={UserX}
          variant="danger"
          title={`${teacherAbsence!.count} teacher${
            teacherAbsence!.count === 1 ? "" : "s"
          } absent today`}
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
          title={`${pendingApprovals} class${
            pendingApprovals === 1 ? "" : "es"
          } await your approval`}
          subtitle="Results submitted, ready to review"
          onClick={() => onNavigate("approvals")}
        />
      )}

      {unassignedStudents > 0 && (
        <AlertCard
          icon={Activity}
          variant="default"
          title={`${unassignedStudents} student${
            unassignedStudents === 1 ? "" : "s"
          } without a class`}
          subtitle="Assign them so teachers can see them"
          onClick={() => onNavigate("students")}
        />
      )}

      <StatsRow {...stats} />

      <ManageGrid onNavigate={onNavigate} />
    </div>
  );
}