import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.test' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

test.describe('Ultimate Lifecycle: 3-Session Stress Test', () => {
  test('Multi-teacher, multi-class, multi-family with fees', async ({ page }) => {
    test.setTimeout(300000); // 5 min

    const testId = Date.now();
    const schoolName = `Test School ${testId}`;
    const ownerEmail = `owner_${testId}@test.com`;
    const t1Email = `t1_${testId}@test.com`;
    const t2Email = `t2_${testId}@test.com`;
    const password = 'Password123!';

    let schoolId: string;
    const familyIds: Record<string, string> = {};

    // ══════════════════════════════════════════
    // PHASE 1: SETUP
    // ══════════════════════════════════════════
    await test.step('1a. Signup school', async () => {
      await page.goto('/signup/school');
      await page.getByPlaceholder('e.g. Mr. Emeka Obi').fill('Owner Name');
      await page.getByPlaceholder('you@example.com').fill(ownerEmail);
      await page.locator('input[type="password"]').first().fill(password);
      await page.locator('input[type="password"]').nth(1).fill(password);
      await page.getByPlaceholder('e.g. House Of Angels').fill(schoolName);
      await page.getByPlaceholder('e.g. Primary School').fill('Primary');
      await page.getByPlaceholder('e.g. 2025/2026').fill('2025/2026');
      await page.locator('select').selectOption('First');
      await page.getByRole('button', { name: 'Create school' }).click();
      await page.waitForURL('**/admin', { timeout: 15000 });

      const { data } = await supabase.from('schools').select('id').eq('name', schoolName).single();
      schoolId = data!.id;
    });

    await test.step('1b. Seed 2 teachers, 4 classes, 5 families, 8 students, fees', async () => {
      // --- 2 teachers ---
      const teacherIds: Record<string, string> = {};
      for (const [name, email] of [['Teacher One', t1Email], ['Teacher Two', t2Email]]) {
        const { data: auth } = await supabase.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { name }, app_metadata: { role: 'teacher', school_id: schoolId }
        });
        await supabase.from('profiles').insert({ id: auth.user!.id, name, email, role: 'teacher', school_id: schoolId });
        teacherIds[name] = auth.user!.id;
      }

      // --- session + term + subject ---
      const { data: session } = await supabase.from('sessions').select('id').eq('school_id', schoolId).single();
      const { data: term } = await supabase.from('terms').select('id').eq('session_id', session!.id).eq('sequence', 1).single();
      const { data: subject } = await supabase.from('subjects').insert({ school_id: schoolId, name: 'Mathematics' }).select().single();

      // --- 4 classes ---
      const classes: Record<string, string> = {};
      for (const [name, teacher] of [['Basic 1', 'Teacher One'], ['Basic 2', null], ['Basic 3', 'Teacher Two'], ['Basic 4', null]]) {
        const { data } = await supabase.from('classes').insert({
          school_id: schoolId, name, session: '2025/2026', session_id: session!.id,
          teacher_id: teacher ? teacherIds[teacher] : null
        }).select().single();
        classes[name] = data!.id;
      }

      // --- subject to all classes ---
      await supabase.from('class_subjects').insert(Object.values(classes).map(cid => ({
        school_id: schoolId, class_id: cid, subject_id: subject!.id, session_id: session!.id
      })));

      // --- 5 families ---
      const families = [
        { name: 'Adeyemi Family', phone: '1111111111' },
        { name: 'Doe Family', phone: '2222222222' },
        { name: 'Okoro Family', phone: '3333333333' },
        { name: 'Smith Family', phone: '4444444444' },
        { name: 'Brown Family', phone: '5555555555' },
      ];
      for (const f of families) {
        const { data } = await supabase.from('families').insert({
          school_id: schoolId, name: f.name, guardian_name: 'Guardian', guardian_phone: f.phone
        }).select().single();
        familyIds[f.name] = data!.id;
      }

      // --- 8 students ---
      // [name, family, class, score (0-100), per-child fee]
      const students = [
        ['Adeyemi S1', 'Adeyemi Family', 'Basic 1', 80, 25000],
        ['Adeyemi S2', 'Adeyemi Family', 'Basic 2', 80, 25000],
        ['Doe S1', 'Doe Family', 'Basic 1', 20, 25000],
        ['Okoro S1', 'Okoro Family', 'Basic 1', 80, 25000],
        ['Okoro S2', 'Okoro Family', 'Basic 2', 80, 25000],
        ['Smith S1', 'Smith Family', 'Basic 3', 80, 25000],
        ['Brown S1', 'Brown Family', 'Basic 4', 80, 25000],
        ['Brown S2', 'Brown Family', 'Basic 4', 80, 25000],
      ];

      // Group fee totals per family
      const familyCharges: Record<string, number> = {};
      for (const [sname, family, className, score, fee] of students) {
        const { data: stu } = await supabase.from('students').insert({
          school_id: schoolId, name: sname, reg_no: `${sname.replace(/\s/g, '-')}-${testId}`,
          class_id: classes[className], family_id: familyIds[family]
        }).select().single();
        const { data: enr } = await supabase.from('enrolments').insert({
          school_id: schoolId, student_id: stu!.id, class_id: classes[className], session_id: session!.id, status: 'active'
        }).select().single();

        const { data: cs } = await supabase.from('class_subjects').select('id').eq('class_id', classes[className]).single();
        await supabase.from('scores').insert({
          school_id: schoolId, enrolment_id: enr!.id, class_subject_id: cs!.id,
          term_id: term!.id, ca_score: Math.floor(score / 2), exam_score: Math.floor(score / 2)
        });
        await supabase.from('term_records').insert({
          school_id: schoolId, enrolment_id: enr!.id, term_id: term!.id, status: 'submitted'
        });

        familyCharges[family] = (familyCharges[family] || 0) + fee;
      }

      // --- fees + payments per family ---
      // Family A: charges 50k, paid 20k (owes 30k)
      // Family B: charges 25k, paid 0 (owes 25k)
      // Family C: charges 50k, paid 50k (fully paid)
      // Family D: charges 25k, paid 15k (owes 10k)
      // Family E: charges 50k, paid 25k (owes 25k)
      const paymentsByFamily: Record<string, number> = {
        'Adeyemi Family': 20000,
        'Doe Family': 0,
        'Okoro Family': 50000,
        'Smith Family': 15000,
        'Brown Family': 25000,
      };

      for (const [family, amount] of Object.entries(familyCharges)) {
        await supabase.from('charges').insert({
          school_id: schoolId, family_id: familyIds[family], term_id: term!.id,
          description: 'Tuition', amount
        });
        const paid = paymentsByFamily[family] || 0;
        if (paid > 0) {
          await supabase.from('payments').insert({
            school_id: schoolId, family_id: familyIds[family], amount: paid,
            method: 'cash', receipt_no: `RCPT-${family.split(' ')[0]}-${testId}`,
            paid_on: '2025-09-01', recorded_by: teacherIds['Teacher One']
          });
        }
      }
    });

    // ══════════════════════════════════════════
    // PHASE 2: 3-SESSION LOOP
    // ══════════════════════════════════════════
    let currentSessionName = '2025/2026';

    for (let i = 1; i <= 3; i++) {
      const nextSessionName = `${2025 + i}/${2026 + i}`;

      await test.step(`Session ${i}: Approve & rollover`, async () => {
        await page.goto('/admin?tab=approvals');
        await page.waitForTimeout(1500);

        // Approve every pending class
        let hasMore = true;
        while (hasMore) {
          const btn = page.getByRole('button', { name: 'Review Results' }).first();
          if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await btn.click();
            await page.getByRole('button', { name: /Approve All/i }).click();
            const confirm = page.getByRole('button', { name: /Yes, Approve/i });
            if (await confirm.isVisible().catch(() => false)) await confirm.click();
            await page.waitForTimeout(1000);
            await page.getByRole('button', { name: 'Back' }).click();
            await page.waitForTimeout(1000);
          } else {
            hasMore = false;
          }
        }

        // Promotion tab
        await page.goto('/admin?tab=promotion');
        await page.waitForTimeout(2000);
        await expect(page.getByText('Promotion & Rollover')).toBeVisible();

        // Loop 1: manually mark Doe S1 as Repeat (failing 20%)
        if (i === 1) {
          const doeRow = page.locator('.p-4.border-b').filter({ hasText: 'Doe S1' });
          await expect(doeRow.getByText('Below Pass Mark')).toBeVisible();
          await doeRow.getByRole('button', { name: 'Repeat' }).click();
        }

        // Execute
        await page.getByRole('button', { name: 'Start Next Session' }).click();
        await page.locator('.fixed.inset-0 input[type="text"]').fill(nextSessionName);
        await page.getByRole('button', { name: 'Confirm' }).click();
        await expect(page.getByText('Session rollover complete!')).toBeVisible({ timeout: 10000 });

        currentSessionName = nextSessionName;
      });

      await test.step(`Session ${i}: Verify trajectories & fees`, async () => {
        // 1. Session active
        const { data: activeSess } = await supabase.from('sessions').select('name').eq('school_id', schoolId).eq('is_current', true).single();
        expect(activeSess?.name).toBe(nextSessionName);

        // 2. Adeyemi S1 moves up every loop: Basic 1 → 2 → 3 → 4
        const { data: s1 } = await supabase.from('students').select('class_id').eq('school_id', schoolId).eq('name', 'Adeyemi S1').single();
        const { data: s1Class } = await supabase.from('classes').select('name').eq('id', s1!.class_id).single();
        expect(s1Class?.name).toBe(`Basic ${i + 1}`);

        // 3. Doe S1 repeats once, then moves up
        const { data: doe } = await supabase.from('students').select('class_id').eq('school_id', schoolId).eq('name', 'Doe S1').single();
        const { data: doeClass } = await supabase.from('classes').select('name').eq('id', doe!.class_id).single();
        if (i === 1) {
          expect(doeClass?.name).toBe('Basic 1'); // Repeated
        } else {
          expect(doeClass?.name).toBe(`Basic ${i}`); // Moved up
        }

        // 4. Brown S1 & S2 graduated in Loop 1
        if (i === 1) {
          for (const n of ['Brown S1', 'Brown S2']) {
            const { data } = await supabase.from('students').select('status, class_id').eq('school_id', schoolId).eq('name', n).single();
            expect(data?.status).toBe('graduated');
            expect(data?.class_id).toBeNull();
          }
        }

        // 5. Fees unchanged across rollovers (brought forward)
        const { data: adeyemiC } = await supabase.from('charges').select('amount').eq('family_id', familyIds['Adeyemi Family']);
        expect(adeyemiC!.reduce((s, c) => s + Number(c.amount), 0)).toBe(50000);
        const { data: adeyemiP } = await supabase.from('payments').select('amount').eq('family_id', familyIds['Adeyemi Family']);
        expect(adeyemiP!.reduce((s, p) => s + Number(p.amount), 0)).toBe(20000);

        const { data: okoroC } = await supabase.from('charges').select('amount').eq('family_id', familyIds['Okoro Family']);
        expect(okoroC!.reduce((s, c) => s + Number(c.amount), 0)).toBe(50000);
        const { data: okoroP } = await supabase.from('payments').select('amount').eq('family_id', familyIds['Okoro Family']);
        expect(okoroP!.reduce((s, p) => s + Number(p.amount), 0)).toBe(50000);
        // Okoro is fully paid → 0 outstanding ✓

        const { data: doeC } = await supabase.from('charges').select('amount').eq('family_id', familyIds['Doe Family']);
        expect(doeC!.reduce((s, c) => s + Number(c.amount), 0)).toBe(25000);
        // Doe paid nothing → 25k owed ✓
      });

      // Seed scores for next session (except after last loop)
      if (i < 3) {
        await test.step(`Seed scores for ${nextSessionName}`, async () => {
          const { data: newSess } = await supabase.from('sessions').select('id').eq('school_id', schoolId).eq('name', nextSessionName).single();
          const { data: newTerm } = await supabase.from('terms').select('id').eq('session_id', newSess!.id).eq('sequence', 1).single();
          const { data: enrolments } = await supabase.from('enrolments').select('id, class_id').eq('session_id', newSess!.id).eq('status', 'active');

          for (const e of enrolments || []) {
            const { data: cs } = await supabase.from('class_subjects').select('id').eq('class_id', e.class_id).eq('session_id', newSess!.id).single();
            if (!cs) continue;
            await supabase.from('scores').insert({
              school_id: schoolId, enrolment_id: e.id, class_subject_id: cs.id,
              term_id: newTerm!.id, ca_score: 40, exam_score: 40, status: 'draft'
            });
            await supabase.from('term_records').insert({
              school_id: schoolId, enrolment_id: e.id, term_id: newTerm!.id, status: 'submitted'
            });
          }
        });
      }
    }
  });
});