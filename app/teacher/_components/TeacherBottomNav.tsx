"use client";

import { Home, ClipboardCheck, User } from "lucide-react";
import type { MobileTab } from "../_lib/types";

const TABS = [
  { key: "home", label: "Home", Icon: Home },
  { key: "scores", label: "Scores", Icon: ClipboardCheck },
  { key: "profile", label: "Profile", Icon: User },
] as const;

export function TeacherBottomNav({
  active,
  onChange,
}: {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto flex">
        {TABS.map(({ key, label, Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 transition ${
                isActive ? "text-blue-600" : "text-slate-400"
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              <span
                className={`text-[11px] ${
                  isActive ? "font-bold" : "font-medium"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}