export interface ScoreRow {
  enrolment_id: string;
  term_id: string;
  ca_score: number | null;
  exam_score: number | null;
}

export interface TermRow {
  id: string;
  name: string;
  sequence: number;
}

export interface TermAveragesResult {
  termAverages: Record<string, number>;  // e.g. { First: 78.5, Second: 82.1, Third: 80.3 }
  cumulativeAverage: number | null;
}

export function computeTermAverages(
  scores: ScoreRow[],
  terms: TermRow[],
  enrolmentIds: string[]
): Record<string, TermAveragesResult> {
  const termIdToName: Record<string, string> = {};
  terms.forEach((t) => {
    termIdToName[t.id] = t.name;
  });

  // enrolment_id → term_id → [subject totals]
  const byEnrolment: Record<string, Record<string, number[]>> = {};
  scores.forEach((s) => {
    const ca = s.ca_score != null ? Number(s.ca_score) : null;
    const ex = s.exam_score != null ? Number(s.exam_score) : null;
    if (ca === null && ex === null) return;
    const tt = (ca || 0) + (ex || 0);
    if (!byEnrolment[s.enrolment_id]) byEnrolment[s.enrolment_id] = {};
    if (!byEnrolment[s.enrolment_id][s.term_id]) byEnrolment[s.enrolment_id][s.term_id] = [];
    byEnrolment[s.enrolment_id][s.term_id].push(tt);
  });

  const out: Record<string, TermAveragesResult> = {};

  enrolmentIds.forEach((eid) => {
    const termData = byEnrolment[eid] || {};
    const termAverages: Record<string, number> = {};

    Object.entries(termData).forEach(([termId, totals]) => {
      const name = termIdToName[termId];
      if (!name) return;
      const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
      termAverages[name] = Number(avg.toFixed(2));
    });

    const values = Object.values(termAverages);
    const cumulative =
      values.length > 0
        ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
        : null;

    out[eid] = { termAverages, cumulativeAverage: cumulative };
  });

  return out;
}