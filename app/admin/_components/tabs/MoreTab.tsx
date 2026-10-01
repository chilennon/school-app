"use client";

import {
  ChevronRight,
  Users,
  ShieldCheck,
  BookOpen,
  School,
  Settings,
} from "lucide-react";
import type { AdminView } from "../../_lib/types";

const ITEMS = [
  { key: "teachers", label: "Teachers", Icon: Users },
  { key: "admins", label: "Admins", Icon: ShieldCheck },
  { key: "subjects", label: "Subjects", Icon: BookOpen },
  { key: "classes", label: "Classes", Icon: School },
  { key: "settings", label: "Settings", Icon: Settings },
] as const;

export function MoreTab({
  onNavigate,
  onLogout,
}: {
  onNavigate: (v: AdminView) => void;
  onLogout: () => void;
}) {
  return (
    <div className="p-4 space-y-4 pb-24">
      <header className="pt-[env(safe-area-inset-top)]">
        <h1 className="text-2xl font-bold text-slate-900">More</h1>
      </header>

      <div className="space-y-2">
        {ITEMS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => onNavigate(key as AdminView)}
            className="w-full p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 active:bg-slate-50"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-blue-600" />
            </div>
            <span className="flex-1 font-semibold text-slate-900 text-left">
              {label}
            </span>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        ))}
      </div>

      <button
        onClick={onLogout}
        className="w-full p-4 bg-red-50 border border-red-200 rounded-2xl text-left font-semibold text-red-600 active:bg-red-100"
      >
        Sign Out
      </button>
    </div>
  );
}