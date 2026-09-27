"use client";

import type { StudentInfo } from "../../_lib/types";

export function RosterList({
  students,
  onEnterScores,
}: {
  students: StudentInfo[];
  onEnterScores: (student: StudentInfo) => void;
}) {
  if (students.length === 0) {
    return (
      <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center text-sm text-slate-500">
        No students in this class yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {students.map((student) => {
        const st = student.assessment?.status || "draft";
        return (
          <div
            key={student.id}
            className="p-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 truncate">
                {student.name}
              </p>
              <p className="text-xs font-mono text-slate-500 mt-0.5">
                {student.reg_no}
              </p>
            </div>
            {st === "draft" || st === "not_started" ? (
              <button
                onClick={() => onEnterScores(student)}
                className="flex-shrink-0 px-4 py-2.5 bg-blue-50 text-blue-600 font-semibold text-sm rounded-xl border border-blue-200 active:bg-blue-100"
              >
                {st === "draft" ? "Edit" : "Enter"}
              </button>
            ) : st === "submitted" ? (
              <span className="flex-shrink-0 text-xs text-amber-700 font-semibold px-2">
                Awaiting
              </span>
            ) : (
              <span className="flex-shrink-0 text-xs text-emerald-700 font-semibold px-2">
                Approved
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}