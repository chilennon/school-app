"use client";

import type { CompilerForm } from "../_lib/types";

export function Step1StudentDetails({
  form,
  setField,
  readOnly,
}: {
  form: CompilerForm;
  setField: <K extends keyof CompilerForm>(k: K, v: CompilerForm[K]) => void;
  readOnly: boolean;
}) {
  const ro = readOnly;
  return (
    <div className="card">
      <div className="card-title">
        <span className="ic">🏫</span>School & Student Information
      </div>

      <div className="form-grid">
        <div className="field full">
          <label>School Name</label>
          <input
            type="text"
            disabled={ro}
            placeholder="e.g. Smart Start Private School"
            value={form.schoolName}
            onChange={(e) => setField("schoolName", e.target.value)}
          />
        </div>
        <div className="field full">
          <label>School Address</label>
          <input
            type="text"
            disabled={ro}
            placeholder="e.g. 20 Gbenga Olatunji Street, Bucknor Lagos"
            value={form.schoolAddress}
            onChange={(e) => setField("schoolAddress", e.target.value)}
          />
        </div>
        <div className="field">
          <label>School Email</label>
          <input
            type="text"
            disabled={ro}
            placeholder="school@example.com"
            value={form.schoolEmail}
            onChange={(e) => setField("schoolEmail", e.target.value)}
          />
        </div>
        <div className="field">
          <label>School Phone</label>
          <input
            type="text"
            disabled={ro}
            placeholder="e.g. 09012293099"
            value={form.schoolPhone}
            onChange={(e) => setField("schoolPhone", e.target.value)}
          />
        </div>
      </div>

      <br />

      <div className="form-grid">
        <div className="field">
          <label>Student Full Name</label>
          <input
            type="text"
            disabled={ro}
            placeholder="e.g. Giovanni Onwuneme"
            value={form.studentName}
            onChange={(e) => setField("studentName", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Student ID</label>
          <input
            type="text"
            disabled={ro}
            placeholder="e.g. SSL1799"
            value={form.studentId}
            onChange={(e) => setField("studentId", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Sex</label>
          <select
            disabled={ro}
            value={form.sex}
            onChange={(e) => setField("sex", e.target.value)}
          >
            <option value="">— Select —</option>
            <option>Male</option>
            <option>Female</option>
          </select>
        </div>
        <div className="field">
          <label>Age</label>
          <input
            type="text"
            disabled={ro}
            placeholder="e.g. 5"
            value={form.age}
            onChange={(e) => setField("age", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Class / Form</label>
          <input
            type="text"
            disabled={ro}
            placeholder="e.g. Nursery 2, JSS3A"
            value={form.className}
            onChange={(e) => setField("className", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Academic Session</label>
          <input
            type="text"
            disabled={ro}
            placeholder="e.g. 2025/2026"
            value={form.session}
            onChange={(e) => setField("session", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Term</label>
          <select
            disabled={ro}
            value={form.term}
            onChange={(e) => setField("term", e.target.value)}
          >
            <option value="">— Select —</option>
            <option>First Term</option>
            <option>Second Term</option>
            <option>Third Term</option>
          </select>
        </div>
        <div className="field">
          <label>Class Average Score (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            disabled={ro}
            placeholder="e.g. 85.7"
            value={form.classAvg}
            onChange={(e) => setField("classAvg", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}