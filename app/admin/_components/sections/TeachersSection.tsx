"use client";

import { useState, useEffect } from "react";
import type { User, ClassRoom } from "@/types/school";
import { SectionHeader } from "../SectionHeader";

export function TeachersSection({
  teachers,
  classes = [], // 🚨 NEW: Receive classes
  onBack,
  onCreate,
  onUpdate,
  onDelete,
  onResetPassword,
  createdCredentials,
  clearCredentials,
  onOpenImport,
}: {
  teachers: User[];
  classes?: ClassRoom[]; // 🚨 NEW
  onBack: () => void;
  onCreate: (name: string, email: string, classId: string | null) => Promise<void>;
  onUpdate: (id: string, name: string, email: string, classId: string | null) => Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onResetPassword: (id: string, name: string) => void;
  createdCredentials: { email: string; pin: string; title: string; description?: string } | null;
  clearCredentials: () => void;
  onOpenImport: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [classId, setClassId] = useState(""); // 🚨 NEW: Track assigned class
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const reset = () => {
    setName("");
    setEmail("");
    setClassId("");
    setEditingId(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    try {
      if (editingId) {
        await onUpdate(editingId, name.trim(), email.trim(), classId || null);
      } else {
        await onCreate(name.trim(), email.trim(), classId || null);
      }
      reset();
      setFormOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SectionHeader title="Teachers" subtitle={`${teachers.length} staff`} onBack={onBack} />
      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <button
            onClick={onOpenImport}
            className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl active:bg-slate-50"
          >
            Import
          </button>
          <button
            onClick={() => { reset(); setFormOpen(true); }}
            className="flex-1 py-3.5 bg-blue-600 text-white font-bold rounded-2xl active:bg-blue-700"
          >
            + Add Teacher
          </button>
        </div>

        {createdCredentials && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
            <p className="font-bold text-emerald-800 text-sm">{createdCredentials.title}</p>
            <p className="text-slate-700 text-xs"><strong>Email:</strong> {createdCredentials.email}</p>
            <p className="text-slate-700 text-xs"><strong>Passcode:</strong> {createdCredentials.pin}</p>
            {createdCredentials.description && <p className="text-slate-500 text-[11px] pt-1">{createdCredentials.description}</p>}
            <button onClick={clearCredentials} className="mt-2 text-xs font-semibold text-emerald-700 underline">Dismiss</button>
          </div>
        )}

        {formOpen && (
          <form onSubmit={submit} className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
            <p className="font-bold text-slate-900">{editingId ? "Edit Teacher" : "New Teacher"}</p>
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            {/* 🚨 NEW: Assign Class Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Assign to Class (Optional)
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base bg-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— No Class Assigned —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={busy} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl active:bg-blue-700 disabled:opacity-50">
                {busy ? "Saving…" : editingId ? "Update" : "Create"}
              </button>
              <button type="button" onClick={() => { reset(); setFormOpen(false); }} className="px-4 py-3 bg-slate-100 text-slate-600 font-semibold rounded-xl">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {teachers.map((t) => {
            // Find which class this teacher is assigned to
            const assignedClass = classes.find(c => (c as any).teacher_id === t.id);
            
            return (
              <div key={t.id} className="p-4 bg-white rounded-2xl border border-slate-200">
                <p className="font-semibold text-slate-900 truncate">{t.name}</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{t.email}</p>
                {assignedClass && (
                  <span className="inline-block mt-2 px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md uppercase tracking-wider">
                    {assignedClass.name}
                  </span>
                )}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <button
                    onClick={() => {
                      setEditingId(t.id);
                      setName(t.name);
                      setEmail(t.email);
                      setClassId(assignedClass?.id || "");
                      setFormOpen(true);
                    }}
                    className="py-2 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg active:bg-blue-100"
                  >
                    Edit
                  </button>
                  <button onClick={() => onResetPassword(t.id, t.name)} className="py-2 text-xs font-semibold text-amber-700 bg-amber-50 rounded-lg active:bg-amber-100">
                    Reset PIN
                  </button>
                  <button onClick={() => onDelete(t.id)} className="py-2 text-xs font-semibold text-red-600 bg-red-50 rounded-lg active:bg-red-100">
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}