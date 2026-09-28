"use client";

import type { CompilerForm } from "../_lib/types";

export function Step5Remarks({
  form,
  setField,
  readOnly,
}: {
  form: CompilerForm;
  setField: <K extends keyof CompilerForm>(k: K, v: CompilerForm[K]) => void;
  readOnly: boolean;
}) {
  return (
    <div className="card">
      <div className="card-title">
        <span className="ic">✍️</span>Remarks & Comments
      </div>
      <div className="form-grid">
        <div className="field">
          <label>Class Teacher's Name</label>
          <input
            type="text"
            disabled={readOnly}
            placeholder="e.g. Mrs. Adaeze Nwosu"
            value={form.teacherName}
            onChange={(e) => setField("teacherName", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Head Teacher's Name</label>
          <input
            type="text"
            disabled={readOnly}
            placeholder="e.g. Mr. Emeka Obi"
            value={form.headTeacherName}
            onChange={(e) => setField("headTeacherName", e.target.value)}
          />
        </div>
        <div className="field full">
          <label>Class Teacher's Remark</label>
          <textarea
            disabled={readOnly}
            placeholder="e.g. Giovanni has done well this term. Keep it up boy..."
            value={form.teacherRemark}
            onChange={(e) => setField("teacherRemark", e.target.value)}
          />
        </div>
        <div className="field full">
          <label>Head Teacher's Comment</label>
          <textarea
            disabled={readOnly}
            placeholder="e.g. An excellent performance keep it up."
            value={form.headRemark}
            onChange={(e) => setField("headRemark", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Next Term Begins</label>
          <input
            type="text"
            disabled={readOnly}
            placeholder="e.g. 4th May 2026"
            value={form.nextTerm}
            onChange={(e) => setField("nextTerm", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Promotion Status (optional)</label>
          <select
            disabled={readOnly}
            value={form.promotion}
            onChange={(e) => setField("promotion", e.target.value)}
          >
            <option value="">— Select —</option>
            <option>Promoted to Next Class</option>
            <option>Repeated – Academic Performance</option>
            <option>Repeated – Attendance</option>
            <option>Graduated</option>
            <option>Pending Review</option>
          </select>
        </div>
      </div>
    </div>
  );
}