"use client";

import { supabase } from "@/lib/supabaseClient";

interface SaveParams {
  schoolId: string | null;
  subjectMap: Record<string, string>;
  termId: string | null;
  enrolmentId: string | undefined;
  studentId: string | undefined;
  updatedStudent: any;
  status: "draft" | "completed";
}

/**
 * Writes one student's result to Supabase: scores, traits, term record,
 * and the student row. Throws on any failure so callers can show a toast.
 * Returns the saved student object for local state reconciliation.
 */
export async function saveResultToSupabase(params: SaveParams) {
  const {
    schoolId,
    subjectMap,
    termId,
    enrolmentId,
    studentId,
    updatedStudent,
    status,
  } = params;

  if (!studentId || !enrolmentId || !termId || !schoolId) {
    console.error("Missing ids to save", {
      studentId,
      enrolmentId,
      termId,
      schoolId,
    });
    throw new Error("Missing required ids. Try reloading the page.");
  }

  const { data: freshRecord } = await supabase
    .from("term_records")
    .select("status")
    .eq("enrolment_id", enrolmentId)
    .eq("term_id", termId)
    .maybeSingle();

  const liveStatus = freshRecord?.status ?? "draft";
  if (liveStatus !== "draft") {
    throw new Error(
      `This student's result has been ${liveStatus}. Your changes were not saved. ` +
        `Reload the page to see the current status.`,
    );
  }

  const asm = updatedStudent?.assessment || {};

  const incomingSubjects: {
    sub: string;
    ca: string;
    exam: string;
    sa: string;
  }[] = asm.subjects || [];

  const scoreUpserts = incomingSubjects
    .map((s) => {
      const key = (s.sub || "").trim().toLowerCase();
      const classSubjectId = subjectMap[key];
      if (!classSubjectId) return null;
      return {
        school_id: schoolId,
        enrolment_id: enrolmentId,
        class_subject_id: classSubjectId,
        term_id: termId,
        ca_score: s.ca !== "" ? Number(s.ca) : null,
        exam_score: s.exam !== "" ? Number(s.exam) : null,
        sa_score: s.sa !== "" ? Number(s.sa) : null,
        status,
        server_updated_at: new Date().toISOString(),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (scoreUpserts.length > 0) {
    const { error } = await supabase
      .from("scores")
      .upsert(scoreUpserts, {
        onConflict: "enrolment_id,class_subject_id,term_id",
      });
    if (error) throw new Error(`Failed to save scores: ${error.message}`);
  }

  await supabase
    .from("trait_ratings")
    .delete()
    .eq("enrolment_id", enrolmentId)
    .eq("term_id", termId);

  const traitRows: any[] = [];
  Object.entries(asm.affective || {}).forEach(([k, v]) => {
    if (v !== "" && v != null) {
      traitRows.push({
        school_id: schoolId,
        enrolment_id: enrolmentId,
        term_id: termId,
        trait_key: k,
        trait_domain: "affective",
        rating: Number(v),
        server_updated_at: new Date().toISOString(),
      });
    }
  });
  Object.entries(asm.psychomotor || {}).forEach(([k, v]) => {
    if (v !== "" && v != null) {
      traitRows.push({
        school_id: schoolId,
        enrolment_id: enrolmentId,
        term_id: termId,
        trait_key: k,
        trait_domain: "psychomotor",
        rating: Number(v),
        server_updated_at: new Date().toISOString(),
      });
    }
  });

  if (traitRows.length > 0) {
    const { error } = await supabase.from("trait_ratings").insert(traitRows);
    if (error) throw new Error(`Failed to save traits: ${error.message}`);
  }

  const { error: recordError } = await supabase.from("term_records").upsert(
    [
      {
        school_id: schoolId,
        enrolment_id: enrolmentId,
        term_id: termId,
        days_opened:
          asm.daysOpened !== "" && asm.daysOpened != null
            ? Number(asm.daysOpened)
            : null,
        days_present:
          asm.daysPresent !== "" && asm.daysPresent != null
            ? Number(asm.daysPresent)
            : null,
        days_absent:
          asm.daysAbsent !== "" && asm.daysAbsent != null
            ? Number(asm.daysAbsent)
            : null,
        class_teacher_comment: asm.teacherRemark || null,
        head_teacher_comment: asm.headRemark || null,
        server_updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "enrolment_id,term_id" },
  );

  if (recordError)
    throw new Error(
      `Failed to save attendance/remarks: ${recordError.message}`,
    );

  const {
    subjects: _s,
    affective: _a,
    psychomotor: _p,
    daysOpened: _do,
    daysPresent: _dp,
    daysAbsent: _da,
    teacherRemark: _tr,
    headRemark: _hr,
    positions: _pos,
    ...leftoverAssessment
  } = asm;

  const updatedAssessment = { ...leftoverAssessment, status };

  const { data, error } = await supabase
    .from("students")
    .update({
      name: updatedStudent.name,
      gender: updatedStudent.gender || null,
      age: updatedStudent.age || null,
      assessment: updatedAssessment,
    })
    .eq("id", studentId)
    .select("*")
    .single();

  if (error)
    throw new Error(`Failed to save student record: ${error.message}`);

  const savedStudent = {
    ...(data || updatedStudent),
    assessment: {
      ...updatedAssessment,
      subjects: incomingSubjects,
      affective: asm.affective,
      psychomotor: asm.psychomotor,
      daysOpened: asm.daysOpened,
      daysPresent: asm.daysPresent,
      daysAbsent: asm.daysAbsent,
      teacherRemark: asm.teacherRemark,
      headRemark: asm.headRemark,
      positions: asm.positions,
      termAverages: asm.termAverages,
      cumulativeAverage: asm.cumulativeAverage,
    },
  };

  return savedStudent;
}