"use client";

import {
  AFFECTIVE_LABELS,
  PSYCHOMOTOR_LABELS,
  RATING_OPTIONS,
} from "../_lib/constants";
import type { CompilerForm } from "../_lib/types";

export function Step4Traits({
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
        <span className="ic">🌱</span>Behavioural & Skills Assessment
      </div>
      <p className="hint">
        5 = Excellent · 4 = Very Good · 3 = Good · 2 = Average · 1 = Below
        Average · Leave blank if not assessed
      </p>
      <div className="domain-grid">
        <div className="dom-section">
          <h3>Affective Domain</h3>
          <table className="dom-tbl">
            <tbody>
              {AFFECTIVE_LABELS.map((label, i) => (
                <tr key={`a${i}`}>
                  <td>{label}</td>
                  <td>
                    <select
                      disabled={readOnly}
                      value={form.affective[`a${i}`] || ""}
                      onChange={(e) =>
                        setField("affective", {
                          ...form.affective,
                          [`a${i}`]: e.target.value,
                        })
                      }
                    >
                      <option value="">—</option>
                      {RATING_OPTIONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="dom-section">
          <h3>Psychomotor Skills</h3>
          <table className="dom-tbl">
            <tbody>
              {PSYCHOMOTOR_LABELS.map((label, i) => (
                <tr key={`p${i}`}>
                  <td>{label}</td>
                  <td>
                    <select
                      disabled={readOnly}
                      value={form.psychomotor[`p${i}`] || ""}
                      onChange={(e) =>
                        setField("psychomotor", {
                          ...form.psychomotor,
                          [`p${i}`]: e.target.value,
                        })
                      }
                    >
                      <option value="">—</option>
                      {RATING_OPTIONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}