"use client";

import type { CompilerForm } from "../_lib/types";

export function Step2Attendance({
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
        <span className="ic">📅</span>Attendance Record
      </div>
      <div className="attend-grid">
        <div className="field">
          <label>Days School Opened</label>
          <input
            type="number"
            min="0"
            disabled={readOnly}
            placeholder="e.g. 112"
            value={form.daysOpened}
            onChange={(e) => setField("daysOpened", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Days Present</label>
          <input
            type="number"
            min="0"
            disabled={readOnly}
            placeholder="e.g. 110"
            value={form.daysPresent}
            onChange={(e) => setField("daysPresent", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Days Absent (auto)</label>
          <input
            type="number"
            min="0"
            readOnly
            placeholder="auto"
            value={form.daysAbsent}
          />
        </div>
      </div>
    </div>
  );
}