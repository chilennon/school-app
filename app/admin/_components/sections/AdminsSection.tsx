"use client";

import { useState } from "react";
import type { User } from "@/types/school";
import { SectionHeader } from "../SectionHeader";

export function AdminsSection({
  admins,
  currentAdminId,
  onBack,
  onCreate,
  onResetPassword,
  createdCredentials,
  clearCredentials,
}: {
  admins: User[];
  currentAdminId: string | null;
  onBack: () => void;
  onCreate: (name: string, email: string) => Promise<void>;
  onResetPassword: (id: string, name: string) => void;
  createdCredentials: {
    email: string;
    pin: string;
    title: string;
    description?: string;
  } | null;
  clearCredentials: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const reset = () => {
    setName("");
    setEmail("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    try {
      await onCreate(name.trim(), email.trim());
      reset();
      setFormOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SectionHeader
        title="Admins"
        subtitle={`${admins.length} with full access`}
        onBack={onBack}
      />
      <div className="p-4 space-y-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          Admins can manage teachers, classes, students, subjects, and settings.
          Everyone with admin access sees the same data and can edit it. If two
          admins change the same thing, the most recent change wins.
        </p>

        <button
          onClick={() => {
            reset();
            setFormOpen(true);
          }}
          className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-2xl active:bg-blue-700"
        >
          + Add Admin
        </button>

        {createdCredentials && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
            <p className="font-bold text-emerald-800 text-sm">
              {createdCredentials.title}
            </p>
            <p className="text-slate-700 text-xs">
              <strong>Email:</strong> {createdCredentials.email}
            </p>
            <p className="text-slate-700 text-xs">
              <strong>Passcode:</strong> {createdCredentials.pin}
            </p>
            {createdCredentials.description && (
              <p className="text-slate-500 text-[11px] pt-1">
                {createdCredentials.description}
              </p>
            )}
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
            <p className="font-bold text-slate-900">New Admin</p>
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
                {busy ? "Creating…" : "Create Admin"}
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
          {admins.map((a) => {
            const isMe = a.id === currentAdminId;
            return (
              <div
                key={a.id}
                className="p-4 bg-white rounded-2xl border border-slate-200"
              >
                <p className="font-semibold text-slate-900 truncate">
                  {a.name}
                  {isMe && (
                    <span className="ml-2 text-[10px] font-bold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      You
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {a.email}
                </p>
                {!isMe && (
                  <div className="mt-3">
                    <button
                      onClick={() => onResetPassword(a.id, a.name)}
                      className="w-full py-2 text-xs font-semibold text-amber-700 bg-amber-50 rounded-lg active:bg-amber-100"
                    >
                      Reset Password
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}