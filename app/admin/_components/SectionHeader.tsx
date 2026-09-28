"use client";

export function SectionHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <button
        onClick={onBack}
        className="p-2 -ml-2 rounded-lg active:bg-slate-100"
        aria-label="Back"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 truncate">{title}</p>
        {subtitle && (
          <p className="text-xs text-slate-500 truncate">{subtitle}</p>
        )}
      </div>
      {right}
    </header>
  );
}