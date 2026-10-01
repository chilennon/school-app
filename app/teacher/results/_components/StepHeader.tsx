export function StepHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-6 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </h2>
  );
}