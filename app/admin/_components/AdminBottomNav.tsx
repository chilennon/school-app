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
    // Outer wrapper: Floats the nav above the bottom, adds a safe padding, and disables pointer events on the wrapper
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none print:hidden">
      
      {/* Inner Pill: The actual nav container */}
      <nav className="bg-white/95 backdrop-blur-md border border-slate-200/60 shadow-xl rounded-full flex items-center justify-around w-full max-w-sm px-2 py-2 pointer-events-auto">
        {tabs.map(({ key, label, Icon }) => {
          const isActive = active === key;
          const showBadge = key === "approvals" && pendingCount > 0;

          return (
            <button
              key={key}
              onClick={() => onChange(key as AdminView)}
              className={`flex flex-col items-center justify-center w-16 h-14 rounded-full transition-all duration-200 ${
                isActive 
                  ? "text-blue-600 bg-blue-50/70" 
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 mb-1 transition-transform ${isActive ? "scale-110 stroke-[2.5px]" : "stroke-2"}`} />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                )}
              </div>
              <span className={`text-[10px] tracking-wide ${isActive ? "font-bold" : "font-medium"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}