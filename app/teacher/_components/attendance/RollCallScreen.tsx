"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { AttendanceRow, type AttendanceStudent } from "./AttendanceRow";

export function RollCallScreen({
  className,
  dateLabel,
  students,
  initialStatuses,
  onBack,
  onSave,
}: {
  className: string;
  dateLabel: string;
  students: AttendanceStudent[];
  initialStatuses: Record<string, "present" | "absent">;
  onBack: () => void;
  onSave: (
    statuses: Record<string, "present" | "absent">,
  ) => Promise<boolean>;
}) {
  const [statuses, setStatuses] = useState<Record<string, "present" | "absent">>(
    () => {
      const seed: Record<string, "present" | "absent"> = {};
      students.forEach((s) => {
        seed[s.enrolmentId] = initialStatuses[s.enrolmentId] || "present";
      });
      return seed;
    },
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const seed: Record<string, "present" | "absent"> = {};
    students.forEach((s) => {
      seed[s.enrolmentId] = initialStatuses[s.enrolmentId] || "present";
    });
    setStatuses(seed);
  }, [students, initialStatuses]);

  const present = Object.values(statuses).filter(
    (v) => v === "present",
  ).length;
  const absent = Object.values(statuses).filter((v) => v === "absent").length;

  const markAll = (s: "present" | "absent") => {
    const next: Record<string, "present" | "absent"> = {};
    students.forEach((st) => {
      next[st.enrolmentId] = s;
    });
    setStatuses(next);
  };

  const handleSubmit = async () => {
    setBusy(true);
    const ok = await onSave(statuses);
    setBusy(false);
    if (!ok) return;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="mx-auto max-w-3xl px-4 py-2.5 flex items-start gap-2">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg active:bg-slate-100"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-slate-800" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-slate-900 text-lg leading-tight">
              Attendance
            </h1>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {className} · {dateLabel} · {students.length} student
              {students.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-4 pb-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => markAll("present")}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 font-bold text-sm bg-emerald-50/50 active:bg-emerald-100"
          >
            <Check className="w-4 h-4" />
            Mark all Present
          </button>
          <button
            onClick={() => markAll("absent")}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm bg-white active:bg-slate-50"
          >
            <X className="w-4 h-4" />
            Mark all Absent
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 pb-40 space-y-2">
        <p className="text-xs text-slate-500 pb-2">
          Everyone defaults to Present — just tap to flip anyone who's out.
        </p>

        {students.map((s) => (
          <AttendanceRow
            key={s.enrolmentId}
            student={s}
            status={statuses[s.enrolmentId] || "present"}
            onChange={(v) =>
              setStatuses((prev) => ({ ...prev, [s.enrolmentId]: v }))
            }
          />
        ))}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1 text-sm">
            <span className="font-bold text-emerald-600">{present} present</span>
            <span className="text-slate-400 mx-1.5">·</span>
            <span className="font-bold text-red-600">{absent} absent</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="px-6 py-3.5 bg-blue-600 text-white font-bold rounded-2xl active:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Review & Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}