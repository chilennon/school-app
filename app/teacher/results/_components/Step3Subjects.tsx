"use client";

import { BookOpen, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { cardCls, cardTitleCls, gradeTone } from "../_lib/ui";
import type { GradeResult, Subject, SubjectStats } from "../_lib/types";

export function Step3Subjects({
  subjects, subjectStats, availableSubjects, caWeight, examWeight,
  readOnly, grade, onUpdate, onRemove, onAddFromCatalog,
}: {
  subjects: Subject[];
  subjectStats: Record<string, SubjectStats>;
  availableSubjects: { id: string; name: string }[];
  caWeight: number;
  examWeight: number;
  readOnly: boolean;
  grade: (score: number | null) => GradeResult;
  onUpdate: (id: number, field: keyof Omit<Subject, "id">, value: string) => void;
  onRemove: (id: number) => void;
  onAddFromCatalog: (id: string, name: string) => Promise<void>;
}) {
  return (
    <div className={cardCls}>
      <div className={cardTitleCls}>
        <BookOpen className="h-4 w-4 text-slate-500" />
        <span>Subjects &amp; Scores</span>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        CA (/{caWeight}) · Exam (/{examWeight}) · Total, position &amp; grade auto
      </p>

      {/* Mobile: one row per subject */}
      <div className="md:hidden divide-y divide-slate-100">
        {subjects.map((s) => {
          const ca = s.ca !== "" ? parseFloat(s.ca) : null;
          const ex = s.exam !== "" ? parseFloat(s.exam) : null;
          const tt = ca !== null || ex !== null ? (ca || 0) + (ex || 0) : null;
          return (
            <div key={s.id} className="flex items-center gap-2 py-3">
              <span className="flex-1 min-w-0 text-sm font-medium text-slate-900 truncate">
                {s.sub || "—"}
              </span>
              <Input type="number" inputMode="numeric" className="w-14 h-10 text-base text-center px-1"
                min="0" max={caWeight} disabled={readOnly}
                placeholder={`0-${caWeight}`} value={s.ca}
                onChange={(e) => onUpdate(s.id, "ca", e.target.value)} />
              <Input type="number" inputMode="numeric" className="w-14 h-10 text-base text-center px-1"
                min="0" max={examWeight} disabled={readOnly}
                placeholder={`0-${examWeight}`} value={s.exam}
                onChange={(e) => onUpdate(s.id, "exam", e.target.value)} />
              <span className="w-8 text-center text-sm font-bold text-blue-600">
                {tt ?? "—"}
              </span>
              {!readOnly && (
                <button onClick={() => onRemove(s.id)}
                  className="p-1.5 text-red-500 active:bg-red-50 rounded-md"
                  aria-label="Remove subject">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: full table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 border-b border-slate-200">
            <tr>
              <th className="text-left py-2 pr-2 font-medium w-8">#</th>
              <th className="text-left py-2 pr-2 font-medium">Subject</th>
              <th className="text-center py-2 px-2 font-medium w-20">CA</th>
              <th className="text-center py-2 px-2 font-medium w-20">Exam</th>
              <th className="text-center py-2 px-2 font-medium w-16">Total</th>
              <th className="text-center py-2 px-2 font-medium w-16">Pos</th>
              <th className="text-center py-2 px-2 font-medium w-14">Grade</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subjects.map((s, idx) => {
              const ca = s.ca !== "" ? parseFloat(s.ca) : null;
              const ex = s.exam !== "" ? parseFloat(s.exam) : null;
              const tt = ca !== null || ex !== null ? (ca || 0) + (ex || 0) : null;
              const g = tt !== null ? grade(tt).g : "—";
              return (
                <tr key={s.id}>
                  <td className="py-2 pr-2 text-xs text-slate-400">{idx + 1}</td>
                  <td className="py-2 pr-2 text-sm font-medium text-slate-900">{s.sub || "—"}</td>
                  <td className="py-1 px-1">
                    <Input type="number" className="h-10 text-base text-center"
                      min="0" max={caWeight} disabled={readOnly}
                      placeholder={`0-${caWeight}`} value={s.ca}
                      onChange={(e) => onUpdate(s.id, "ca", e.target.value)} />
                  </td>
                  <td className="py-1 px-1">
                    <Input type="number" className="h-10 text-base text-center"
                      min="0" max={examWeight} disabled={readOnly}
                      placeholder={`0-${examWeight}`} value={s.exam}
                      onChange={(e) => onUpdate(s.id, "exam", e.target.value)} />
                  </td>
                  <td className="py-2 px-2 text-center font-semibold text-slate-800">{tt ?? "—"}</td>
                  <td className="py-2 px-2 text-center text-sm text-slate-600">
                    {subjectStats[s.sub]?.position ?? "—"}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-bold", gradeTone(g))}>
                      {g}
                    </span>
                  </td>
                  <td className="py-1">
                    {!readOnly && (
                      <button onClick={() => onRemove(s.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
                        aria-label="Remove subject">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="mt-4">
          {availableSubjects.length === 0 ? (
            <p className="text-xs text-slate-500">
              No subjects in the school catalog yet. Ask your admin to add some.
            </p>
          ) : (
            <select
              value=""
              onChange={async (e) => {
                const id = e.target.value;
                if (!id) return;
                const subj = availableSubjects.find((x) => x.id === id);
                if (!subj) return;
                await onAddFromCatalog(id, subj.name);
                e.target.value = "";
              }}
              className="w-full md:w-auto rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-blue-600 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">＋ Add Subject from Catalog</option>
              {availableSubjects
                .filter((a) => !subjects.some((s) => s.sub.toLowerCase() === a.name.toLowerCase()))
                .map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}