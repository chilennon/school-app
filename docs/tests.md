
---

## `docs/tests.md`

```markdown
# Testing

## Current state

**No automated tests.** This is a known gap.

Testing happens manually:
1. On the Pixel 7 emulator via Android Studio (primary)
2. On a real Android phone before shipping to a school
3. On the developer's iPhone for iOS PWA quirks

## Manual test protocol

For every change:

1. `npm run build` locally — must be green
2. `npm start` — serve the production build (dev mode disables the service worker)
3. Open `http://localhost:3000` in Chrome on desktop first — check nothing obvious broke
4. Then test on the Pixel 7 emulator

## The critical tests

### Multi-tenant isolation (run after every RLS or schema change)

1. Sign in as School A teacher → verify only School A data appears
2. Sign in as School B teacher (or admin) → verify only School B data appears
3. Use browser dev tools to manually call the Supabase client for a table and verify RLS blocks cross-tenant reads

Put this on a checklist. It's the most damaging failure mode.

### PWA offline (run before every deploy)

1. Open installed PWA on emulator with network on
2. Wait 10 seconds for precache to complete
3. Turn airplane mode on
4. Close and reopen the app
5. Verify: app shell loads, sign-in page renders

## What to test when adding a feature

For each new feature, test:
- Happy path (the intended use)
- Empty state (no data yet)
- Error state (network failure, permission denied)
- The role split (teacher sees X, admin sees Y, owner sees Z)
- Offline behavior (does it fail gracefully?)

## Future automated testing

Not built yet. When built, priorities:
1. Multi-tenant isolation test (can be a script, doesn't need a framework)
2. Calculation functions (`computePositions`, `calculateSummary`, `computeTermAverages`) — pure functions, easy to test
3. API route authorization — spin up a test client for each role and verify rejections

Skip UI tests until the UI stops changing.

## Test devices

| Device | Why | Status |
|---|---|---|
| Pixel 7 emulator (Android Studio) | Primary dev testing | ✅ Set up |
| Real low-end Android (Tecno/Infinix) | Production reality check | ⚠️ Recommended |
| iPhone (developer's own) | iOS PWA quirks | ✅ Ad-hoc |



2026-09 — RLS helper functions
Why: Policies need to read the caller's school without querying profiles (recursion).

sql
create or replace function my_school_id()
returns uuid language sql stable as $$
  select (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
$$;

create or replace function is_school_admin()
returns boolean language sql stable as $$
  select (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'owner')
$$;

create or replace function teaches_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.classes where id = p_class_id and teacher_id = auth.uid())
    or exists (select 1 from public.class_subjects where class_id = p_class_id and staff_id = auth.uid())
$$;

create or replace function owns_class_subject(p_class_subject_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_subjects cs
    join public.classes c on c.id = cs.class_id
    where cs.id = p_class_subject_id
      and (cs.staff_id = auth.uid() or c.teacher_id = auth.uid())
  )
$$;

create or replace function teaches_enrolment(p_enrolment_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrolments e
    where e.id = p_enrolment_id
      and teaches_class(e.class_id)
  )
$$;
2026-09 — Drop profile trigger
Why: Replace the handle_new_user trigger with explicit profile creation in API routes (better error messages, no orphan rows).

sql
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
2026-10 — Attendance logs
Why: New feature — daily roll call.

sql
create table attendance_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  enrolment_id uuid not null references enrolments(id),
  date date not null,
  status text not null check (status in ('present','absent')),
  recorded_by uuid not null references profiles(id),
  recorded_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  unique (enrolment_id, date)
);

create index attendance_logs_school_date_idx on attendance_logs (school_id, date);
create index attendance_logs_enrolment_idx on attendance_logs (enrolment_id);

alter table attendance_logs enable row level security;

create policy "attendance_select" on attendance_logs for select
using (school_id = my_school_id() and (is_school_admin() or teaches_enrolment(enrolment_id)));

create policy "attendance_write" on attendance_logs for all
using (school_id = my_school_id() and (is_school_admin() or teaches_enrolment(enrolment_id)))
with check (school_id = my_school_id() and (is_school_admin() or teaches_enrolment(enrolment_id)));
2026-10 — Audit log
Why: Track admin actions + NDPA compliance.

sql
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  actor_id uuid not null references profiles(id),
  actor_name text not null,
  action text not null,
  target_table text not null,
  target_id uuid,
  target_label text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_school_created_idx on audit_log (school_id, created_at desc);

alter table audit_log enable row level security;

create policy "audit_log_read_same_school" on audit_log for select
using (school_id = my_school_id() and is_school_admin());
When you add a new migration
Write the SQL

Test on a scratch school if possible

Run in production

Append a new section to this file with date, rationale, and the exact SQL


