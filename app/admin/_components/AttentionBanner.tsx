"use client";

import { AlertCircle, ChevronRight } from "lucide-react";

export function AttentionBanner({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  if (count === 0) return null;
  return (
    <button
      onClick={onClick}
      className="w-full p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 active:bg-amber-100 text-left"
    >
      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900">
          {count} result sheet{count !== 1 ? "s" : ""} pending
        </p>
        <p className="text-xs text-amber-700 mt-0.5">Tap to review</p>
      </div>
      <ChevronRight className="w-5 h-5 text-amber-600 flex-shrink-0" />
    </button>
  );
}