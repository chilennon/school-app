"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { ClassRoom, Student } from "@/types/school";
import type { SectionHeader } from "../SectionHeader";

export interface StudentsTabProps {
  students: Student[];
  classes: ClassRoom[];
  onSave: (input: {
    id?: string;
    name: string;
    regNo: string;
    classId: string;
    gender: string;
    age: string;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function StudentsTab({
  students,
  classes,
  onSave,
  onDelete,
}: StudentsTabProps) {
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [classId, setClassId] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEditingId(null);
    setName("");
    setRegNo("");
    setAge("");
    setSex("");
    setClassId("");
  };

  const openCreate = () => {
    reset();
    setFormOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditingId(s.id);
    setName(s.name);
    setRegNo(s.regNo);
    setAge(s.age || "");
    setSex(s.gender || "");
    setClassId(s.currentClassId || "");
    setFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !regNo.trim()) return;
    setBusy(true);
    try {
      await onSave({
        id: editingId || undefined,
        name: name.trim(),
        regNo: regNo.trim(),
        classId,
        gender: sex,
        age,
      });
      reset();
      setFormOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.regNo.toLowerCase().includes(query.toLowerCase()),
  );

  const classById: Record<string, string> = {};
  classes.forEach((c) => {
    classById[c.id] = c.name;
  });

  return (
    <div className="p-4 space-y-4 pb-24">
      <header className="pt-[env(safe-area-inset-top)] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {students.length} enrolled
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl active:bg-blue-700"
        >
          + Add
        </button>
      </header>

      {formOpen && (
        <form
          onSubmit={submit}
          className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3"
        >
          <p className="font-bold text-slate-900">
            {editingId ? "Edit Student" : "New Student"}
          </p>
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Reg number"
            value={regNo}
            onChange={(e) => setRegNo(e.target.value)}
            required
            className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              placeholder="Age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base bg-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sex</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base bg-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Unassigned —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl active:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Saving…" : editingId ? "Update" : "Register"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                reset();
              }}
              className="px-4 py-3 bg-slate-100 text-slate-600 font-semibold rounded-xl"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search students…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-3 border border-slate-200 rounded-xl text-base bg-white outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center text-sm text-slate-500">
          No students found.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="p-4 bg-white rounded-2xl border border-slate-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 truncate">
                    {s.name}
                  </p>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                    {s.regNo}
                    {s.currentClassId && ` · ${classById[s.currentClassId] || "—"}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => openEdit(s)}
                  className="flex-1 py-2 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg active:bg-blue-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(s.id)}
                  className="flex-1 py-2 text-xs font-semibold text-red-600 bg-red-50 rounded-lg active:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}