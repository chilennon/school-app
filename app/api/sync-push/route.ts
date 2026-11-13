import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function classifyRpcError(error: { code?: string | null; message: string }): "rejected" | "transient" {
  const code = error.code || "";
  if (code === "42883") return "transient"; // Undefined function, wait for migration
  if (
    code.startsWith("22") ||
    code.startsWith("23") ||
    code.startsWith("42") ||
    code.startsWith("P0")
  ) {
    return "rejected";
  }
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
        // ATOMIC TERM RESULT (The ONLY block for term_result)
        // ═══════════════════════════════════════════════════════════════════
        if (table_name === "term_result") {
          const p = payload as any;

          // 1. Shape validation
          if (
            !p || 
            typeof p.enrolment_id !== "string" || 
            typeof p.term_id !== "string" || 
            !Array.isArray(p.scores) || 
            !Array.isArray(p.traits) || 
            !p.term_record || 
            typeof p.term_record !== "object" || 
            !p.student || 
            typeof p.student !== "object" ||
            !p.student.assessment ||
            typeof p.student.assessment !== "object"
          ) {
            results.push({
              client_id: id,
              status: "rejected",
              error: "Malformed term_result payload (student must include assessment object)",
            });
            continue;
          }

          // 2. Status normalization
          const incomingStatus = p.term_record.status;
          const normalizedStatus = incomingStatus === "completed" ? "submitted" : incomingStatus;

          // 3. Call the RPC
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
            console.error("RPC error:", error);
            results.push({
              client_id: id,
              status: classifyRpcError(error),
              error: error.message,
            });
            continue;
          }

          // 4. Return the actual data from the RPC
          results.push({
            client_id: id,
            status: "applied",
            server_row: data, // 🚨 The RPC returns { scores, trait_ratings, term_records, student }
          });
          continue;
        }

        // ═══════════════════════════════════════════════════════════════════
        // SINGLE-TABLE PATH (Attendance, etc.)
        // ═══════════════════════════════════════════════════════════════════
        const rowToUpsert = {
          ...payload,
          client_updated_at,
          client_mutation_id: id,
        };

        let query = supabase.from(table_name).upsert(rowToUpsert);

        if (table_name === "scores") {
          query = supabase.from(table_name).upsert(rowToUpsert, { onConflict: "enrolment_id,class_subject_id,term_id" });
        } else if (table_name === "attendance_logs") {
          query = supabase.from(table_name).upsert(rowToUpsert, { onConflict: "enrolment_id,date" });
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