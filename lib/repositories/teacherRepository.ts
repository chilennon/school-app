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
    
    // We use a Dexie transaction to ensure the local write and outbox write happen together
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

        // 1. Optimistic local write (UI updates instantly)
        await db.attendance_logs.put({
          ...payload,
          server_updated_at: now,
          client_updated_at: now,
          client_mutation_id: logId,
          deleted_at: null,
        });

        // 2. Add to outbox to be synced when online
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

    

    // 3. Kick the sync worker (fire-and-forget)
    syncNow(db);
  }
};