import { NaijaSchoolDB, OutboxEntry, getCursor, setCursor, META_KEYS } from "../db";
import { supabase } from "../supabaseClient";

const SYNC_TABLES = [
  "classes", "class_subjects", "enrolments", "students", "scores",
  "trait_ratings", "term_records", "attendance_logs", "schools",
  "sessions", "terms", "subjects", "grade_bands",
];

const BATCH_SIZE = 50;

export async function syncNow(db: NaijaSchoolDB) {
  if (!navigator.locks) {
    return await performSync(db);
  }
  return await navigator.locks.request("naijaschool-sync", async () => {
    return await performSync(db);
  });
}

async function performSync(db: NaijaSchoolDB) {
  // Reset stranded in_flight
  const strandedCount = await db.outbox.where("status").equals("in_flight").modify({ status: "pending" });
  if (strandedCount > 0) console.log(`[Sync] Reset ${strandedCount} stranded items to pending`);

  if (!navigator.onLine) {
    console.log("[Sync] Device offline. Skipping.");
    return;
  }

  try {
    await drainOutbox(db);
    await pullAll(db);
    await db.meta.put({ key: META_KEYS.LAST_SYNCED_AT, value: new Date().toISOString() });
    console.log("[Sync] Cycle complete.");
  } catch (error) {
    console.error("[Sync] Fatal error:", error);
  }
}

async function drainOutbox(db: NaijaSchoolDB) {
  const pendingItems = await db.outbox.where("status").equals("pending").sortBy("created_at");
  if (pendingItems.length === 0) return;

  console.log(`[Sync] Draining outbox: ${pendingItems.length} items...`);

  for (let i = 0; i < pendingItems.length; i += BATCH_SIZE) {
    const batch = pendingItems.slice(i, i + BATCH_SIZE);
    const batchIds = batch.map((item) => item.id);

    await db.outbox.where("id").anyOf(batchIds).modify({ status: "in_flight" });

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch("/api/sync-push", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: batch }),
      });

      if (!res.ok) throw new Error(`Push failed: ${res.status}`);

      const { results } = await res.json();

      for (const result of results) {
        const item = batch.find((b) => b.id === result.client_id);
        if (!item) continue;

        if (result.status === "applied") {
          if (item.table_name === "term_result") {
            console.log("[Sync] Reconciling term_result", result.client_id);
            await reconcileTermResult(db, item, result.server_row);
          } else {
            await db.table(item.table_name).put(result.server_row);
          }
          await db.outbox.delete(result.client_id);
        } else if (result.status === "rejected") {
          console.warn("[Sync] Server rejected item:", result.error);
          await db.outbox.update(result.client_id, {
            status: "rejected",
            last_error: result.error,
            rejected_reason: result.error,
          });
        } else {
          await db.outbox.update(result.client_id, {
            status: "pending",
            last_error: result.error,
          });
        }
      }
    } catch (error: any) {
      console.error("[Sync] Batch failed, resetting to pending:", error);
      await db.outbox.where("id").anyOf(batchIds).modify({
        status: "pending",
        last_error: error.message || "Network error",
      });
    }
  }
}

async function reconcileTermResult(db: NaijaSchoolDB, item: OutboxEntry, serverRow: unknown) {
  const p = item.payload as { enrolment_id?: string; term_id?: string };
  const enrolmentId = p.enrolment_id;
  const termId = p.term_id;

  if (!enrolmentId || !termId || !serverRow || typeof serverRow !== "object") {
    console.error("[Sync] Missing data for reconcile", item.id);
    return;
  }

  const sr = serverRow as any;
  const scoresToPut = Array.isArray(sr.scores) ? sr.scores : [];
  const traitsToPut = Array.isArray(sr.trait_ratings) ? sr.trait_ratings : [];
  const recordsToPut = Array.isArray(sr.term_records) ? sr.term_records : [];
  const studentToPut = sr.student && typeof sr.student === "object" ? sr.student : null;

  await db.transaction("rw", [db.scores, db.trait_ratings, db.term_records, db.students], async () => {
    await db.scores.where("[enrolment_id+term_id]").equals([enrolmentId, termId]).delete();
    for (const s of scoresToPut) await db.scores.put(s);

    await db.trait_ratings.where("[enrolment_id+term_id]").equals([enrolmentId, termId]).delete();
    for (const t of traitsToPut) await db.trait_ratings.put(t);

    await db.term_records.where("[enrolment_id+term_id]").equals([enrolmentId, termId]).delete();
    for (const r of recordsToPut) await db.term_records.put(r);

    if (studentToPut) await db.students.put(studentToPut);
  });
}

async function pullAll(db: NaijaSchoolDB) {
  console.log("[Sync] Pulling updates...");
  const cursors: Record<string, string | null> = {};
  for (const table of SYNC_TABLES) cursors[table] = await getCursor(db, table);

  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const res = await fetch("/api/sync-pull", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tables: SYNC_TABLES, cursors }),
    });

    if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
    const { tables: results } = await res.json();

    for (const [tableName, data] of Object.entries(results) as any) {
      if (data.rows.length > 0) {
        await db.table(tableName).bulkPut(data.rows);
        if (data.next_cursor) await setCursor(db, tableName, data.next_cursor);
      }
    }
  } catch (error) {
    console.error("[Sync] Failed to pull:", error);
  }
}

export async function registerBackgroundSync() {
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    try {
      const sw = await navigator.serviceWorker.ready;
      // @ts-ignore
      await sw.sync.register("naijaschool-sync");
    } catch (err) {
      console.error("[Sync] Background sync registration failed:", err);
    }
  }
}