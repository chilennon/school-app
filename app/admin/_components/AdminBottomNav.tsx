"use client";

import { Home, Clock, BarChart3, CheckSquare } from "lucide-react";
import type { AdminView } from "../_lib/types";

interface Props {
  active: AdminView;
  pendingCount: number;
  onChange: (view: AdminView) => void;
  isOwner: boolean;
}

export function AdminBottomNav({ active, pendingCount, onChange, isOwner }: Props) {
  const tabs = [
    { key: "home", label: "Home", Icon: Home },
    { key: "attendance", label: "Attendance", Icon: Clock },
    { key: "approvals", label: "Reports", Icon: BarChart3 },
  ];

  if (isOwner) {
    tabs.splice(1, 0, { key: "fees", label: "Fees", Icon: CheckSquare });
  }

  return (
    // REMOVED md:hidden so it shows on desktop
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
      <div className="max-w-lg mx-auto flex justify-around">
        {tabs.map(({ key, label, Icon }) => {
          const isActive = active === key;
          const showBadge = key === "approvals" && pendingCount > 0;

          return (
            <button
              key={key}
              onClick={() => onChange(key as AdminView)}
              className={`flex flex-col items-center justify-center w-full py-3 transition-colors ${
                isActive ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <div className="relative">
                <Icon className="w-6 h-6 mb-1" />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}