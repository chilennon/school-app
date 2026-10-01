import type { SupabaseClient } from "@supabase/supabase-js";

export interface LogAuditInput {
  schoolId: string;
  actorId: string;
  actorName: string;
  action: string;
  targetTable: string;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Writes one row to audit_log. Fire-and-forget from the caller's
 * perspective — failures are logged but don't fail the parent operation.
 */
export async function logAudit(
  supabaseAdmin: SupabaseClient,
  input: LogAuditInput,
): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_log").insert([
    {
      school_id: input.schoolId,
      actor_id: input.actorId,
      actor_name: input.actorName,
      action: input.action,
      target_table: input.targetTable,
      target_id: input.targetId ?? null,
      target_label: input.targetLabel ?? null,
      metadata: input.metadata ?? null,
    },
  ]);

  if (error) {
    console.error("audit log write failed:", error.message);
  }
}