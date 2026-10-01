// Shared Tailwind class strings for the compiler.
// Keeps the visual language identical across every card.

export const cardCls =
  "rounded-2xl border border-slate-200 bg-white p-4 md:p-5";

export const cardTitleCls =
  "flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4";

export const selectCls =
  "flex h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export const inputCls = "h-11 text-base";

export function gradeTone(g: string): string {
  switch (g) {
    case "A": return "bg-emerald-100 text-emerald-700";
    case "B": return "bg-blue-100 text-blue-700";
    case "C": return "bg-amber-100 text-amber-700";
    case "D": return "bg-orange-100 text-orange-700";
    case "F": return "bg-red-100 text-red-700";
    default:  return "bg-slate-100 text-slate-500";
  }
}