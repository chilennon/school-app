"use client";

import { Users, Briefcase, GraduationCap, BookOpen } from "lucide-react";
import type { AdminView } from "../_lib/types";

const TILES = [
  { key: "teachers", label: "Teachers", Icon: Briefcase },
  { key: "classes", label: "Classes", Icon: GraduationCap },
  { key: "students", label: "Students", Icon: Users },
  { key: "subjects", label: "Subjects", Icon: BookOpen },
] as const;

export function ManageGrid({
  onNavigate,
}: {
  onNavigate: (v: AdminView) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
        Manage
      </p>
      <div className="grid grid-cols-2 gap-2">
        {TILES.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => onNavigate(key as AdminView)}
            className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col items-start gap-2 active:bg-slate-50"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Icon className="w-5 h-5 text-blue-600" />
            </div>
            <span className="font-semibold text-slate-900 text-sm">
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}