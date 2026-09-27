export function MixedBanner({ count }: { count: number }) {
  if (count === 0) return null;
  const plural = count !== 1 ? "s" : "";
  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
      <p className="text-sm font-bold text-amber-900">
        ⚠ {count} student{plural} need{count === 1 ? "s" : ""} attention
      </p>
      <p className="text-xs text-amber-700 mt-1">
        The head teacher sent these back. Tap a name below to fix them.
      </p>
    </div>
  );
}