import { supabase } from "@/lib/supabaseClient";
import { computeTermAverages } from "@/lib/termAverages";
import { computePositions } from "./computePositions";
import { EMPTY_AFFECTIVE, EMPTY_PSYCHOMOTOR } from "./constants";
import type { ClassInfo, ClassStatus, StudentInfo } from "./types";

export interface ClassRosterResult {
  students: StudentInfo[];
  subjectMap: Record<string, string>;
  classStatus: ClassStatus;
}

/**
 * Fetches everything needed to render a class roster for one term:
 * subjects, enrolments, scores, traits, term records, cumulative averages.
 * Pure data function — no React state, no side effects.
 */
export async function fetchClassRoster(
  cls: ClassInfo,
  termId: string,
): Promise<ClassRosterResult> {
  const { data: classSubjects, error: csErr } = await supabase
    .from("class_subjects")
    .select(`id, subject:subjects (id, name, display_order)`)
    .eq("class_id", cls.id)
    .eq("session_id", cls.session_id);

  if (csErr) console.error("class_subjects fetch failed:", csErr);

  const subjMap: Record<string, string> = {};
  const subjectOrder: {
    name: string;
    order: number;
    class_subject_id: string;
  }[] = [];

  (classSubjects || []).forEach((row: any) => {
    const name = row.subject?.name;
    if (name) {
      subjMap[name.toLowerCase()] = row.id;
      subjectOrder.push({
        name,
        order: row.subject.display_order ?? 0,
        class_subject_id: row.id,
      });
    }
  });
  subjectOrder.sort((a, b) => a.order - b.order);

  const { data: enrolmentRows, error: enrErr } = await supabase
    .from("enrolments")
    .select(`id, student:students (id, name, reg_no, gender, age, assessment)`)
    .eq("class_id", cls.id)
    .eq("session_id", cls.session_id)
    .eq("status", "active");

  if (enrErr) {
    console.error("enrolments fetch failed:", enrErr);
    return { students: [], subjectMap: subjMap, classStatus: "draft" };
  }

  const enrolmentList = (enrolmentRows || [])
    .map((r: any) => ({ enrolment_id: r.id, ...r.student }))
    .filter((s: any) => s && s.id);

  const enrolmentIds = enrolmentList.map((s: any) => s.enrolment_id);

  const scoresByEnrolment: Record<string, any[]> = {};
  const traitsByEnrolment: Record<string, any[]> = {};
  const recordsByEnrolment: Record<string, any> = {};

  if (enrolmentIds.length > 0) {
    const [scoreRes, traitRes, recordRes] = await Promise.all([
      supabase
        .from("scores")
        .select("*")
        .in("enrolment_id", enrolmentIds)
        .eq("term_id", termId),
      supabase
        .from("trait_ratings")
        .select("*")
        .in("enrolment_id", enrolmentIds)
        .eq("term_id", termId),
      supabase
        .from("term_records")
        .select("*")
        .in("enrolment_id", enrolmentIds)
        .eq("term_id", termId),
    ]);

    if (scoreRes.error) console.error("scores fetch failed:", scoreRes.error);
    if (traitRes.error) console.error("traits fetch failed:", traitRes.error);
    if (recordRes.error) console.error("records fetch failed:", recordRes.error);

    (scoreRes.data || []).forEach((row: any) => {
      if (!scoresByEnrolment[row.enrolment_id])
        scoresByEnrolment[row.enrolment_id] = [];
      scoresByEnrolment[row.enrolment_id].push(row);
    });

    (traitRes.data || []).forEach((row: any) => {
      if (!traitsByEnrolment[row.enrolment_id])
        traitsByEnrolment[row.enrolment_id] = [];
      traitsByEnrolment[row.enrolment_id].push(row);
    });

    (recordRes.data || []).forEach((row: any) => {
      recordsByEnrolment[row.enrolment_id] = row;
    });
  }

  let termAveragesByEnrolment: Record<
    string,
    { termAverages: Record<string, number>; cumulativeAverage: number | null }
  > = {};

  if (enrolmentIds.length > 0 && cls.session_id) {
    const [termsRes, allScoresRes] = await Promise.all([
      supabase
        .from("terms")
        .select("id, name, sequence")
        .eq("session_id", cls.session_id)
        .order("sequence"),
      supabase
        .from("scores")
        .select("enrolment_id, term_id, ca_score, exam_score")
        .in("enrolment_id", enrolmentIds),
    ]);

    if (termsRes.data && allScoresRes.data) {
      termAveragesByEnrolment = computeTermAverages(
        allScoresRes.data as any,
        termsRes.data as any,
        enrolmentIds,
      );
    }
  }

  const statusSet = new Set<string>();
  enrolmentList.forEach((s: any) => {
    const rec = recordsByEnrolment[s.enrolment_id];
    statusSet.add(rec?.status || "draft");
  });

  let derivedStatus: ClassStatus = "draft";
  if (statusSet.size === 1) {
    derivedStatus = Array.from(statusSet)[0] as ClassStatus;
  } else if (statusSet.size > 1) {
    derivedStatus = "mixed";
  }

  const studentsBuilt: StudentInfo[] = enrolmentList.map((s: any) => {
    const scoreRows = scoresByEnrolment[s.enrolment_id] || [];
    const scoreBySubjectId: Record<string, any> = {};
    scoreRows.forEach((r) => {
      scoreBySubjectId[r.class_subject_id] = r;
    });

    const subjects = subjectOrder.map((so, idx) => {
      const row = scoreBySubjectId[so.class_subject_id];
      return {
        id: idx,
        sub: so.name,
        ca: row?.ca_score != null ? String(row.ca_score) : "",
        exam: row?.exam_score != null ? String(row.exam_score) : "",
        sa: row?.sa_score != null ? String(row.sa_score) : "",
      };
    });

    const affective: Record<string, string> = { ...EMPTY_AFFECTIVE };
    const psychomotor: Record<string, string> = { ...EMPTY_PSYCHOMOTOR };

    (traitsByEnrolment[s.enrolment_id] || []).forEach((t: any) => {
      if (t.trait_domain === "affective" && t.trait_key in affective) {
        affective[t.trait_key] = t.rating != null ? String(t.rating) : "";
      } else if (t.trait_domain === "psychomotor" && t.trait_key in psychomotor) {
        psychomotor[t.trait_key] = t.rating != null ? String(t.rating) : "";
      }
    });

    const record = recordsByEnrolment[s.enrolment_id];

    return {
      id: s.id,
      name: s.name,
      reg_no: s.reg_no,
      gender: s.gender || "",
      age: s.age || "",
      enrolment_id: s.enrolment_id,
      assessment: {
        ...(s.assessment || {}),
        subjects,
        affective,
        psychomotor,
        daysOpened:
          record?.days_opened != null ? String(record.days_opened) : "",
        daysPresent:
          record?.days_present != null ? String(record.days_present) : "",
        daysAbsent:
          record?.days_absent != null ? String(record.days_absent) : "",
        teacherRemark: record?.class_teacher_comment || "",
        headRemark: record?.head_teacher_comment || "",
        termAverages:
          termAveragesByEnrolment[s.enrolment_id]?.termAverages || {},
        cumulativeAverage:
          termAveragesByEnrolment[s.enrolment_id]?.cumulativeAverage ?? null,
        status: record?.status || "draft",
      },
    };
  });

  const positionsByStudent = computePositions(studentsBuilt);
  studentsBuilt.forEach((st: any) => {
    st.assessment = {
      ...st.assessment,
      positions: positionsByStudent[st.id],
    };
  });

  return {
    students: studentsBuilt,
    subjectMap: subjMap,
    classStatus: derivedStatus,
  };
}