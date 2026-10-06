"use client";

export interface AttendanceStudent {
  enrolmentId: string;
  name: string;
  regNo: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AttendanceRow({
  student,
  status,
  onChange,
}: {
  student: AttendanceStudent;
  status: "present" | "absent";
  onChange: (status: "present" | "absent") => void;
}) {
  const isPresent = status === "present";

  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-200">
      <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
        {initials(student.name)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 text-sm truncate">
          {student.name}
        </p>
        <p className="text-[11px] font-mono text-slate-500 mt-0.5">
          {student.regNo}
        </p>
      </div>

      <div className="flex items-center rounded-full border border-slate-200 p-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => onChange("present")}
          className={`px-3 py-1.5 text-xs font-bold rounded-full transition ${
            isPresent
              ? "bg-emerald-500 text-white shadow-sm"
              : "text-slate-400"
          }`}
        >
          Present
        </button>
        <button
          type="button"
          onClick={() => onChange("absent")}
          className={`px-3 py-1.5 text-xs font-bold rounded-full transition ${
            !isPresent ? "bg-red-500 text-white shadow-sm" : "text-slate-400"
          }`}
        >
          Absent
        </button>
      </div>
    </div>
  );
}