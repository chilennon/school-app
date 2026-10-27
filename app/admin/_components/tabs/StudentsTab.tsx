"use client";

import { useState, useEffect } from "react";
import { Search, ArrowLeft, Plus, Loader2, CheckCircle2 } from "lucide-react";
import type { ClassRoom, Student } from "@/types/school";
import { supabase } from "@/lib/supabaseClient";
import { normalizePhone } from "@/lib/utils/phone";
import { toast } from "sonner"; // Added toast for error handling

export interface StudentsTabProps {
  students: Student[];
  classes: ClassRoom[];
  families: { id: string; name: string }[];
  onSave: (input: any) => Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onBack: () => void;
  onOpenImport: () => void;
}

export function StudentsTab({
  students,
  classes,
  families,
  onSave,
  onDelete,
  onBack,
  onOpenImport,
}: StudentsTabProps) {
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [classId, setClassId] = useState("");

  // Phone-Centric State
  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [matchedFamily, setMatchedFamily] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const [busy, setBusy] = useState(false);

  // ── REAL-TIME PHONE LOOKUP ──
  useEffect(() => {
    if (!formOpen) return;

    const norm1 = normalizePhone(phone1);
    const norm2 = normalizePhone(phone2);

    if (!norm1 && !norm2) {
      setMatchedFamily(null);
      setIsLookingUp(false);
      return;
    }

    setIsLookingUp(true);
    const timer = setTimeout(async () => {
      try {
        let query = supabase
          .from("families")
          .select("id, name")
          .is("deleted_at", null);

        if (norm1 && norm2) {
          query = query.or(
            `phone_normalized.eq.${norm1},phone_normalized_2.eq.${norm1},phone_normalized.eq.${norm2},phone_normalized_2.eq.${norm2}`,
          );
        } else if (norm1) {
          query = query.or(
            `phone_normalized.eq.${norm1},phone_normalized_2.eq.${norm1}`,
          );
        } else if (norm2) {
          query = query.or(
            `phone_normalized.eq.${norm2},phone_normalized_2.eq.${norm2}`,
          );
        }

        const { data, error } = await query.limit(1);
        if (error) throw error;

        // 🚨 FIX: Only set the object. Removed the duplicate line.
        setMatchedFamily(data && data.length > 0 ? data[0] : null);
      } catch (err) {
        console.error("Lookup failed", err);
        setMatchedFamily(null);
      } finally {
        setIsLookingUp(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [phone1, phone2, formOpen]);

  const reset = () => {
    setEditingId(null);
    setName("");
    setRegNo("");
    setAge("");
    setSex("");
    setClassId("");
    setPhone1("");
    setPhone2("");
    setGuardianName("");
    setMatchedFamily(null);
  };

  const openCreate = () => {
    reset();
    setFormOpen(true);
  };

  const openEdit = async (s: Student) => {
    setEditingId(s.id);
    setName(s.name);
    setRegNo(s.regNo);
    setAge(s.age || "");
    setSex(s.gender || "");
    setClassId(s.currentClassId || "");
    setPhone1("");
    setPhone2("");
    setGuardianName("");
    setMatchedFamily(null);
    setFormOpen(true);

    if ((s as any).family_id) {
      const { data } = await supabase
        .from("families")
        .select("id, name, guardian_phone, guardian_phone_2")
        .eq("id", (s as any).family_id)
        .single();

      if (data) {
        setMatchedFamily({ id: data.id, name: data.name });
        setPhone1(data.guardian_phone || "");
        setPhone2(data.guardian_phone_2 || "");
        setGuardianName(data.name.replace(" Family", ""));
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !regNo.trim()) return;
    if (!matchedFamily && !guardianName.trim() && !editingId) {
      return toast.error(
        "Please enter a Guardian Name to create a new family.",
      );
    }

    setBusy(true);
    try {
      await onSave({
        id: editingId || undefined,
        name: name.trim(),
        regNo: regNo.trim(),
        classId,
        gender: sex,
        age,
        familyId: matchedFamily?.id || null,
        newFamilyGuardianName: matchedFamily ? null : guardianName.trim(),
        guardianPhone1: phone1.trim(),
        guardianPhone2: phone2.trim(),
      });
      reset();
      setFormOpen(false);
      toast.success("Student updated successfully");
    } catch (err: any) {
      // 🚨 FIX: Catch API errors so the form doesn't silently fail
      console.error("Save failed:", err);
      toast.error(err.message || "Failed to save student. Check console.");
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

  const familyById: Record<string, string> = {};
  families.forEach((f) => {
    familyById[f.id] = f.name;
  });

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg md:max-w-3xl mx-auto">
      <header className="pt-[env(safe-area-inset-top)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-200 transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Students</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {students.length} enrolled
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onOpenImport}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition"
          >
            Import
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </header>

      {formOpen && (
        <form
          onSubmit={submit}
          className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4"
        >
          <p className="font-bold text-slate-900 border-b border-slate-100 pb-2">
            {editingId ? "Edit Student" : "New Student"}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Student Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Reg Number
              </label>
              <input
                type="text"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Age
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Gender
              </label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base bg-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Class
              </label>
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
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4 mt-2">
            <p className="font-bold text-slate-800 text-sm">
              Parent / Guardian
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Phone Number 1
                </label>
                <input
                  type="tel"
                  value={phone1}
                  onChange={(e) => setPhone1(e.target.value)}
                  placeholder="0803..."
                  className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Phone Number 2 (Optional)
                </label>
                <input
                  type="tel"
                  value={phone2}
                  onChange={(e) => setPhone2(e.target.value)}
                  placeholder="0809..."
                  className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {isLookingUp ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 px-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking phone
                number...
              </div>
            ) : matchedFamily ? (
              <div className="bg-green-100/50 border border-green-200 rounded-xl p-4 flex gap-3 items-start">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-green-800">
                    {matchedFamily.name.endsWith(" Family")
                      ? matchedFamily.name
                      : `${matchedFamily.name} Family`}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    {name || "This student"} will join this existing family.
                  </p>
                </div>
              </div>
            ) : (phone1 || phone2) && !isLookingUp ? (
              <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500 font-medium">
                  No family found with this phone number. A new one will be
                  created.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Guardian Name
                  </label>
                  <input
                    type="text"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="e.g. Mr. Musa"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={
                busy ||
                (!matchedFamily &&
                  Boolean(phone1 || phone2) &&
                  !guardianName.trim() &&
                  !editingId)
              }
              className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl active:bg-blue-700 disabled:opacity-50"
            >
              {busy
                ? "Saving…"
                : editingId
                  ? "Update Student"
                  : "Register Student"}
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
              className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 truncate">
                    {s.name}
                  </p>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                    {s.regNo}
                    {s.currentClassId &&
                      ` · ${classById[s.currentClassId] || "—"}`}
                    {(s as any).family_id &&
                      ` · ${familyById[(s as any).family_id] || "—"}`}
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
