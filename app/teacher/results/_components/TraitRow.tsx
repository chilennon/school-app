"use client";

const VALUES = ["1", "2", "3", "4", "5"] as const;

export function TraitRow({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3">
      <p className="text-sm font-medium text-slate-800 mb-2.5">{label}</p>
      <div className="grid grid-cols-5 gap-2">
        {VALUES.map((v) => {
          const selected = value === v;
          return (
            <button
              key={v}
              type="button"
              disabled={readOnly}
              onClick={() => onChange(selected ? "" : v)}
              className={`aspect-square rounded-full text-base font-bold flex items-center justify-center transition ${
                selected
                  ? "bg-blue-600 text-white shadow-md"
                  : "border-2 border-slate-200 text-transparent active:bg-slate-50"
              } disabled:opacity-60`}
              aria-label={`Rate ${v} out of 5`}
            >
              {selected ? v : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}