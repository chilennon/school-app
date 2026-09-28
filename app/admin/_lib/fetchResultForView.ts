import { supabase } from "@/lib/supabaseClient";
import { computeTermAverages } from "@/lib/termAverages";

export async function fetchResultForView(
  enrolmentId: string,
  classId: string,
  termId: string,
  sessionId: string,
): Promise<{ student: any; classRoom: any } | null> {
  const { data: enrol } = await supabase
    .from("enrolments")
    .select(`id, student:students (id, name, reg_no, gender, age, assessment)`)
    .eq("id", enrolmentId)
    .single();

  if (!enrol) return null;

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, session, session_id")
    .eq("id", classId)
    .single();

  if (!cls) return null;

  const { data: termRow } = await supabase
    .from("terms")
    .select("name")
    .eq("id", termId)
    .maybeSingle();

  const termName = termRow?.name ? `${termRow.name} Term` : "";

  const { data: csubs } = await supabase
    .from("class_subjects")
    .select(`id, subject:subjects (id, name, display_order)`)
    .eq("class_id", classId)
    .eq("session_id", sessionId);

  const [scoreRes, traitRes, recordRes] = await Promise.all([
    supabase
      .from("scores")
      .select("*")
      .eq("enrolment_id", enrolmentId)
      .eq("term_id", termId),
    supabase
      .from("trait_ratings")
      .select("*")
      .eq("enrolment_id", enrolmentId)
      .eq("term_id", termId),
    supabase
      .from("term_records")
      .select("*")
      .eq("enrolment_id", enrolmentId)
      .eq("term_id", termId)
      .maybeSingle(),
  ]);

  const [sessionTermsRes, allScoresRes] = await Promise.all([
    supabase
      .from("terms")
      .select("id, name, sequence")
      .eq("session_id", sessionId)
      .order("sequence"),
    supabase
      .from("scores")
      .select("enrolment_id, term_id, ca_score, exam_score")
      .eq("enrolment_id", enrolmentId),
  ]);

  let termAvgs: {
    termAverages: Record<string, number>;
    cumulativeAverage: number | null;
  } = { termAverages: {}, cumulativeAverage: null };

  if (sessionTermsRes.data && allScoresRes.data) {
    const result = computeTermAverages(
      allScoresRes.data as any,
      sessionTermsRes.data as any,
      [enrolmentId],
    );
    termAvgs = result[enrolmentId] || termAvgs;
  }

  const subjectOrder = (csubs || [])
    .map((cs: any) => ({
      name: cs.subject?.name,
      order: cs.subject?.display_order ?? 0,
      class_subject_id: cs.id,
    }))
    .filter((s: any) => s.name)
    .sort((a: any, b: any) => a.order - b.order);

  const scoreByCsId: Record<string, any> = {};
  (scoreRes.data || []).forEach((r: any) => {
    scoreByCsId[r.class_subject_id] = r;
  });

  const subjects = subjectOrder.map((so: any, idx: number) => {
    const row = scoreByCsId[so.class_subject_id];
    return {
      id: idx,
      sub: so.name,
      ca: row?.ca_score != null ? String(row.ca_score) : "",
      exam: row?.exam_score != null ? String(row.exam_score) : "",
      sa: row?.sa_score != null ? String(row.sa_score) : "",
    };
  });

  const affective: Record<string, string> = {
    a0: "", a1: "", a2: "", a3: "", a4: "",
    a5: "", a6: "", a7: "", a8: "", a9: "",
  };
  const psychomotor: Record<string, string> = {
    p0: "", p1: "", p2: "", p3: "", p4: "", p5: "",
  };

  (traitRes.data || []).forEach((t: any) => {
    if (t.trait_domain === "affective" && t.trait_key in affective) {
      affective[t.trait_key] = t.rating != null ? String(t.rating) : "";
    } else if (t.trait_domain === "psychomotor" && t.trait_key in psychomotor) {
      psychomotor[t.trait_key] = t.rating != null ? String(t.rating) : "";
    }
  });

  const { data: allEnrols } = await supabase
    .from("enrolments")
    .select("id")
    .eq("class_id", classId)
    .eq("session_id", sessionId)
    .eq("status", "active");

  const allEnrolmentIds = (allEnrols || []).map((e: any) => e.id);

  let positions: any = undefined;
  if (allEnrolmentIds.length > 0) {
    const { data: allScores } = await supabase
      .from("scores")
      .select("enrolment_id, class_subject_id, ca_score, exam_score")
      .in("enrolment_id", allEnrolmentIds)
      .eq("term_id", termId);

    const perEnrolment: Record<string, Record<string, number>> = {};
    (allScores || []).forEach((s: any) => {
      const ca = s.ca_score != null ? Number(s.ca_score) : null;
      const ex = s.exam_score != null ? Number(s.exam_score) : null;
      if (ca === null && ex === null) return;
      const tt = (ca || 0) + (ex || 0);
      if (!perEnrolment[s.enrolment_id]) perEnrolment[s.enrolment_id] = {};
      perEnrolment[s.enrolment_id][s.class_subject_id] = tt;
    });

    const csIdToName: Record<string, string> = {};
    subjectOrder.forEach((so: any) => {
      csIdToName[so.class_subject_id] = so.name;
    });

    const subjectAllTotals: Record<string, number[]> = {};
    Object.values(perEnrolment).forEach((subMap) => {
      Object.entries(subMap).forEach(([csId, tt]) => {
        const name = csIdToName[csId];
        if (!name) return;
        if (!subjectAllTotals[name]) subjectAllTotals[name] = [];
        subjectAllTotals[name].push(tt);
      });
    });

    const sortedBySubject: Record<string, number[]> = {};
    Object.entries(subjectAllTotals).forEach(([name, totals]) => {
      sortedBySubject[name] = [...totals].sort((a, b) => b - a);
    });

    const thisEnrolTotals = perEnrolment[enrolmentId] || {};
    const studentTotal = Object.values(thisEnrolTotals).reduce(
      (a, b) => a + b,
      0,
    );
    const subjCount = Object.keys(thisEnrolTotals).length;
    const avg = subjCount > 0 ? studentTotal / subjCount : 0;

    const allTotals = Object.values(perEnrolment).map((subMap) =>
      Object.values(subMap).reduce((a, b) => a + b, 0),
    );
    const sortedTotals = [...allTotals].sort((a, b) => b - a);
    const position = sortedTotals.indexOf(studentTotal) + 1;

    const subjectStats: Record<string, any> = {};
    Object.entries(thisEnrolTotals).forEach(([csId, tt]) => {
      const name = csIdToName[csId];
      if (!name) return;
      const stats = sortedBySubject[name];
      subjectStats[name] = {
        position: stats.indexOf(tt) + 1,
        highest: stats[0],
        lowest: stats[stats.length - 1],
        average: stats.reduce((a, b) => a + b, 0) / stats.length,
      };
    });

    positions = {
      position,
      classSize: allTotals.length,
      total: studentTotal,
      average: avg,
      subjects: subjectStats,
    };
  }

  const record = recordRes.data;
  const studentData = (enrol as any).student;

  return {
    student: {
      id: studentData.id,
      reg_no: studentData.reg_no,
      name: studentData.name,
      gender: studentData.gender || "",
      age: studentData.age || "",
      enrolment_id: enrolmentId,
      assessment: {
        schoolName: "House Of Angels School",
        schoolAddress: "10, Albert Okolo St, Jakande Estate, Lagos, Nigeria",
        schoolEmail: "",
        schoolPhone: "08033848328",
        daysOpened:
          record?.days_opened != null ? String(record.days_opened) : "",
        daysPresent:
          record?.days_present != null ? String(record.days_present) : "",
        daysAbsent:
          record?.days_absent != null ? String(record.days_absent) : "",
        subjects,
        affective,
        psychomotor,
        teacherName: "",
        headTeacherName: "",
        teacherRemark: record?.class_teacher_comment || "",
        headRemark: record?.head_teacher_comment || "",
        nextTerm: "",
        promotion: "",
        classAvg: "",
        positions,
        termAverages: termAvgs.termAverages,
        cumulativeAverage: termAvgs.cumulativeAverage,
        status: record?.status || "draft",
      },
    },
    classRoom: {
      id: cls.id,
      name: cls.name,
      session: cls.session,
      term: termName,
      assignedTeacherId: null,
      studentIds: [],
    },
  };
}