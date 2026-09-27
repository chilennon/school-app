"use client";

import { ChevronRight, ClipboardCheck } from "lucide-react";
import type { ClassInfo } from "../../_lib/types";

export function HomeTab({
  teacherName,
  selectedClass,
  selectedTermName,
  assignedClasses,
  onOpenScores,
  onSelectClass,
}: {
  teacherName: string;
  selectedClass: ClassInfo | null;
  selectedTermName: string;
  assignedClasses: ClassInfo[];
  onOpenScores: () => void;
  onSelectClass: (cls: ClassInfo) => void;
}) {
  return (
    <div className="p-4 space-y-5">
      <header className="pt-[env(safe-area-inset-top)]">
        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
          House Of Angels School
        </p>
        <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
          Welcome, {teacherName || "Teacher"}
        </h1>
      </header>

      {selectedClass ? (
        <button
          onClick={onOpenScores}
          className="w-full bg-blue-600 active:bg-blue-700 text-white p-5 rounded-2xl text-left transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold leading-tight">Enter Scores</p>
              <p className="text-sm text-blue-100 truncate">
                {selectedClass.name}
                {selectedTermName ? ` · ${selectedTermName} Term` : ""}
              </p>
            </div>
            <ChevronRight className="w-6 h-6 flex-shrink-0" />
          </div>
        </button>
      ) : null}

      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          My Classes
        </h2>
        {assignedClasses.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl text-center">
            <p className="font-bold text-amber-900 text-sm">
              No classes assigned yet
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Ask your admin to assign you to a class
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {assignedClasses.map((cls) => (
              <button
                key={cls.id}
                onClick={() => onSelectClass(cls)}
                className="w-full p-4 bg-white rounded-2xl border border-slate-200 active:bg-slate-50 text-left flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{cls.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{cls.session}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}