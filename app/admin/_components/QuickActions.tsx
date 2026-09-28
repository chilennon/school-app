"use client";

import { ChevronRight, UserPlus } from "lucide-react";

export function QuickActions({
  onAddStudent,
  onAddTeacher,
}: {
  onAddStudent: () => void;
  onAddTeacher: () => void;
}) {
  return (
    <div className="space-y-2">
      <button
        onClick={onAddStudent}
        className="w-full p-5 bg-blue-600 active:bg-blue-700 text-white rounded-2xl text-left transition shadow-sm flex items-center gap-3"
      >
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <UserPlus className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold leading-tight">Add Student</p>
          <p className="text-sm text-blue-100 truncate">Enroll a new pupil</p>
        </div>
        <ChevronRight className="w-6 h-6 flex-shrink-0" />
      </button>
      <button
        onClick={onAddTeacher}
        className="w-full p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between active:bg-slate-50"
      >
        <span className="font-semibold text-slate-900">Add Teacher</span>
        <ChevronRight className="w-5 h-5 text-slate-400" />
      </button>
    </div>
  );
}