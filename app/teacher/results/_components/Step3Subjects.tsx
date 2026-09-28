"use client";

import type {
  GradeResult,
  Subject,
  SubjectStats,
} from "../_lib/types";

export function Step3Subjects({
  subjects,
  subjectStats,
  availableSubjects,
  caWeight,
  examWeight,
  readOnly,
  grade,
  onUpdate,
  onRemove,
  onAddFromCatalog,
}: {
  subjects: Subject[];
  subjectStats: Record<string, SubjectStats>;
  availableSubjects: { id: string; name: string }[];
  caWeight: number;
  examWeight: number;
  readOnly: boolean;
  grade: (score: number | null) => GradeResult;
  onUpdate: (
    id: number,
    field: keyof Omit<Subject, "id">,
    value: string,
  ) => void;
  onRemove: (id: number) => void;
  onAddFromCatalog: (id: string, name: string) => Promise<void>;
}) {
  return (
    <div className="card">
      <div className="card-title">
        <span className="ic">📚</span>Subjects, CA & Exam Scores
      </div>
      <p className="hint">
        CA (/{caWeight}) · Exam (/{examWeight}) · Total (auto) · Position (auto)
        · Grade (auto)
      </p>
      <div className="subjects-wrap">
        <table className="stbl">
          <thead>
            <tr>
              <th style={{ width: "22px" }}>#</th>
              <th style={{ width: "120px", textAlign: "left" }}>Subject</th>
              <th style={{ width: "45px" }}>CA</th>
              <th style={{ width: "45px" }}>Ex</th>
              <th style={{ width: "40px" }}>Tot</th>
              <th style={{ width: "40px" }}>Pos</th>
              <th style={{ width: "30px" }}>Gr</th>
              <th style={{ width: "28px" }}></th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s, idx) => {
              const ca = s.ca !== "" ? parseFloat(s.ca) : null;
              const ex = s.exam !== "" ? parseFloat(s.exam) : null;
              const tt =
                ca !== null || ex !== null ? (ca || 0) + (ex || 0) : null;
              const { g } = tt !== null ? grade(tt) : { g: "—" };
              const gradeClass =
                g === "A"
                  ? "gA"
                  : g === "B"
                    ? "gB"
                    : g === "C"
                      ? "gC"
                      : g === "D"
                        ? "gD"
                        : g === "F"
                          ? "gF"
                          : "g_";

              return (
                <tr key={s.id}>
                  <td style={{ color: "#bbb", fontSize: ".75rem" }}>
                    {idx + 1}
                  </td>
                  <td>
                    <span className="block px-2 py-1 text-sm text-slate-800 font-medium">
                      {s.sub || "—"}
                    </span>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max={caWeight}
                      disabled={readOnly}
                      placeholder={`0–${caWeight}`}
                      value={s.ca}
                      onChange={(e) => onUpdate(s.id, "ca", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max={examWeight}
                      disabled={readOnly}
                      placeholder={`0–${examWeight}`}
                      value={s.exam}
                      onChange={(e) => onUpdate(s.id, "exam", e.target.value)}
                    />
                  </td>
                  <td>
                    <span className="cc">{tt !== null ? tt : "—"}</span>
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      fontSize: ".85rem",
                      color: "#555",
                    }}
                  >
                    {subjectStats[s.sub]?.position ?? "—"}
                  </td>
                  <td>
                    <span className={`gb ${gradeClass}`}>{g}</span>
                  </td>
                  <td>
                    {!readOnly && (
                      <button
                        className="btn btn-del"
                        onClick={() => onRemove(s.id)}
                        title="Remove subject"
                      >
                        ✕
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
        <div className="row-btns">
          {availableSubjects.length === 0 ? (
            <span className="text-xs text-slate-500">
              No subjects in the school catalog yet. Ask your admin to add some.
            </span>
          ) : (
            <select
              value=""
              onChange={async (e) => {
                const id = e.target.value;
                if (!id) return;
                const subj = availableSubjects.find((s) => s.id === id);
                if (!subj) return;
                await onAddFromCatalog(id, subj.name);
                e.target.value = "";
              }}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">＋ Add Subject from Catalog</option>
              {availableSubjects
                .filter(
                  (avail) =>
                    !subjects.some(
                      (s) => s.sub.toLowerCase() === avail.name.toLowerCase(),
                    ),
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}