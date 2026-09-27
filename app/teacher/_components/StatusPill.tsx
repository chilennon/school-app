import { STATUS_META } from "../_lib/constants";
import type { ClassStatus } from "../_lib/types";

export function StatusPill({ status }: { status: ClassStatus }) {
  const s = STATUS_META[status];
  return (
    <span
      className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full border ${s.cls}`}
    >
      {s.label}
    </span>
  );
}