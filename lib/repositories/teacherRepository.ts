import { NaijaSchoolDB, OutboxEntry } from "../db";
import { syncNow } from "../sync/worker";

async function upsertOutbox(
  db: NaijaSchoolDB,
  entry: Omit<
    OutboxEntry,
    "id" | "status" | "attempts" | "last_error" | "rejected_reason"
  >,
): Promise<string> {
  const existing = await db.outbox
    .where("[table_name+match_key]")
    .equals([entry.table_name, entry.match_key])
    .filter((o) => o.status !== "in_flight")
    .first();

  if (existing) {
    await db.outbox.update(existing.id, {
      payload: entry.payload,
      client_updated_at: entry.client_updated_at,
      status: "pending",
      attempts: 0,
      last_error: null,
      rejected_reason: null,
    });
    return existing.id;
  }

  const id = crypto.randomUUID();
  await db.outbox.add({
    ...entry,
    id,
    status: "pending",
    attempts: 0,
    last_error: null,
    rejected_reason: null,
  });
  return id;
}

export const teacherRepository = {
  saveAttendance: async (
    db: NaijaSchoolDB,
    data: {
      classId: string;
      date: string;
      entries: { enrolmentId: string; status: "present" | "absent" }[];
      schoolId: string;
      userId: string;
    },
  ) => {
    const now = new Date().toISOString();

    await db.transaction("rw", db.attendance_logs, db.outbox, async () => {
      for (const entry of data.entries) {
        const rowId = crypto.randomUUID();

        const payload = {
          id: rowId,
          school_id: data.schoolId,
          enrolment_id: entry.enrolmentId,
          date: data.date,
          status: entry.status,
          recorded_by: data.userId,
          recorded_at: now,
        };

        const outboxId = await upsertOutbox(db, {
          school_id: data.schoolId,
          user_id: data.userId,
          table_name: "attendance_logs",
          match_key: `${entry.enrolmentId}|${data.date}`,
          payload,
          client_updated_at: now,
          created_at: now,
        });

        await db.attendance_logs
          .where("[enrolment_id+date]")
          .equals([entry.enrolmentId, data.date])
          .delete();

        await db.attendance_logs.put({
          ...payload,
          server_updated_at: now,
          client_updated_at: now,
          client_mutation_id: outboxId,
          deleted_at: null,
        });
      }
    });

    syncNow(db);
  },

  saveTermResult: async (
    db: NaijaSchoolDB,
    data: {
      classId: string;
      enrolmentId: string;
      studentId: string;
      termId: string;
      updatedStudent: any;
      status: "draft" | "completed";
      schoolId: string;
      userId: string;
    },
  ) => {
    const now = new Date().toISOString();

    const term = await db.terms.get(data.termId);
    if (!term) throw new Error("Term not found in local cache.");

    const classSubjects = await db.class_subjects
      .where("[class_id+session_id]")
      .equals([data.classId, term.session_id])
      .toArray();

    const subjectMap: Record<string, string> = {};
    for (const cs of classSubjects) {
      const subject = await db.subjects.get(cs.subject_id);
      if (subject) {
        subjectMap[subject.name.trim().toLowerCase()] = cs.id;
      }
    }

    // Map "completed" to "submitted" for DB CHECK constraint
    const serverStatus: "draft" | "submitted" =
      data.status === "completed" ? "submitted" : "draft";

    const asm = data.updatedStudent.assessment || {};

    const scores = (asm.subjects || [])
      .map((s: any) => {
        const key = (s.sub || "").trim().toLowerCase();
        const classSubjectId = subjectMap[key];
        if (!classSubjectId) return null;
        return {
          class_subject_id: classSubjectId,
          ca_score:   s.ca   !== "" && s.ca   != null ? Number(s.ca)   : null,
          exam_score: s.exam !== "" && s.exam != null ? Number(s.exam) : null,
          sa_score:   s.sa   !== "" && s.sa   != null ? Number(s.sa)   : null,
        };
      })
      .filter(Boolean);

    const traits: any[] = [];
    Object.entries(asm.affective || {}).forEach(([k, v]) => {
      if (v !== "" && v != null) traits.push({ trait_key: k, trait_domain: "affective", rating: Number(v) });
    });
    Object.entries(asm.psychomotor || {}).forEach(([k, v]) => {
      if (v !== "" && v != null) traits.push({ trait_key: k, trait_domain: "psychomotor", rating: Number(v) });
    });

    const termRecord = {
      days_opened:  asm.daysOpened  !== "" && asm.daysOpened  != null ? Number(asm.daysOpened)  : null,
      days_present: asm.daysPresent !== "" && asm.daysPresent != null ? Number(asm.daysPresent) : null,
      days_absent:  asm.daysAbsent  !== "" && asm.daysAbsent  != null ? Number(asm.daysAbsent)  : null,
      class_teacher_comment: asm.teacherRemark || null,
      head_teacher_comment:  asm.headRemark    || null,
      status: serverStatus,
    };

    const {
      subjects: _s, affective: _a, psychomotor: _p,
      daysOpened: _do, daysPresent: _dp, daysAbsent: _da,
      teacherRemark: _tr, headRemark: _hr, positions: _pos,
      ...leftover
    } = asm;

    const studentUpdate = {
      name: data.updatedStudent.name,
      gender: data.updatedStudent.gender || null,
      age: data.updatedStudent.age || null,
      assessment: { ...leftover, status: serverStatus },
    };

    const existingRecord = await db.term_records
      .where("[enrolment_id+term_id]")
      .equals([data.enrolmentId, data.termId])
      .first();

    await db.transaction(
      "rw",
      [db.scores, db.trait_ratings, db.term_records, db.students, db.outbox],
      async () => {
        await db.scores.where("[enrolment_id+term_id]").equals([data.enrolmentId, data.termId]).delete();
        for (const s of scores) {
          await db.scores.put({
            id: crypto.randomUUID(), school_id: data.schoolId, enrolment_id: data.enrolmentId,
            class_subject_id: s!.class_subject_id, term_id: data.termId,
            ca_score: s!.ca_score, exam_score: s!.exam_score, sa_score: s!.sa_score,
            status: serverStatus, device_id: null, device_updated_at: null,
            created_at: now, server_updated_at: now, client_updated_at: now,
            client_mutation_id: null, deleted_at: null,
          });
        }

        await db.trait_ratings.where("[enrolment_id+term_id]").equals([data.enrolmentId, data.termId]).delete();
        for (const t of traits) {
          await db.trait_ratings.put({
            id: crypto.randomUUID(), school_id: data.schoolId, enrolment_id: data.enrolmentId,
            term_id: data.termId, trait_key: t.trait_key, trait_domain: t.trait_domain, rating: t.rating,
            server_updated_at: now, client_updated_at: now, client_mutation_id: null, deleted_at: null,
          });
        }

        await db.term_records.put({
          id: existingRecord?.id ?? crypto.randomUUID(),
          school_id: data.schoolId, enrolment_id: data.enrolmentId, term_id: data.termId,
          days_opened: termRecord.days_opened, days_present: termRecord.days_present, days_absent: termRecord.days_absent,
          class_teacher_comment: termRecord.class_teacher_comment, head_teacher_comment: termRecord.head_teacher_comment,
          approved_by: existingRecord?.approved_by ?? null, approved_at: existingRecord?.approved_at ?? null,
          release_override: existingRecord?.release_override ?? null, override_by: existingRecord?.override_by ?? null,
          status: serverStatus, server_updated_at: now, client_updated_at: now, client_mutation_id: null, deleted_at: null,
        });

        const existingStudent = await db.students.get(data.studentId);
        if (!existingStudent) throw new Error("Student not in local cache.");

        await db.students.put({
          ...existingStudent,
          name: studentUpdate.name ?? existingStudent.name,
          gender: studentUpdate.gender,
          age: studentUpdate.age,
          assessment: studentUpdate.assessment as Record<string, unknown>,
          server_updated_at: now, client_updated_at: now, client_mutation_id: null, deleted_at: null,
        });

        const outboxId = await upsertOutbox(db, {
          school_id: data.schoolId, user_id: data.userId, table_name: "term_result",
          match_key: `${data.enrolmentId}|${data.termId}`,
          payload: {
            enrolment_id: data.enrolmentId, term_id: data.termId, student_id: data.studentId,
            scores, traits, term_record: termRecord, student: studentUpdate,
          },
          client_updated_at: now, created_at: now,
        });

        await db.scores.where("[enrolment_id+term_id]").equals([data.enrolmentId, data.termId]).modify({ client_mutation_id: outboxId });
        await db.trait_ratings.where("[enrolment_id+term_id]").equals([data.enrolmentId, data.termId]).modify({ client_mutation_id: outboxId });
        await db.term_records.where("[enrolment_id+term_id]").equals([data.enrolmentId, data.termId]).modify({ client_mutation_id: outboxId });
      },
    );

    syncNow(db);
  },

  /**
   * 🚨 Batch submit all draft results for a class
   */
  submitClassResults: async (
    db: NaijaSchoolDB,
    data: { classId: string; termId: string; schoolId: string; userId: string; sessionId: string }
  ) => {
    const now = new Date().toISOString();
    
    // 🚨 FIX: Use the existing compound index and filter in memory
    const allEnrolments = await db.enrolments
      .where("[class_id+session_id]")
      .equals([data.classId, data.sessionId])
      .toArray();
      
    const enrolments = allEnrolments.filter(e => e.status === "active");

    await db.transaction("rw", [db.term_records, db.scores, db.trait_ratings, db.students, db.outbox], async () => {
      for (const enrol of enrolments) {
        const termRecord = await db.term_records
          .where({ enrolment_id: enrol.id, term_id: data.termId })
          .first();

        // Only submit if it exists and is currently a draft
        if (!termRecord || termRecord.status !== "draft") continue;

        // 2. Update local status to submitted
        await db.term_records.update(termRecord.id, {
          status: "submitted",
          client_updated_at: now,
          server_updated_at: now,
        });

        // 3. Build the payload for the outbox
        const scores = await db.scores.where({ enrolment_id: enrol.id, term_id: data.termId }).toArray();
        const traits = await db.trait_ratings.where({ enrolment_id: enrol.id, term_id: data.termId }).toArray();
        const student = await db.students.get(enrol.student_id);

        if (!student) continue;

        const outboxId = await upsertOutbox(db, {
          school_id: data.schoolId,
          user_id: data.userId,
          table_name: "term_result",
          match_key: `${enrol.id}|${data.termId}`,
          payload: {
            enrolment_id: enrol.id,
            term_id: data.termId,
            student_id: student.id,
            scores: scores.map(s => ({
              class_subject_id: s.class_subject_id,
              ca_score: s.ca_score,
              exam_score: s.exam_score,
              sa_score: s.sa_score,
            })),
            traits: traits.map(t => ({
              trait_key: t.trait_key,
              trait_domain: t.trait_domain,
              rating: t.rating,
            })),
            term_record: { ...termRecord, status: "submitted" },
            student: {
              name: student.name,
              gender: student.gender,
              age: student.age,
              assessment: student.assessment,
            },
          },
          client_updated_at: now,
          created_at: now,
        });

        // Stamp the new outbox ID on the local records
        await db.scores.where({ enrolment_id: enrol.id, term_id: data.termId }).modify({ client_mutation_id: outboxId });
        await db.trait_ratings.where({ enrolment_id: enrol.id, term_id: data.termId }).modify({ client_mutation_id: outboxId });
        await db.term_records.update(termRecord.id, { client_mutation_id: outboxId });
      }
    });

    syncNow(db);
  },
};