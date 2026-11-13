import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.test' });

// Setup Supabase Admin client to bypass UI for setup
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

test.describe('Session & Term Rollover Gatekeeper (Owner Only)', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in/staff');
    await page.locator('input[type="email"]').fill(process.env.TEST_OWNER_EMAIL!);
    await page.locator('input[type="password"]').fill(process.env.TEST_OWNER_PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/admin', { timeout: 15000 });
  });

  test('Should BLOCK "Start Next Term" if checklist is incomplete', async ({ page }) => {
    await page.goto('/admin?tab=settings');
    await page.waitForTimeout(2000); 

    await expect(page.getByText('End of Term Rollover')).toBeVisible();
    
    // The button should be disabled
    const startButton = page.locator('button', { hasText: /Start Next Term|Complete checklist to proceed/i });
    await expect(startButton).toBeVisible();
    await expect(startButton).toBeDisabled();
  });

  test('Should ALLOW "Start Next Term" when checklist is complete', async ({ page }) => {
    // 🚨 1. FAST-FORWARD THE DATABASE
    // We bypass the UI and force all missing promotions to be created
    const { data: currentTerm } = await supabase.from('terms').select('id, session_id').eq('is_current', true).single();
    
    if (currentTerm) {
      // Force approve all results
      await supabase.from('term_records').update({ status: 'approved', promotion_status: 'promote' }).eq('term_id', currentTerm.id);
      
      // Trick the unpromoted check by creating a fake enrolments in a "next" session
      const { data: activeEnrolments } = await supabase.from('enrolments').select('student_id, class_id').eq('session_id', currentTerm.session_id).eq('status', 'active');
      
      if (activeEnrolments) {
        // Create a fake "next" session just for the test
        const { data: fakeSession } = await supabase.from('sessions').insert({ name: 'Test_Session_Next', is_current: false }).select().single();
        
        if (fakeSession) {
           const newEnrolments = activeEnrolments.map(e => ({
             student_id: e.student_id,
             class_id: e.class_id, // Just use the same class
             session_id: fakeSession.id,
             status: 'active'
           }));
           await supabase.from('enrolments').insert(newEnrolments);
        }
      }
    }

    // 2. Reload Settings
    await page.goto('/admin?tab=settings');
    await page.waitForTimeout(2000);

    // 3. The button should now be enabled
    const startButton = page.getByRole('button', { name: 'Start Next Term' });
    await expect(startButton).toBeEnabled();
    
    // 4. Click it and confirm
    await startButton.click();
    await page.getByRole('button', { name: 'Yes, Start Next Term' }).click();
    
    // 5. Verify success
    await page.waitForTimeout(2000);
    await expect(page.getByText('Current Session')).toBeVisible();
  });
});