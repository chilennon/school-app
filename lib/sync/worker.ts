import { NaijaSchoolDB, OutboxEntry, getCursor, setCursor, META_KEYS } from "../db";
import { supabase } from "../supabaseClient";

// The tables that need to be synced (Keep in sync with your sync-pull API)
const SYNC_TABLES = [
  "classes",
  "class_subjects",
  "enrolments",
  "students",
  "scores",
  "trait_ratings",
  "term_records",
  "attendance_logs",
  "schools",
  "sessions",
  "terms",
  "subjects",
  "grade_bands",
];

// Max items to push in one go to prevent network timeouts
const BATCH_SIZE = 50;

/**
 * The main sync orchestrator.
 * Acquires a lock so multiple tabs or background workers don't conflict.
 */
export async function syncNow(db: NaijaSchoolDB) {
  // If Web Locks aren't supported, we just run it. 
  // (Most modern mobile browsers support this).
  if (!navigator.locks) {
    return await performSync(db);
  }

  return await navigator.locks.request("naijaschool-sync", async () => {
    return await performSync(db);
  });
}

async function performSync(db: NaijaSchoolDB) {
  if (!navigator.onLine) {
    console.log("[Sync] Device is offline. Skipping sync.");
    return;
  }

  try {
    // 🚨 FIX: Reset any items that got stuck in "in_flight" 
    // (e.g., if the page was refreshed or network died mid-sync)
    await db.outbox.where("status").equals("in_flight").modify({ status: "pending" });

    // 1. Push local changes to server
    await drainOutbox(db);

    // 2. Pull server changes to local
    await pullAll(db);

    // 3. Update last sync time
    await db.meta.put({ key: META_KEYS.LAST_SYNCED_AT, value: new Date().toISOString() });
    console.log("[Sync] Sync cycle complete.");
  } catch (error) {
    console.error("[Sync] Fatal error during sync cycle:", error);
  }
}

/**
 * Takes items from the local Outbox and pushes them to the server.
 */
async function drainOutbox(db: NaijaSchoolDB) {
  // Get pending items, oldest first
  const pendingItems = await db.outbox
    .where("status")
    .equals("pending")
    .sortBy("created_at");

  if (pendingItems.length === 0) return;

  console.log(`[Sync] Draining outbox: ${pendingItems.length} items to push...`);

  // Process in batches
  for (let i = 0; i < pendingItems.length; i += BATCH_SIZE) {
    const batch = pendingItems.slice(i, i + BATCH_SIZE);
    const batchIds = batch.map((item) => item.id);

    // Mark as in-flight
    await db.outbox.where("id").anyOf(batchIds).modify({ status: "in_flight" });

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      const res = await fetch("/api/sync-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: batch }),
      });

      if (!res.ok) {
        throw new Error(`Push failed with status ${res.status}`);
      }

      const { results } = await res.json();

      // Process results item by item
      for (const result of results) {
        if (result.status === "applied") {
          const item = batch.find(b => b.id === result.client_id);
          if (!item) continue;

          // 🚨 FIX: Handle the synthetic term_result type
          if (item.table_name === "term_result") {
            await db.outbox.delete(result.client_id);
          } else {
            const table = db.table(item.table_name);
            await table.put(result.server_row);
            await db.outbox.delete(result.client_id);
          }
        } else if (result.status === "rejected") {
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
      console.error("[Sync] Outbox batch failed:", error);
      // Put items back to pending so they try again next time
      await db.outbox.where("id").anyOf(batchIds).modify({ 
        status: "pending",
        last_error: error.message || "Network error" 
      });
    }
  }
}

/**
 * Pulls changes from the server and updates the local Dexie database.
 */
async function pullAll(db: NaijaSchoolDB) {
  console.log("[Sync] Checking for remote updates...");
  
  // 1. Build cursors object
  const cursors: Record<string, string | null> = {};
  for (const table of SYNC_TABLES) {
    cursors[table] = await getCursor(db, table);
  }

  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    
    const res = await fetch("/api/sync-pull", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tables: SYNC_TABLES, cursors }),
    });

    if (!res.ok) {
      throw new Error(`Pull failed with status ${res.status}`);
    }

    const { tables: results } = await res.json();

    // 2. Write pulled data into Dexie
    for (const [tableName, data] of Object.entries(results) as any) {
      if (data.rows.length > 0) {
        console.log(`[Sync] Pulled ${data.rows.length} new rows for ${tableName}`);
        // bulkPut is like an upsert. It overwrites existing, inserts new.
        await db.table(tableName).bulkPut(data.rows);
        
        // Update cursor
        if (data.next_cursor) {
          await setCursor(db, tableName, data.next_cursor);
        }
      }
    }
  } catch (error) {
    console.error("[Sync] Failed to pull remote updates:", error);
  }
}

/**
 * Registers the background sync (if supported).
 * Call this on app init.
 */
export async function registerBackgroundSync() {
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    try {
      const sw = await navigator.serviceWorker.ready;
      // @ts-ignore
      await sw.sync.register("naijaschool-sync");
      console.log("[Sync] Background sync registered");
    } catch (err) {
      console.error("[Sync] Background sync registration failed:", err);
    }
  }
}