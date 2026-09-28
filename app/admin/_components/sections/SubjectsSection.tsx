"use client";

import { useState } from "react";
import { SectionHeader } from "../SectionHeader";
import type { SubjectRow } from "../../_lib/types";

export function SubjectsSection({
  subjects,
  onBack,
  onAdd,
  onDelete,
}: {
  subjects: SubjectRow[];
  onBack: () => void;
  onAdd: (name: string) => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onAdd(name.trim());
      setName("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SectionHeader
        title="Subjects"
        subtitle={`${subjects.length} in catalog`}
        onBack={onBack}
      />
      <div className="p-4 space-y-4">
        <form
          onSubmit={submit}
          className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3"
        >
          <p className="font-bold text-slate-900">Add Subject</p>
          <input
            type="text"
            placeholder="e.g. French"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl active:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add to Catalog"}
          </button>
        </form>

        {subjects.length === 0 ? (
          <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center text-sm text-slate-500">
            No subjects yet.
          </div>
        ) : (
          <div className="space-y-2">
            {subjects.map((s) => (
              <div
                key={s.id}
                className="p-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-3"
              >
                <span className="font-semibold text-slate-900 truncate">
                  {s.name}
                </span>
                <button
                  onClick={() => onDelete(s.id, s.name)}
                  className="flex-shrink-0 text-xs font-semibold text-red-600 bg-red-50 px-3 py-2 rounded-lg active:bg-red-100"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}