import type {
  GradeResult,
  ProcessedSubject,
  Subject,
  Summary,
} from "./types";

/**
 * Pure calculation: turn raw subject rows into processed rows for display.
 */
export function collectSubjects(
  subjects: Subject[],
  grade: (score: number | null) => GradeResult,
): ProcessedSubject[] {
  return subjects
    .map((s) => {
      const ca = s.ca !== "" ? parseFloat(s.ca) : null;
      const ex = s.exam !== "" ? parseFloat(s.exam) : null;
      const sa = s.sa !== "" ? parseFloat(s.sa) : null;

      if (!s.sub && ca === null && ex === null) return null;

      const tt = ca !== null || ex !== null ? (ca || 0) + (ex || 0) : null;
      const { g, remark } = tt !== null ? grade(tt) : { g: "—", remark: "—" };

      return {
        subject: s.sub || "(Unnamed)",
        ca: ca !== null ? ca : "—",
        exam: ex !== null ? ex : "—",
        tt: tt !== null ? tt : "—",
        sessAvg: sa !== null ? sa : "—",
        g,
        remark,
      } as ProcessedSubject;
    })
    .filter((item): item is ProcessedSubject => item !== null);
}

/**
 * Pure calculation: aggregate stats from processed subjects.
 */
export function calculateSummary(
  processed: ProcessedSubject[],
  grade: (score: number | null) => GradeResult,
): Summary {
  const tts = processed
    .map((s) => s.tt)
    .filter((tt): tt is number => typeof tt === "number");
  const sas = processed
    .map((s) => s.sessAvg)
    .filter((sa): sa is number => typeof sa === "number");

  const n = tts.length;
  if (n === 0) {
    return {
      count: 0,
      termAvg: "—",
      finalAvg: "—",
      highest: "—",
      lowest: "—",
      finalGrade: "—",
    };
  }

  const termAvg = tts.reduce((a, b) => a + b, 0) / n;
  const finalAvg = sas.length
    ? sas.reduce((a, b) => a + b, 0) / sas.length
    : termAvg;
  const { g: finalGrade } = grade(finalAvg);

  return {
    count: n,
    termAvg: termAvg.toFixed(1) + "%",
    finalAvg: finalAvg.toFixed(1) + "%",
    highest: Math.max(...tts),
    lowest: Math.min(...tts),
    finalGrade,
  };
}