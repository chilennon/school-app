"use client";

import React from "react";
import Link from "next/link";
import { Home, GraduationCap, FileText, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type MobileTab = "home" | "classes" | "scores" | "me";

interface NavItem {
  key: MobileTab;
  label: string;
  icon: React.ReactNode;
  href?: string;
}

interface Props {
  active: MobileTab;
  onNavigate?: (tab: MobileTab) => void;
}

const ITEMS: NavItem[] = [
  { key: "home", label: "Home", icon: <Home size={20} /> },
  { key: "classes", label: "Classes", icon: <GraduationCap size={20} /> },
  { key: "scores", label: "Scores", icon: <FileText size={20} /> },
  { key: "me", label: "Me", icon: <User size={20} /> },
];

export default function MobileBottomNav({ active, onNavigate }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-md px-4 pb-4">
        <div className="flex items-center justify-around rounded-full bg-slate-900 px-3 py-2 shadow-2xl shadow-slate-900/30">
          {ITEMS.map((item) => {
            const isActive = item.key === active;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate?.(item.key)}
                className={cn(
                  "flex flex-col items-center justify-center transition",
                  isActive
                    ? "h-12 w-12 rounded-full bg-white text-slate-900"
                    : "h-12 w-12 text-slate-400 hover:text-slate-200"
                )}
                aria-label={item.label}
              >
                {item.icon}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}