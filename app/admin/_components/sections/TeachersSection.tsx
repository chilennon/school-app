"use client";

import { useState } from "react";
import type { User } from "@/types/school";
import { SectionHeader } from "../SectionHeader";

export function TeachersSection({
  teachers,
  onBack,
  onCreate,
  onUpdate,
  onDelete,
  createdCredentials,
  clearCredentials,
}: {
  teachers: User[];
  onBack: () => void;
  onCreate: (name: string, email: string) => Promise<void>;
  onUpdate: (id: string, name: string, email: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  createdCredentials: { email: string; pin: string } | null;
  clearCredentials: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const reset = () => {
    setName("");
    setEmail("");
    setEditingId(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    try {
      if (editingId) {
        await onUpdate(editingId, name.trim(), email.trim());
      } else {
        await onCreate(name.trim(), email.trim());
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
        <button
          onClick={() => {
            reset();
            setFormOpen(true);
          }}
          className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-2xl active:bg-blue-700"
        >
          + Register Teacher
        </button>

        {createdCredentials && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
            <p className="font-bold text-emerald-800 text-sm">
              Teacher Account Created
            </p>
            <p className="text-slate-700 text-xs">
              <strong>Email:</strong> {createdCredentials.email}
            </p>
            <p className="text-slate-700 text-xs">
              <strong>Passcode:</strong> {createdCredentials.pin}
            </p>
            <button
              onClick={clearCredentials}
              className="mt-2 text-xs font-semibold text-emerald-700 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {formOpen && (
          <form
            onSubmit={submit}
            className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3"
          >
            <p className="font-bold text-slate-900">
              {editingId ? "Edit Teacher" : "New Teacher"}
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
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl active:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : editingId ? "Update" : "Create"}
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

        <div className="space-y-2">
          {teachers.map((t) => (
            <div
              key={t.id}
              className="p-4 bg-white rounded-2xl border border-slate-200"
            >
              <p className="font-semibold text-slate-900 truncate">{t.name}</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {t.email}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    setEditingId(t.id);
                    setName(t.name);
                    setEmail(t.email);
                    setFormOpen(true);
                  }}
                  className="flex-1 py-2 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg active:bg-blue-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(t.id)}
                  className="flex-1 py-2 text-xs font-semibold text-red-600 bg-red-50 rounded-lg active:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}