"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { ClassPills } from "../scores/ClassPills";
import type { AttendanceRow } from "../../_hooks/useAttendance";
import type { ClassInfo, StudentInfo } from "../../_lib/types";

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diffDays = Math.round(
    (today.getTime() - d.getTime()) / 86400000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function AttendanceTab({
  classes,
  selectedClass,
  onSelectClass,
  students,
  attendanceRows,
  onStartRollCall,
}: {
  classes: ClassInfo[];
  selectedClass: ClassInfo | null;
  onSelectClass: (cls: ClassInfo) => void;
  students: StudentInfo[];
  attendanceRows: AttendanceRow[];
  onStartRollCall: (date: string) => void;
}) {
  const today = todayIso();

  // Group attendance rows by date
  const byDate = useMemo(() => {
    const map: Record<string, AttendanceRow[]> = {};
    attendanceRows.forEach((r) => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    });
    return map;
  }, [attendanceRows]);

  // Recent dates sorted desc
  const recentDates = useMemo(() => {
    return Object.keys(byDate).sort().reverse().slice(0, 7);
  }, [byDate]);

  const todayRows = byDate[today] || [];
  const todayPresent = todayRows.filter((r) => r.status === "present").length;
  const todayAbsent = todayRows.filter((r) => r.status === "absent").length;
  const todayMarked = todayRows.length;
  const totalStudents = students.length;

  return (
    <div className="p-4 space-y-5 pb-24">
      <header className="pt-[env(safe-area-inset-top)]">
        <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Mark your class for the day
        </p>
      </header>

      <ClassPills
        classes={classes}
        selectedId={selectedClass?.id ?? null}
        onSelect={onSelectClass}
      />

      {selectedClass && (
        <>
          {/* Today's card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Today
                </p>
                <p className="text-base font-bold text-slate-900 mt-0.5">
                  {selectedClass.name}
                </p>
              </div>
              {todayMarked > 0 && (
                <div className="text-right text-xs">
                  <p className="font-bold text-emerald-600">
                    {todayPresent} present
                  </p>
                  <p className="font-bold text-red-600">
                    {todayAbsent} absent
                  </p>
                </div>
              )}
            </div>

            {todayMarked === 0 ? (
              <button
                onClick={() => onStartRollCall(today)}
                className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-2xl active:bg-blue-700"
              >
                Start Roll Call →
              </button>
            ) : (
              <button
                onClick={() => onStartRollCall(today)}
                className="w-full py-3.5 bg-slate-100 text-slate-700 font-bold rounded-2xl active:bg-slate-200"
              >
                Edit today's attendance
              </button>
            )}
          </div>

          {/* Recent days */}
          {recentDates.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Recent days
              </p>
              <div className="space-y-2">
                {recentDates.map((d) => {
                  const rows = byDate[d];
                  const present = rows.filter(
                    (r) => r.status === "present",
                  ).length;
                  const absent = rows.length - present;
                  return (
                    <button
                      key={d}
                      onClick={() => onStartRollCall(d)}
                      className="w-full p-3.5 bg-white rounded-2xl border border-slate-200 flex items-center justify-between active:bg-slate-50 text-left"
                    >
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">
                          {formatDateLabel(d)}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {present} present · {absent} absent · {rows.length}/
                          {totalStudents} marked
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {recentDates.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
              <p className="text-sm text-slate-500">
                No attendance marked yet. Start with today.
              </p>
            </div>
          )}
        </>
      )}

      {!selectedClass && classes.length === 0 && (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-center">
          <p className="text-sm font-bold text-amber-900">
            No classes assigned
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Ask your admin to assign you to a class.
          </p>
        </div>
      )}
    </div>
  );
}