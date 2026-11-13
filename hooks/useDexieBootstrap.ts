import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { NaijaSchoolDB, openDb, wipeDb } from "@/lib/db";
import { syncNow, registerBackgroundSync } from "@/lib/sync/worker";

export type BootstrapStatus = "loading" | "syncing" | "ready" | "error";

export function useDexieBootstrap() {
  const [db, setDb] = useState<NaijaSchoolDB | null>(null);
  const [status, setStatus] = useState<BootstrapStatus>("loading");
  const [message, setMessage] = useState("Connecting to your school...");
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    let localDb: NaijaSchoolDB | null = null;

    async function init() {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) {
          if (isMounted.current) { setError("No active session found."); setStatus("error"); }
          return;
        }

        const schoolId = session.user.app_metadata?.school_id;
        const userId = session.user.id;
        if (!schoolId) {
          if (isMounted.current) { setError("Missing school context."); setStatus("error"); }
          return;
        }

        if (isMounted.current) setMessage("Opening local database...");
        localDb = await openDb(schoolId, userId);

        // 1. Fetch current session and term from Supabase
        const { data: currentTerm } = await supabase
          .from("terms")
          .select("id, session_id")
          .eq("school_id", schoolId)
          .eq("is_current", true)
          .maybeSingle();

        if (!currentTerm) {
           if (isMounted.current) { setDb(localDb); setStatus("ready"); }
           return;
        }

        const localSessionId = await localDb.meta.get("ACTIVE_SESSION_ID");
        const localTermId = await localDb.meta.get("ACTIVE_TERM_ID");
        const lastRollover = await localDb.meta.get("last_rollover_at");
        
        // 2. Handle Rollovers
        if (!localSessionId || !localTermId) {
          // Fresh install
          await localDb.meta.put({ key: "ACTIVE_SESSION_ID", value: currentTerm.session_id });
          await localDb.meta.put({ key: "ACTIVE_TERM_ID", value: currentTerm.id });
        } 
        else if (localSessionId.value !== currentTerm.session_id) {
          // New SESSION started (Promotions happened)
          if (isMounted.current) setMessage("A new session has started. Preparing your new classes...");
          await localDb.meta.put({ key: "ACTIVE_SESSION_ID", value: currentTerm.session_id });
          await localDb.meta.put({ key: "ACTIVE_TERM_ID", value: currentTerm.id });
          await localDb.meta.put({ key: "last_rollover_at", value: new Date().toISOString() });
        } 
        else if (localTermId.value !== currentTerm.id) {
          // New TERM started (Same session)
          if (isMounted.current) setMessage("Welcome to the new term. Syncing your registers...");
          await localDb.meta.put({ key: "ACTIVE_TERM_ID", value: currentTerm.id });
        }

        // 3. The 30-Day Archive Cleanup
        if (lastRollover && lastRollover.value) {
          const daysSinceRollover = (Date.now() - new Date(lastRollover.value as string).getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceRollover > 30) {
            if (isMounted.current) setMessage("Optimizing storage... Archiving old records.");
            await new Promise(r => setTimeout(r, 1500)); // Emotional pause
            await wipeDb(localDb);
            localDb = await openDb(schoolId, userId);
            
            await localDb.meta.put({ key: "ACTIVE_SESSION_ID", value: currentTerm.session_id });
            await localDb.meta.put({ key: "ACTIVE_TERM_ID", value: currentTerm.id });
            await localDb.meta.delete("last_rollover_at"); 
          }
        }

        if (isMounted.current) {
          setDb(localDb);
          setStatus("syncing");
          setMessage("Downloading your classes and students...");
        }

        // 4. Run the initial sync
        await syncNow(localDb);

        if (isMounted.current) {
          setStatus("ready");
          setMessage("You are all set.");
        }

        await registerBackgroundSync();

        const handleOnline = () => {
          if (localDb) syncNow(localDb);
        };
        window.addEventListener("online", handleOnline);

        return () => {
          window.removeEventListener("online", handleOnline);
        };

      } catch (err: any) {
        console.error("[Bootstrap] Failed to initialize Dexie:", err);
        if (isMounted.current) {
          setError(err.message || "Failed to initialize local database.");
          setStatus("error");
        }
      }
    }

    init();

    return () => {
      isMounted.current = false;
    };
  }, []);

  return { db, status, message, error, isReady: status === "ready" };
}