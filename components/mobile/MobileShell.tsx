"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import MobileBottomNav, { MobileTab } from "./MobileBottomNav";

interface Props {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  activeTab?: MobileTab;
  onNavigate?: (tab: MobileTab) => void;
  onBack?: () => void;
  headerRight?: React.ReactNode;
  hideBottomNav?: boolean;
  className?: string;
}

export default function MobileShell({
  children,
  title,
  subtitle,
  activeTab,
  onNavigate,
  onBack,
  headerRight,
  hideBottomNav = false,
  className,
}: Props) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className={cn("mx-auto max-w-md", className)}>
        {/* Header */}
        {(title || onBack || headerRight) && (
          <header className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur-md">
            <div className="flex items-center justify-between px-5 pt-6 pb-4">
              <div className="flex items-center gap-3 min-w-0">
                {onBack && (
                  <button
                    onClick={onBack}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                    aria-label="Back"
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}
                <div className="min-w-0">
                  {subtitle && (
                    <p className="text-[11px] uppercase font-semibold text-slate-500 tracking-wider truncate">
                      {subtitle}
                    </p>
                  )}
                  {title && (
                    <h1 className="text-xl font-bold text-slate-900 truncate">
                      {title}
                    </h1>
                  )}
                </div>
              </div>
              {headerRight && (
                <div className="flex items-center gap-2 shrink-0">
                  {headerRight}
                </div>
              )}
            </div>
          </header>
        )}

        {/* Content */}
        <main className={cn("px-5", hideBottomNav ? "pb-8" : "pb-28")}>
          {children}
        </main>
      </div>

      {/* Bottom Nav */}
      {!hideBottomNav && activeTab && (
        <MobileBottomNav active={activeTab} onNavigate={onNavigate} />
      )}
    </div>
  );
}