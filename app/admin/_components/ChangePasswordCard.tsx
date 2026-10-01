"use client";

import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

export function ChangePasswordCard() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirm) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("New password must be different from the current one.");
      return;
    }

    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error("Could not verify your account.");
      }

      // Verify current password by attempting a sign-in
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInErr) {
        throw new Error("Current password is incorrect.");
      }

      // Update to the new password
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateErr) {
        throw new Error(updateErr.message);
      }

      toast.success("Password updated.");
      reset();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Couldn't update password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-50 transition"
      >
        <div>
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">
            Change Password
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Update the password you use to sign in
          </p>
        </div>
        <span className="text-xs text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <form
          onSubmit={handleSave}
          className="border-t border-slate-100 p-4 sm:p-5 space-y-3 bg-slate-50"
        >
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Current password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="The password you signed in with"
              className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base bg-white outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              New password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base bg-white outline-none focus:ring-2 focus:ring-blue-500"
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type the new password again"
              className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base bg-white outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl active:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Updating…" : "Update Password"}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="px-4 py-3 bg-slate-200 text-slate-700 font-semibold rounded-xl active:bg-slate-300"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}