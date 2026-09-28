export function StatsRow({
  students,
  teachers,
  classes,
}: {
  students: number;
  teachers: number;
  classes: number;
}) {
  const items = [
    { label: "Students", value: students },
    { label: "Teachers", value: teachers },
    { label: "Classes", value: classes },
  ];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 flex divide-x divide-slate-100">
      {items.map(({ label, value }) => (
        <div key={label} className="flex-1 py-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{value}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}