"use client";

import { Home, Users, CheckSquare, Menu } from "lucide-react";
import type { AdminView } from "../_lib/types";

const TABS = [
  { key: "home", label: "Home", Icon: Home },
  { key: "students", label: "Students", Icon: Users },
  { key: "approvals", label: "Approvals", Icon: CheckSquare },
  { key: "more", label: "More", Icon: Menu },
] as const;

export function AdminBottomNav({
  active,
  pendingCount,
  onChange,
}: {
  active: AdminView;
  pendingCount: number;
  onChange: (v: AdminView) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto flex">
        {TABS.map(({ key, label, Icon }) => {
          const isActive = active === key;
          const showBadge = key === "approvals" && pendingCount > 0;
          return (
            <button
              key={key}
              onClick={() => onChange(key as AdminView)}
              className={`relative flex-1 py-2.5 flex flex-col items-center gap-0.5 transition ${
                isActive ? "text-blue-600" : "text-slate-400"
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[11px] ${isActive ? "font-bold" : "font-medium"}`}>
                {label}
              </span>
              {showBadge && (
                <span className="absolute top-1.5 right-[calc(50%-22px)] min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}