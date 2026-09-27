"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function StaffSignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    // Step 1: sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (authError || !authData.user) {
      setErrorMessage(authError?.message || "Invalid email or password.");
      setLoading(false);
      return;
    }

    // Step 2: look up profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle(); // <-- use maybeSingle so 0 rows is not an error

    // TEMPORARY DEBUG — remove once the login works
    console.log("=== LOGIN DEBUG ===");
    console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("Auth user id:", authData.user.id);
    console.log("Auth user email:", authData.user.email);
    console.log("Profile row:", profile);
    console.log("Profile error:", profileError);

    if (profileError) {
      setErrorMessage(`Profile lookup failed: ${profileError.message}`);
      setLoading(false);
      return;
    }

    if (!profile) {
      setErrorMessage(
        `No profile row found for ${authData.user.email}. Check that the profile exists in the same Supabase project the app is pointed at.`
      );
      setLoading(false);
      return;
    }

    // Step 3: route by role
    if (profile.role === "admin") {
      router.push("/admin");
    } else if (profile.role === "teacher") {
      router.push("/teacher");
    } else {
      setErrorMessage(`Unknown role: ${profile.role}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-sm sm:max-w-md space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-bold text-xl sm:text-2xl shadow-md mb-3">
            HOA
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            House Of Angels School
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            K-12 School Management System
          </p>
        </div>

        {/* Card */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-sm font-bold text-slate-800">Staff Login</h2>
            <Link
              href="/"
              className="text-[11px] sm:text-xs text-blue-600 hover:underline font-medium"
            >
              ← Change Role
            </Link>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 font-medium break-words">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Staff Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="teacher@school.com"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 rounded-xl text-sm transition shadow-sm"
            >
              {loading ? "Signing In..." : "Sign In to Portal"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}