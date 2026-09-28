"use client";

import { useState } from "react";
import type { User, ClassRoom } from "@/types/school";
import { SectionHeader } from "../SectionHeader";
import type { SubjectRow } from "../../_lib/types";

export function ClassesSection({
  classes,
  subjects,
  teachers,
  classSubjectIds,
  onBack,
  onSave,
  onDelete,
  onAssignTeacher,
}: {
  classes: ClassRoom[];
  subjects: SubjectRow[];
  teachers: User[];
  classSubjectIds: Record<string, string[]>;
  onBack: () => void;
  onSave: (input: {
    id?: string;
    name: string;
    session: string;
    subjectIds: string[];
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAssignTeacher: (classId: string, teacherId: string) => Promise<void>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [session, setSession] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEditingId(null);
    setName("");
    setSession("");
    setSubjectIds([]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !session.trim()) return;
    setBusy(true);
    try {
      await onSave({
        id: editingId || undefined,
        name: name.trim(),
        session: session.trim(),
        subjectIds,
      });
      reset();
      setFormOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => {
    setSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div>
      <SectionHeader
        title="Classes"
        subtitle={`${classes.length} total`}
        onBack={onBack}
      />
      <div className="p-4 space-y-4">
        <button
          onClick={() => {
            reset();
            setFormOpen(true);
          }}
          className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-2xl active:bg-blue-700"
        >
          + Create Class
        </button>

        {formOpen && (
          <form
            onSubmit={submit}
            className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3"
          >
            <p className="font-bold text-slate-900">
              {editingId ? "Edit Class" : "New Class"}
            </p>
            <input
              type="text"
              placeholder="Class name (e.g. Primary 4A)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Session (e.g. 2025/2026)"
              value={session}
              onChange={(e) => setSession(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">
                Subjects ({subjectIds.length})
              </p>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                {subjects.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={subjectIds.includes(s.id)}
                      onChange={() => toggle(s.id)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span className="text-sm text-slate-700">{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl active:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : editingId ? "Update" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  reset();
                  setFormOpen(false);
                }}
                className="px-4 py-3 bg-slate-100 text-slate-600 font-semibold rounded-xl"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {classes.map((cls) => {
            const subjIds = classSubjectIds[cls.id] || [];
            const clsSubjects = subjects.filter((s) => subjIds.includes(s.id));
            return (
              <div
                key={cls.id}
                className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      {cls.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {cls.session}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingId(cls.id);
                        setName(cls.name);
                        setSession(cls.session);
                        setSubjectIds(classSubjectIds[cls.id] || []);
                        setFormOpen(true);
                      }}
                      className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(cls.id)}
                      className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-2 rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {clsSubjects.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">
                      No subjects
                    </span>
                  ) : (
                    clsSubjects.map((s) => (
                      <span
                        key={s.id}
                        className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-semibold"
                      >
                        {s.name}
                      </span>
                    ))
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Form Teacher
                  </label>
                  <select
                    value={cls.assignedTeacherId || ""}
                    onChange={(e) => onAssignTeacher(cls.id, e.target.value)}
                    className="w-full text-sm bg-white border border-slate-300 rounded-lg p-3 outline-none"
                  >
                    <option value="">— Unassigned —</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}