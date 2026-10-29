import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// Error classification for the atomic RPC.
//
// The worker interprets:
//   - "rejected"  → permanent failure, mark outbox row as rejected, stop.
//   - "transient" → retry on next sync cycle, put back to "pending".
//
// We only reject on errors where retrying cannot help. Everything else
// (network, resource, timeouts, missing-migration) is retried.
// ─────────────────────────────────────────────────────────────────────────────
function classifyRpcError(error: { code?: string | null; message: string }): "rejected" | "transient" {
  const code = error.code || "";

  // 42883 = undefined_function. Happens before `supabase db push` deploys
  // the migration. Retry, do NOT reject — the row will succeed after deploy.
  if (code === "42883") return "transient";

  // Permanent / business-rule rejections.
  //   22xxx — data exception (invalid UUID, bad numeric, etc.)
  //   23xxx — integrity constraint violation
  //   42xxx — syntax / access rule / undefined column
  //   P0xxx — PL/pgSQL RAISE EXCEPTION (custom guards in the RPC)
  if (
    code.startsWith("22") ||
    code.startsWith("23") ||
    code.startsWith("42") ||
    code.startsWith("P0")
  ) {
    return "rejected";
  }

  // Everything else — connection (08xxx), serialization (40xxx),
  // resource exhaustion (53xxx), server shutdown (57P0x), PostgREST
  // wrappers (PGRSTxxx), unknown — treat as transient.
  return "transient";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { items } = await req.json();
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const item of items) {
      const { id, table_name, payload, client_updated_at } = item;

      try {
        // ═══════════════════════════════════════════════════════════════════
        // SPECIAL CASE: atomic term result
        //
        // One outbox row covers scores + trait_ratings + term_records +
        // students. Applied via a SECURITY DEFINER RPC so a partial write
        // is impossible (scores without traits, term_record without scores,
        // etc.). The RPC re-checks school + class ownership because it
        // bypasses RLS.
        // ═══════════════════════════════════════════════════════════════════

                // 🚨 HANDLE ATOMIC TERM RESULT
        if (table_name === "term_result") {
          const trData = {
            ...payload.term_record,
            school_id: user.app_metadata?.school_id,
            enrolment_id: payload.enrolment_id,
            term_id: payload.term_id,
            client_mutation_id: id,
            client_updated_at,
          };
          
          const { error: trError } = await supabase
            .from("term_records")
            .upsert(trData, { onConflict: "enrolment_id,term_id" });
          if (trError) throw trError;

          if (payload.scores && payload.scores.length > 0) {
            const scoresData = payload.scores.map((s: any) => ({
              ...s,
              school_id: user.app_metadata?.school_id,
              enrolment_id: payload.enrolment_id,
              term_id: payload.term_id,
              client_mutation_id: id,
              client_updated_at,
            }));
            const { error: scoreError } = await supabase
              .from("scores")
              .upsert(scoresData, { onConflict: "enrolment_id,class_subject_id,term_id" });
            if (scoreError) throw scoreError;
          }

          if (payload.traits && payload.traits.length > 0) {
            const traitsData = payload.traits.map((t: any) => ({
              ...t,
              school_id: user.app_metadata?.school_id,
              enrolment_id: payload.enrolment_id,
              term_id: payload.term_id,
              client_mutation_id: id,
              client_updated_at,
            }));
            const { error: traitError } = await supabase
              .from("trait_ratings")
              .upsert(traitsData, { onConflict: "enrolment_id,term_id,trait_domain,trait_key" });
            if (traitError) throw traitError;
          }

          results.push({ client_id: id, status: "applied", server_row: { success: true } });
          continue;
        }
        
        if (table_name === "term_result") {
          const p = payload as any;

          // 1. Shape validation — reject malformed payloads before the DB.
          if (
            !p ||
            typeof p.enrolment_id !== "string" ||
            typeof p.term_id !== "string" ||
            !Array.isArray(p.scores) ||
            !Array.isArray(p.traits) ||
            !p.term_record ||
            typeof p.term_record !== "object" ||
            !p.student ||
            typeof p.student !== "object"
          ) {
            results.push({
              client_id: id,
              status: "rejected",
              error: "Malformed term_result payload",
            });
            continue;
          }

          // 2. Status normalization.
          //    DB CHECK is ['draft','submitted','approved'].
          //    useSaveResult.ts currently sends "completed" verbatim — that
          //    is a pre-existing bug on the online path (follow-up PR). This
          //    route uses the correct value so the RPC does not fail its
          //    constraint check.
          const incomingStatus = p.term_record.status;
          const normalizedStatus =
            incomingStatus === "completed" ? "submitted" : incomingStatus;
          if (
            normalizedStatus !== "draft" &&
            normalizedStatus !== "submitted" &&
            normalizedStatus !== "approved"
          ) {
            results.push({
              client_id: id,
              status: "rejected",
              error: `Invalid term_record.status: ${incomingStatus}`,
            });
            continue;
          }

          // 3. Call the RPC. Parameter names below are the contract for
          //    the migration written next turn.
          const { data, error } = await supabase.rpc("apply_term_result_atomic", {
            p_enrolment_id: p.enrolment_id,
            p_term_id: p.term_id,
            p_scores: p.scores,
            p_traits: p.traits,
            p_term_record: { ...p.term_record, status: normalizedStatus },
            p_student: p.student,
            p_client_mutation_id: id,
            p_client_updated_at: client_updated_at ?? new Date().toISOString(),
          });

          if (error) {
            results.push({
              client_id: id,
              status: classifyRpcError(error),
              error: error.message,
            });
            continue;
          }

          // 4. Audit log — matches the single-table path's inline pattern.
          const firstRecordId = (data as any)?.term_records?.[0]?.id ?? null;
          await supabase.from("audit_log").insert({
            school_id: user.app_metadata?.school_id,
            actor_id: user.id,
            actor_name: user.user_metadata?.name || "Teacher",
            action: "sync.term_result.upsert",
            target_table: "term_records",
            target_id: firstRecordId,
            target_label: `Term result sync (${p.enrolment_id} / ${p.term_id})`,
            metadata: {
              enrolment_id: p.enrolment_id,
              term_id: p.term_id,
              score_count: p.scores.length,
              trait_count: p.traits.length,
              status: normalizedStatus,
            },
          });

          // 5. Return the reconciled server rows.
          //    Worker unpacks this under table_name === "term_result".
          results.push({
            client_id: id,
            status: "applied",
            server_row: data,
          });
          continue;
        }

        // ═══════════════════════════════════════════════════════════════════
        // SINGLE-TABLE PATH (unchanged behaviour)
        // ═══════════════════════════════════════════════════════════════════
        const rowToUpsert = {
          ...payload,
          client_updated_at,
          client_mutation_id: id,
        };

        let query = supabase.from(table_name).upsert(rowToUpsert);

        if (table_name === "scores") {
          query = supabase
            .from(table_name)
            .upsert(rowToUpsert, { onConflict: "enrolment_id,class_subject_id,term_id" });
        } else if (table_name === "attendance_logs") {
          query = supabase
            .from(table_name)
            .upsert(rowToUpsert, { onConflict: "enrolment_id,date" });
        }

        const { data, error } = await query.select().single();

        if (error) {
          results.push({
            client_id: id,
            status: "rejected",
            error: error.message,
          });
        } else {
          await supabase.from("audit_log").insert({
            school_id: user.app_metadata?.school_id,
            actor_id: user.id,
            actor_name: user.user_metadata?.name || "Teacher",
            action: `sync.${table_name}.update`,
            target_table: table_name,
            target_id: data.id,
            target_label: `Synced from offline device`,
          });

          results.push({
            client_id: id,
            status: "applied",
            server_row: data,
          });
        }
      } catch (err: any) {
        results.push({
          client_id: id,
          status: "transient",
          error: err.message,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}