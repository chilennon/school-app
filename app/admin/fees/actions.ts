// app/admin/fees/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

// Helper to enforce owner role across all actions
function enforceOwner(user: any) {
  if (user.app_metadata?.role !== 'owner') {
    throw new Error('Forbidden: Only school owners can manage fees.');
  }
}

export async function recordPayment(data: {
  familyId: string;
  amount: number;
  method: string;
  reference?: string;
  note?: string;
}) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) throw new Error('Unauthorized');
  enforceOwner(user);

  const schoolId = user.app_metadata?.school_id;
  if (!schoolId) throw new Error('Missing school context');

  const { data: currentSession } = await supabase
    .from('sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single();

  if (!currentSession) throw new Error('No active session found');

  // Call the Atomic Postgres RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc('record_payment_atomic', {
    p_school_id: schoolId,
    p_session_id: currentSession.id,
    p_family_id: data.familyId,
    p_user_id: user.id,
    p_amount: data.amount,
    p_method: data.method,
    p_reference: data.reference || null,
    p_note: data.note || null,
  });

  if (rpcError) throw new Error(rpcError.message);
  const receiptNo = rpcData.receipt_no;

  await logAudit(supabase, {
    schoolId: schoolId,
    actorId: user.id,
    actorName: user.user_metadata?.name || "Admin",
    action: 'RECORD_PAYMENT',
    targetTable: 'payments',
    targetId: data.familyId,
    targetLabel: `Payment of ₦${data.amount.toLocaleString()} (${receiptNo})`,
    metadata: { receiptNo, method: data.method }
  });

  // FIXED: Revalidate the shell, not the dead route
  revalidatePath('/admin');
  
  return { success: true, receiptNo };
}

export async function voidPayment(
  paymentId: string, 
  amount: number, 
  reason: string, 
  familyId: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');
  enforceOwner(user);

  const schoolId = user.app_metadata?.school_id;
  if (!schoolId) throw new Error('Missing school context');

  const { error } = await supabase.from('payments').insert({
    school_id: schoolId,
    family_id: familyId,
    amount: -Math.abs(amount), 
    method: 'other',
    note: `VOID: ${reason}`,
    receipt_no: `VOID-${Date.now()}`,
    paid_on: new Date().toISOString().split('T')[0],
    recorded_by: user.id,
  });

  if (error) throw new Error(error.message);
  
  await logAudit(supabase, {
    schoolId: schoolId,
    actorId: user.id,
    actorName: user.user_metadata?.name || "Admin",
    action: 'VOID_PAYMENT',
    targetTable: 'payments',
    targetId: familyId,
    targetLabel: `Voided ₦${Math.abs(amount).toLocaleString()} — ${reason}`,
    metadata: { originalPaymentId: paymentId, reason }
  });
  
  revalidatePath('/admin');
}

export async function addFamily(data: {
  name: string;
  guardianName: string;
  guardianPhone: string;
  students: { name: string; classId: string; regNo: string }[];
  initialCharge: number;
  termId: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');
  enforceOwner(user);

  const schoolId = user.app_metadata?.school_id;
  if (!schoolId) throw new Error('Missing school context');

  const { data: family, error: famError } = await supabase
    .from('families')
    .insert({
      school_id: schoolId,
      name: data.name,
      guardian_name: data.guardianName,
      guardian_phone: data.guardianPhone,
    })
    .select()
    .single();

  if (famError) throw new Error(famError.message);

  if (data.students.length > 0) {
    const studentRecords = data.students.map(s => ({
      school_id: schoolId,
      name: s.name,
      reg_no: s.regNo,
      class_id: s.classId,
      family_id: family.id,
    }));

    const { error: studentError } = await supabase.from('students').insert(studentRecords);
    if (studentError) throw new Error(studentError.message);
  }

  if (data.initialCharge > 0) {
    await supabase.from('charges').insert({
      school_id: schoolId,
      family_id: family.id,
      term_id: data.termId,
      description: 'Initial Term Fees',
      amount: data.initialCharge,
      created_by: user.id,
    });
  }

  await logAudit(supabase, {
    schoolId: schoolId,
    actorId: user.id,
    actorName: user.user_metadata?.name || "Admin",
    action: 'CREATE_FAMILY',
    targetTable: 'families',
    targetId: family.id,
    targetLabel: data.name,
    metadata: { initialCharge: data.initialCharge }
  });

  revalidatePath('/admin');
  return { success: true, familyId: family.id };
}

export interface ImportRow {
  familyName: string;
  guardianName?: string;
  guardianPhone?: string;
  children?: string;
  totalDue: number;
  totalPaid: number;
}

export async function importFamilies(rows: ImportRow[], termId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');
  enforceOwner(user);

  const schoolId = user.app_metadata?.school_id;
  if (!schoolId) throw new Error('Missing school context');

  const { data: currentSession } = await supabase
    .from('sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single();

  if (!currentSession) throw new Error('No active session found');

  const { data, error } = await supabase.rpc('import_families_bulk', {
    p_school_id: schoolId,
    p_term_id: termId,
    p_session_id: currentSession.id,
    p_user_id: user.id,
    p_rows: rows,
  });

  if (error) {
    console.error("Bulk import RPC failed:", error);
    throw new Error(error.message);
  }

  await logAudit(supabase, {
    schoolId: schoolId,
    actorId: user.id,
    actorName: user.user_metadata?.name || "Admin",
    action: 'IMPORT_FAMILIES',
    targetTable: 'families',
    targetId: 'bulk',
    targetLabel: `Imported ${data.inserted} families, skipped ${data.skipped}`,
    metadata: { inserted: data.inserted, skipped: data.skipped }
  });

  revalidatePath('/admin');
  
  return { 
    success: true, 
    inserted: data.inserted as number, 
    skipped: data.skipped as number 
  };
}

export async function updateFamilyDetails(
  familyId: string,
  data: { name: string; guardianName: string; guardianPhone: string }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');
  enforceOwner(user);

  const schoolId = user.app_metadata?.school_id;

  const { error } = await supabase
    .from('families')
    .update({
      name: data.name,
      guardian_name: data.guardianName,
      guardian_phone: data.guardianPhone,
    })
    .eq('id', familyId)
    .eq('school_id', schoolId);

  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    schoolId: schoolId,
    actorId: user.id,
    actorName: user.user_metadata?.name || "Admin",
    action: 'UPDATE_FAMILY',
    targetTable: 'families',
    targetId: familyId,
    targetLabel: data.name,
    metadata: { guardianPhone: data.guardianPhone }
  });

  revalidatePath('/admin');
  return { success: true };
}

