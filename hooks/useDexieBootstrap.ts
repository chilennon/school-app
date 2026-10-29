import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { NaijaSchoolDB, openDb, wipeDb, META_KEYS } from "@/lib/db";
import { syncNow, registerBackgroundSync } from "@/lib/sync/worker";

export function useDexieBootstrap() {
  const [db, setDb] = useState<NaijaSchoolDB | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        // 1. Get current user session
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        
        if (authError || !session) {
          if (isMounted) setError("No active session found.");
          return;
        }

        const schoolId = session.user.app_metadata?.school_id;
        const userId = session.user.id;

        if (!schoolId) {
          if (isMounted) setError("Missing school context in session.");
          return;
        }

        // 2. Open the Dexie database for this specific user
        const localDb = await openDb(schoolId, userId);

        // 3. Check if this is a fresh installation
        const installedAt = await localDb.meta.get(META_KEYS.INSTALLED_AT);

        if (!installedAt) {
          console.log("[Bootstrap] Fresh install detected. Pulling entire database...");
          // Mark as installed to prevent infinite loops if sync fails
          await localDb.meta.put({ key: META_KEYS.INSTALLED_AT, value: new Date().toISOString() });
        }

        if (isMounted) setDb(localDb);

        // 4. Run the initial sync (this pulls all data if it's a fresh install)
        // We don't await this completely so the UI can render, but we do want to know when it's done
        syncNow(localDb);

        if (isMounted) setIsReady(true);

        // 5. Register background sync worker
        await registerBackgroundSync();

        // 6. Add event listener for when internet comes back
        const handleOnline = () => {
          console.log("[Bootstrap] Device is back online. Triggering sync...");
          syncNow(localDb);
        };
        window.addEventListener("online", handleOnline);

        // Cleanup
        return () => {
          window.removeEventListener("online", handleOnline);
        };

      } catch (err: any) {
        console.error("[Bootstrap] Failed to initialize Dexie:", err);
        if (isMounted) setError(err.message || "Failed to initialize local database.");
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  return { db, isReady, error };
}