// app/admin/fees/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

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

  const schoolId = user.app_metadata?.school_id;
  if (!schoolId) throw new Error('Missing school context');

  // Fetch current session from DB (it is not in the JWT)
  const { data: currentSession } = await supabase
    .from('sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single();

  if (!currentSession) throw new Error('No active session found');
  const sessionId = currentSession.id;

  // 1. Fetch current receipt counter
  const { data: counter } = await supabase
    .from('receipt_counters')
    .select('last_number')
    .eq('school_id', schoolId)
    .eq('session_id', sessionId)
    .single();

  const nextNumber = (counter?.last_number || 0) + 1;
  const receiptNo = `RCPT-${new Date().getFullYear()}-${String(nextNumber).padStart(4, '0')}`;

  // 2. Update receipt counter
  if (counter) {
    await supabase
      .from('receipt_counters')
      .update({ last_number: nextNumber })
      .eq('school_id', schoolId)
      .eq('session_id', sessionId);
  } else {
    await supabase
      .from('receipt_counters')
      .insert({ school_id: schoolId, session_id: sessionId, last_number: nextNumber });
  }

  // 3. Insert Payment
  const { error } = await supabase.from('payments').insert({
    school_id: schoolId,
    family_id: data.familyId,
    amount: data.amount,
    method: data.method,
    reference: data.reference,
    note: data.note,
    receipt_no: receiptNo,
    paid_on: new Date().toISOString().split('T')[0],
    recorded_by: user.id,
  });

  if (error) throw new Error(error.message);

  // 4. Audit Log (FIXED TO MATCH YOUR EXISTING HELPER)
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

  revalidatePath('/admin/fees');
  revalidatePath(`/admin/fees/family/${data.familyId}`);
  
  return { success: true, receiptNo };
}

export async function voidPayment(paymentId: string, amount: number, reason: string, familyId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const schoolId = user.app_metadata?.school_id;
  if (!schoolId) throw new Error('Missing school context');

  // Insert negative payment
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
  
  // Audit Log (FIXED TO MATCH YOUR EXISTING HELPER)
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
  
  revalidatePath(`/admin/fees/family/${familyId}`);
  revalidatePath('/admin/fees');
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

  const schoolId = user.app_metadata?.school_id;
  if (!schoolId) throw new Error('Missing school context');

  // 1. Create Family
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

  // 2. Create Students
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

  // 3. Create Initial Charge
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

  // 4. Audit Log (FIXED TO MATCH YOUR EXISTING HELPER)
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

  revalidatePath('/admin/fees');
  return { success: true, familyId: family.id };
}


// Add to app/admin/fees/actions.ts

export interface ImportRow {
  familyName: string;
  guardianName?: string;
  guardianPhone?: string;
  children?: string; // e.g. "Tobi (Basic 4), Sola (KG 2)"
  totalDue: number;
  totalPaid: number;
}

export async function importFamilies(rows: ImportRow[], termId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const schoolId = user.app_metadata?.school_id;
  if (!schoolId) throw new Error('Missing school context');

  // Get current session for receipt numbering
  const { data: currentSession } = await supabase
    .from('sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single();

  if (!currentSession) throw new Error('No active session found');

  // 1. Fetch current counter
  const { data: counter } = await supabase
    .from('receipt_counters')
    .select('last_number')
    .eq('school_id', schoolId)
    .eq('session_id', currentSession.id)
    .single();

  let currentReceiptNumber = counter?.last_number || 0;

  let importedCount = 0;

  for (const row of rows) {
    // 2. Create Family
    const { data: family, error: famError } = await supabase
      .from('families')
      .insert({
        school_id: schoolId,
        name: row.familyName,
        guardian_name: row.guardianName || 'Guardian',
        guardian_phone: row.guardianPhone || '0000000000',
      })
      .select()
      .single();

    if (famError) {
      console.error("Failed to insert family:", row.familyName, famError);
      continue; // Skip this row and continue
    }

    // 3. Create Initial Charge (if totalDue > 0)
    if (row.totalDue > 0) {
      await supabase.from('charges').insert({
        school_id: schoolId,
        family_id: family.id,
        term_id: termId,
        description: 'Migrated Initial Balance',
        amount: row.totalDue,
        created_by: user.id,
      });
    }

    // 4. Create Initial Payment (if totalPaid > 0)
    if (row.totalPaid > 0) {
      currentReceiptNumber += 1;
      const receiptNo = `IMP-${new Date().getFullYear()}-${String(currentReceiptNumber).padStart(4, '0')}`;
      
      await supabase.from('payments').insert({
        school_id: schoolId,
        family_id: family.id,
        amount: row.totalPaid,
        method: 'other',
        receipt_no: receiptNo,
        paid_on: new Date().toISOString().split('T')[0],
        note: 'Migrated from spreadsheet',
        recorded_by: user.id,
      });
    }

    importedCount++;
  }

  // 5. Update Receipt Counter
  if (currentReceiptNumber > (counter?.last_number || 0)) {
    await supabase
      .from('receipt_counters')
      .update({ last_number: currentReceiptNumber })
      .eq('school_id', schoolId)
      .eq('session_id', currentSession.id);
  }

  await logAudit(supabase, {
    schoolId: schoolId,
    actorId: user.id,
    actorName: user.user_metadata?.name || "Admin",
    action: 'IMPORT_FAMILIES',
    targetTable: 'families',
    targetId: 'bulk',
    targetLabel: `Imported ${importedCount} families`,
    metadata: { count: importedCount }
  });

  revalidatePath('/admin/fees');
  return { success: true, importedCount };
}