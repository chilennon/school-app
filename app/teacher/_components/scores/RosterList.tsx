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
        const isDraft = st === "draft" || st === "not_started";
        
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
            
            <div className="flex items-center gap-2">
              {st === "submitted" && (
                <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider bg-amber-50 px-2 py-1 rounded-md">
                  Awaiting
                </span>
              )}
              {st === "approved" && (
                <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded-md">
                  Approved
                </span>
              )}

              <button
                onClick={() => onEnterScores(student)}
                className={`flex-shrink-0 px-4 py-2 font-semibold text-sm rounded-xl border transition-colors ${
                  isDraft
                    ? "bg-blue-50 text-blue-600 border-blue-200 active:bg-blue-100"
                    : "bg-slate-50 text-slate-600 border-slate-200 active:bg-slate-100"
                }`}
              >
                {isDraft ? "Edit" : "View"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}