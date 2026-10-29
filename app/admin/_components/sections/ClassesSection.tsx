"use client";

import { useState, useEffect } from "react";
import { ArrowUp, ArrowDown, Save, X } from "lucide-react";
import type { User, ClassRoom } from "@/types/school";
import { SectionHeader } from "../SectionHeader";
import type { SubjectRow } from "../../_lib/types";

export function ClassesSection({
  classes,
  subjects,
  teachers,
  sessions, // 🚨 NEW: Pass the school's sessions
  classSubjectIds,
  onBack,
  onSave,
  onDelete,
  onAssignTeacher,
  onReorder,
}: {
  classes: ClassRoom[];
  subjects: SubjectRow[];
  teachers: User[];
  sessions: { id: string; name: string }[]; // 🚨 NEW
  classSubjectIds: Record<string, string[]>;
  onBack: () => void;
  onSave: (input: { id?: string; name: string; session: string; subjectIds: string[] }) => Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onAssignTeacher: (classId: string, teacherId: string) => Promise<void>;
  onReorder: (updates: { id: string; sort_order: number }[]) => Promise<void>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [session, setSession] = useState(""); // Store the session NAME
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // DRAFT MODE STATE
  const [localClasses, setLocalClasses] = useState<ClassRoom[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Sync local state when props change
  useEffect(() => {
    const sorted = [...classes].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
    setLocalClasses(sorted);
    setHasUnsavedChanges(false);
  }, [classes]);

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
        subjectIds, // 🚨 Pass the selected subjects!
      });
      reset();
      setFormOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => {
    setSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= localClasses.length) return;

    const newClasses = [...localClasses];
    const temp = newClasses[index];
    newClasses[index] = newClasses[targetIndex];
    newClasses[targetIndex] = temp;

    setLocalClasses(newClasses);
    setHasUnsavedChanges(true);
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      const updates = localClasses.map((cls, index) => ({
        id: cls.id,
        sort_order: index + 1,
      }));
      await onReorder(updates);
      setHasUnsavedChanges(false);
    } catch (err) {
      const sorted = [...classes].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
      setLocalClasses(sorted);
      setHasUnsavedChanges(false);
    } finally {
      setIsSavingOrder(false);
    }
  };

  return (
    <div className="pb-24">
      <SectionHeader title="Classes" subtitle={`${classes.length} total`} onBack={onBack} />
      
      <div className="p-4 space-y-4">
        <button
          onClick={() => { reset(); setFormOpen(true); }}
          className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-2xl active:bg-blue-700"
        >
          + Create Class
        </button>

        {formOpen && (
          <form onSubmit={submit} className="p-4 bg-white rounded-2xl border border-slate-200 space-y-4">
            <p className="font-bold text-slate-900">{editingId ? "Edit Class" : "New Class"}</p>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Class Name</label>
              <input
                type="text"
                placeholder="e.g. Primary 4A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 🚨 FIX: Session Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Session</label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base bg-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>Select a session...</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* 🚨 FIX: Restored Subject Checklist */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subjects Offered</label>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                {subjects.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer">
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

            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={busy} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl active:bg-blue-700 disabled:opacity-50">
                {busy ? "Saving…" : editingId ? "Update" : "Save"}
              </button>
              <button type="button" onClick={() => { reset(); setFormOpen(false); }} className="px-4 py-3 bg-slate-100 text-slate-600 font-semibold rounded-xl">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 mb-2">
          <strong>Class Ladder:</strong> Use the arrows to rearrange classes. Click <strong>Save Order</strong> when done.
        </div>

        <div className="space-y-3">
          {localClasses.map((cls: any, index) => {
            const subjIds = classSubjectIds[cls.id] || [];
            const clsSubjects = subjects.filter((s) => subjIds.includes(s.id));
            const isFirst = index === 0;
            const isLast = index === localClasses.length - 1;

            return (
              <div key={cls.id} className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 flex gap-3">
                
                <div className="flex flex-col items-center justify-center gap-1 border-r border-slate-100 pr-3">
                  <button
                    onClick={() => handleMove(index, "up")}
                    disabled={isFirst}
                    className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30 text-slate-500"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] font-bold text-slate-400">
                    #{index + 1}
                  </span>
                  <button
                    onClick={() => handleMove(index, "down")}
                    disabled={isLast}
                    className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30 text-slate-500"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{cls.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{cls.session}</p>
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
                      <button onClick={() => onDelete(cls.id)} className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {clsSubjects.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">No subjects</span>
                    ) : (
                      clsSubjects.map((s) => (
                        <span key={s.id} className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-semibold">
                          {s.name}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="mt-3">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Form Teacher</label>
                    <select
                      value={cls.assignedTeacherId || ""}
                      onChange={(e) => onAssignTeacher(cls.id, e.target.value)}
                      className="w-full text-sm bg-white border border-slate-300 rounded-lg p-2 outline-none"
                    >
                      <option value="">— Unassigned —</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hasUnsavedChanges && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-50 animate-in slide-in-from-bottom-2">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
            <p className="text-sm font-bold text-slate-700">Unsaved changes</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const sorted = [...classes].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
                  setLocalClasses(sorted);
                  setHasUnsavedChanges(false);
                }}
                className="px-4 py-2 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOrder}
                disabled={isSavingOrder}
                className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl flex items-center gap-2"
              >
                {isSavingOrder ? "Saving..." : <><Save className="w-4 h-4" /> Save Order</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}