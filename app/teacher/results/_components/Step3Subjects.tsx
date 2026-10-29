"use client";

import { BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { cardCls, cardTitleCls, gradeTone } from "../_lib/ui";
import type { GradeResult, Subject, SubjectStats } from "../_lib/types";

export function Step3Subjects({
  subjects, subjectStats, caWeight, examWeight,
  readOnly, grade, onUpdate,
}: {
  subjects: Subject[];
  subjectStats: Record<string, SubjectStats>;
  caWeight: number;
  examWeight: number;
  readOnly: boolean;
  grade: (score: number | null) => GradeResult;
  onUpdate: (id: number, field: keyof Omit<Subject, "id">, value: string) => void;
}) {
  
  const handleScoreChange = (id: number, field: "ca" | "exam", rawValue: string, max: number) => {
    let val = rawValue;
    if (val !== "") {
      const num = Number(val);
      if (num > max) val = String(max);
      else if (num < 0) val = "0";
    }
    onUpdate(id, field, val);
  };

  return (
    <div className={cardCls}>
      <div className={cardTitleCls}>
        <BookOpen className="h-4 w-4 text-slate-500" />
        <span>Subjects &amp; Scores</span>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        CA (/{caWeight}) · Exam (/{examWeight}) · Total, position &amp; grade auto
      </p>

      {subjects.length === 0 ? (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <p className="text-sm font-medium text-orange-800">
            No subjects assigned to this class yet.
          </p>
          <p className="text-xs text-orange-600 mt-1">
            Please ask the Admin to assign subjects to this class in the Admin Dashboard.
          </p>
        </div>
      ) : (
        <>
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
                    onChange={(e) => handleScoreChange(s.id, "ca", e.target.value, caWeight)} />
                  <Input type="number" inputMode="numeric" className="w-14 h-10 text-base text-center px-1"
                    min="0" max={examWeight} disabled={readOnly}
                    placeholder={`0-${examWeight}`} value={s.exam}
                    onChange={(e) => handleScoreChange(s.id, "exam", e.target.value, examWeight)} />
                  <span className="w-8 text-center text-sm font-bold text-blue-600">
                    {tt ?? "—"}
                  </span>
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
                          onChange={(e) => handleScoreChange(s.id, "ca", e.target.value, caWeight)} />
                      </td>
                      <td className="py-1 px-1">
                        <Input type="number" className="h-10 text-base text-center"
                          min="0" max={examWeight} disabled={readOnly}
                          placeholder={`0-${examWeight}`} value={s.exam}
                          onChange={(e) => handleScoreChange(s.id, "exam", e.target.value, examWeight)} />
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}