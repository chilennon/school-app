export const EMPTY_AFFECTIVE = {
  a0: "", a1: "", a2: "", a3: "", a4: "",
  a5: "", a6: "", a7: "", a8: "", a9: "",
};

export const EMPTY_PSYCHOMOTOR = {
  p0: "", p1: "", p2: "", p3: "", p4: "", p5: "",
};

import type { ClassStatus } from "./types";

export const STATUS_META: Record<
  ClassStatus,
  { label: string; cls: string }
> = {
  draft: {
    label: "Draft",
    cls: "bg-slate-100 text-slate-700 border-slate-200",
  },
  submitted: {
    label: "Submitted",
    cls: "bg-amber-50 text-amber-800 border-amber-200",
  },
  approved: {
    label: "Approved",
    cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  mixed: {
    label: "Mixed status",
    cls: "bg-red-50 text-red-800 border-red-200",
  },
};