"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export default function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  className,
}: Props) {
  const clickable = !!onClick;

  return (
    <div
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "flex items-center gap-3 py-3",
        clickable && "cursor-pointer active:opacity-70 transition",
        className
      )}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 truncate">{title}</p>
        {subtitle && (
          <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      {trailing ? (
        <div className="shrink-0">{trailing}</div>
      ) : clickable ? (
        <ChevronRight size={18} className="shrink-0 text-slate-300" />
      ) : null}
    </div>
  );
}