export async function updatePaymentNote(paymentId: string, note: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');
  enforceOwner(user);

  const schoolId = user.app_metadata?.school_id;

  const { error } = await supabase
    .from('payments')
    .update({ note })
    .eq('id', paymentId)
    .eq('school_id', schoolId);

  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    schoolId: schoolId,
    actorId: user.id,
    actorName: user.user_metadata?.name || "Admin",
    action: 'UPDATE_PAYMENT_NOTE',
    targetTable: 'payments',
    targetId: paymentId,
    targetLabel: `Updated note: ${note}`,
    metadata: { note }
  });

  revalidatePath('/admin');
  return { success: true };
}

export async function deleteFamily(familyId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');
  enforceOwner(user);

  const schoolId = user.app_metadata?.school_id;

  // Verify the ledger is empty
  const [chargesRes, paymentsRes] = await Promise.all([
    supabase.from('charges').select('id', { count: 'exact', head: true }).eq('family_id', familyId),
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('family_id', familyId)
  ]);

  if ((chargesRes.count || 0) > 0 || (paymentsRes.count || 0) > 0) {
    throw new Error("Cannot delete a family with existing financial records. Preserve the audit trail.");
  }

  const { error } = await supabase
    .from('families')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', familyId)
    .eq('school_id', schoolId);

  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    schoolId: schoolId,
    actorId: user.id,
    actorName: user.user_metadata?.name || "Admin",
    action: 'DELETE_FAMILY',
    targetTable: 'families',
    targetId: familyId,
    targetLabel: 'Deleted Family',
    metadata: {}
  });

  revalidatePath('/admin');
  return { success: true };
}

// app/admin/fees/actions.ts

export async function mergeFamilies(
  primaryFamilyId: string, 
  duplicateFamilyId: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');
  enforceOwner(user); // Assuming you have this helper defined at the top

  const schoolId = user.app_metadata?.school_id;
  if (!schoolId) throw new Error('Missing school context');

  const { error } = await supabase.rpc('merge_families_atomic', {
    p_school_id: schoolId,
    p_primary_family_id: primaryFamilyId,
    p_duplicate_family_id: duplicateFamilyId,
    p_user_id: user.id,
  });

  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    schoolId: schoolId,
    actorId: user.id,
    actorName: user.user_metadata?.name || "Admin",
    action: 'MERGE_FAMILIES',
    targetTable: 'families',
    targetId: primaryFamilyId,
    targetLabel: `Merged family ${duplicateFamilyId} into ${primaryFamilyId}`,
    metadata: { primaryFamilyId, duplicateFamilyId }
  });

  revalidatePath('/admin');
  return { success: true };
}

export async function generateTermCharges(
  termId: string, 
  classFees: { class_id: string; amount: number }[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');
  enforceOwner(user); // Assuming you have this helper defined at the top

  const schoolId = user.app_metadata?.school_id;
  if (!schoolId) throw new Error('Missing school context');

  const { data, error } = await supabase.rpc('generate_term_charges_atomic', {
    p_school_id: schoolId,
    p_term_id: termId,
    p_user_id: user.id,
    p_class_fees: classFees, // Supabase automatically JSON.stringifies objects/arrays
  });

  if (error) throw new Error(error.message);

  await logAudit(supabase, {
    schoolId: schoolId,
    actorId: user.id,
    actorName: user.user_metadata?.name || "Admin",
    action: 'GENERATE_TERM_CHARGES',
    targetTable: 'charges',
    targetId: termId,
    targetLabel: `Generated ${data.generated_charges} tuition charges for term ${termId}`,
    metadata: { termId, generated_charges: data.generated_charges, classFees }
  });

  revalidatePath('/admin');
  return { success: true, generatedCharges: data.generated_charges as number };
}