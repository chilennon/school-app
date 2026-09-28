"use client";

import type { Summary } from "../_lib/types";

export function SummaryStrip({
  summary,
  studentPosition,
  classSize,
}: {
  summary: Summary;
  studentPosition: number | null;
  classSize: number | null;
}) {
  return (
    <div className="summary-strip">
      <div className="stat">
        <span className="sl">Subjects</span>
        <span className="sv">{summary.count}</span>
      </div>
      <div className="stat">
        <span className="sl">Term Avg</span>
        <span className="sv">{summary.termAvg}</span>
      </div>
      <div className="stat">
        <span className="sl">Final Avg</span>
        <span className="sv">{summary.finalAvg}</span>
      </div>
      <div className="stat">
        <span className="sl">Position</span>
        <span className="sv">
          {studentPosition ?? "—"} / {classSize ?? "—"}
        </span>
      </div>
      <div className="stat">
        <span className="sl">Highest</span>
        <span className="sv pass">{summary.highest}</span>
      </div>
      <div className="stat">
        <span className="sl">Lowest</span>
        <span className="sv fail">{summary.lowest}</span>
      </div>
      <div className="stat">
        <span className="sl">Final Grade</span>
        <span className="sv">{summary.finalGrade}</span>
      </div>
    </div>
  );
}