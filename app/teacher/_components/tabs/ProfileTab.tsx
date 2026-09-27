"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export function ProfileTab({
  teacherName,
  userEmail,
  onLogout,
}: {
  teacherName: string;
  userEmail: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: "error", text: "Please fill in all fields." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({
        type: "error",
        text: "Password must be at least 6 characters.",
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });
    if (signInError) {
      setMessage({ type: "error", text: "Current password is incorrect." });
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError) {
      setMessage({ type: "error", text: updateError.message });
    } else {
      setMessage({ type: "success", text: "Password updated successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setOpen(false), 1500);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      <header className="pt-[env(safe-area-inset-top)]">
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
      </header>

      <div className="p-4 bg-white rounded-2xl border border-slate-200">
        <p className="font-bold text-slate-900">{teacherName || "Teacher"}</p>
        <p className="text-xs text-slate-500 mt-0.5">{userEmail}</p>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full p-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-between active:bg-slate-50"
      >
        <span className="font-semibold text-slate-900">Change Password</span>
        <ChevronRight
          className={`w-5 h-5 text-slate-400 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open && (
        <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter new password"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Confirm new password"
            />
          </div>
          {message && (
            <p
              className={`text-sm ${
                message.type === "success" ? "text-green-600" : "text-red-600"
              }`}
            >
              {message.text}
            </p>
          )}
          <button
            onClick={handleChange}
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-2xl active:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Updating…" : "Update Password"}
          </button>
        </div>
      )}

      <button
        onClick={onLogout}
        className="w-full p-4 bg-red-50 border border-red-200 rounded-2xl text-left font-semibold text-red-600 active:bg-red-100"
      >
        Sign Out
      </button>
    </div>
  );
}