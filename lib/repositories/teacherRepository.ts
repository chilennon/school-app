import { NaijaSchoolDB } from "../db";
import { syncNow } from "../sync/worker";

export const teacherRepository = {
  /**
   * Saves attendance locally and queues it for the server.
   */
  saveAttendance: async (
    db: NaijaSchoolDB,
    data: {
      classId: string;
      date: string;
      entries: { enrolmentId: string; status: "present" | "absent" }[];
      schoolId: string;
      userId: string;
    }
  ) => {
    const now = new Date().toISOString();
    
    await db.transaction("rw", db.attendance_logs, db.outbox, async () => {
      for (const entry of data.entries) {
        const logId = crypto.randomUUID();
        
        const payload = {
          id: logId,
          school_id: data.schoolId,
          enrolment_id: entry.enrolmentId,
          date: data.date,
          status: entry.status,
          recorded_by: data.userId,
          recorded_at: now,
        };

        await db.attendance_logs.put({
          ...payload,
          server_updated_at: now,
          client_updated_at: now,
          client_mutation_id: logId,
          deleted_at: null,
        });

        await db.outbox.add({
          id: logId,
          school_id: data.schoolId,
          user_id: data.userId,
          table_name: "attendance_logs",
          match_key: `${entry.enrolmentId}|${data.date}`,
          payload: payload,
          client_updated_at: now,
          created_at: now,
          status: "pending",
          attempts: 0,
          last_error: null,
          rejected_reason: null,
        });
      }
    });

    syncNow(db);
  },

  /**
   * Saves a student's term result locally and queues it for the server.
   */
  saveTermResult: async (
    db: NaijaSchoolDB,
    data: {
      enrolmentId: string;
      termId: string;
      scores: any[];
      traits: any[];
      termRecord: {
        days_opened: number | null;
        days_present: number | null;
        days_absent: number | null;
        class_teacher_comment: string | null;
        head_teacher_comment: string | null; // 🚨 NEW
      };
      status: "draft" | "submitted";
      schoolId: string;
      userId: string;
    }
  ) => {
    const now = new Date().toISOString();
    const outboxId = crypto.randomUUID();
    const matchKey = `${data.enrolmentId}|${data.termId}`;

    await db.transaction(
      "rw",
      [db.scores, db.trait_ratings, db.term_records, db.outbox],
      async () => {
        // 1. Save Scores
        for (const s of data.scores) {
          const existing = await db.scores
            .where("[enrolment_id+class_subject_id+term_id]")
            .equals([data.enrolmentId, s.class_subject_id, data.termId])
            .first();

          await db.scores.put({
            id: existing?.id ?? crypto.randomUUID(),
            school_id: data.schoolId,
            enrolment_id: data.enrolmentId,
            class_subject_id: s.class_subject_id,
            term_id: data.termId,
            ca_score: s.ca_score,
            exam_score: s.exam_score,
            sa_score: s.sa_score,
            status: data.status,
            device_id: null,
            device_updated_at: null,
            created_at: existing?.created_at ?? now,
            server_updated_at: now,
            client_updated_at: now,
            client_mutation_id: outboxId,
            deleted_at: null,
          });
        }

        // 2. Save Traits
        for (const t of data.traits) {
          const existing = await db.trait_ratings
            .where("[enrolment_id+term_id+trait_domain+trait_key]")
            .equals([data.enrolmentId, data.termId, t.trait_domain, t.trait_key])
            .first();

          await db.trait_ratings.put({
            id: existing?.id ?? crypto.randomUUID(),
            school_id: data.schoolId,
            enrolment_id: data.enrolmentId,
            term_id: data.termId,
            trait_key: t.trait_key,
            trait_domain: t.trait_domain,
            rating: t.rating,
            server_updated_at: now,
            client_updated_at: now,
            client_mutation_id: outboxId,
            deleted_at: null,
          });
        }

        // 3. Save Term Record
        const existingTr = await db.term_records
          .where("[enrolment_id+term_id]")
          .equals([data.enrolmentId, data.termId])
          .first();

        await db.term_records.put({
          id: existingTr?.id ?? crypto.randomUUID(),
          school_id: data.schoolId,
          enrolment_id: data.enrolmentId,
          term_id: data.termId,
          days_opened: data.termRecord.days_opened ?? null,
          days_present: data.termRecord.days_present ?? null,
          days_absent: data.termRecord.days_absent ?? null,
          class_teacher_comment: data.termRecord.class_teacher_comment ?? null,
          // 🚨 FIX: Use new value if provided, else preserve existing
          head_teacher_comment:
            data.termRecord.head_teacher_comment !== undefined
              ? data.termRecord.head_teacher_comment
              : existingTr?.head_teacher_comment ?? null,
          approved_by: existingTr?.approved_by ?? null,
          approved_at: existingTr?.approved_at ?? null,
          release_override: existingTr?.release_override ?? null,
          override_by: existingTr?.override_by ?? null,
          status: data.status,
          server_updated_at: now,
          client_updated_at: now,
          client_mutation_id: outboxId,
          deleted_at: null,
        });

        // 4. Add to Outbox
        await db.outbox.add({
          id: outboxId,
          school_id: data.schoolId,
          user_id: data.userId,
          table_name: "term_result",
          match_key: matchKey,
          payload: {
            enrolment_id: data.enrolmentId,
            term_id: data.termId,
            scores: data.scores,
            traits: data.traits,
            term_record: {
              ...data.termRecord,
              status: data.status,
            },
          },
          client_updated_at: now,
          created_at: now,
          status: "pending",
          attempts: 0,
          last_error: null,
          rejected_reason: null,
        });
      }
    );

    syncNow(db);
  },
};