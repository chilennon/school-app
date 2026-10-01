"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function SignupSchoolPage() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [motto, setMotto] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (
      !adminName.trim() ||
      !email.trim() ||
      !password ||
      !schoolName.trim()
    ) {
      setError("Please fill in all required fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/schools/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminName: adminName.trim(),
          email: email.trim(),
          password,
          schoolName: schoolName.trim(),
          address: address.trim(),
          phone: phone.trim(),
          motto: motto.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");

      // Sign in with the freshly-created credentials
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInErr) throw new Error(signInErr.message);

      router.push("/admin");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        <header className="text-center space-y-1">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white text-2xl flex items-center justify-center mx-auto">
            🏫
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Set up your school
          </h1>
          <p className="text-sm text-slate-500">
            Create your school portal in one step
          </p>
        </header>

        <form
          onSubmit={submit}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5"
        >
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              Your account
            </p>

            <Field label="Your full name">
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="e.g. Mr. Emeka Obi"
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </Field>

            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
                required
                minLength={8}
              />
            </Field>

            <Field label="Confirm password">
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </Field>
          </section>

          <hr className="border-slate-200" />

          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              Your school
            </p>

            <Field label="School name">
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="e.g. House Of Angels School"
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </Field>

            <Field label="School address">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, area, city"
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            <Field label="School phone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 08012345678"
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            <Field label="Motto (optional)">
              <input
                type="text"
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
                placeholder="e.g. Knowledge is Light"
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
          </section>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-2xl active:bg-blue-700 disabled:bg-blue-300"
          >
            {loading ? "Creating your school…" : "Create school"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/sign-in/staff" className="text-blue-600 font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-600 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}