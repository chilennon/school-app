"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

export function AlertCard({
  icon: Icon,
  title,
  subtitle,
  variant = "default",
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  variant?: "default" | "warning" | "danger";
  onClick: () => void;
}) {
  const styles = {
    default: {
      container: "bg-white border-slate-200",
      icon: "text-slate-500",
      title: "text-slate-900",
      subtitle: "text-slate-500",
    },
    warning: {
      container: "bg-amber-50 border-amber-200",
      icon: "text-amber-600",
      title: "text-amber-900",
      subtitle: "text-amber-700",
    },
    danger: {
      container: "bg-red-50 border-red-200",
      icon: "text-red-600",
      title: "text-red-900",
      subtitle: "text-red-700",
    },
  }[variant];

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-2xl border flex items-center gap-3 text-left active:opacity-80 transition ${styles.container}`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${styles.icon}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${styles.title}`}>{title}</p>
        {subtitle && (
          <p className={`text-xs mt-0.5 ${styles.subtitle}`}>{subtitle}</p>
        )}
      </div>
      <ChevronRight className={`w-5 h-5 flex-shrink-0 ${styles.icon}`} />
    </button>
  );
}