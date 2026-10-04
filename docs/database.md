# Database

Postgres via Supabase. Every table has `school_id` for multi-tenant isolation.

## Core rules

1. **Enrolment-centric.** A student is not "in" a class. A student has an *enrolment* that places them in a class for a given session. Scores, traits, and term records attach to the enrolment, not the student. This is what makes promotion, repeating, and history work.

2. **`school_id` on every table.** Enforced by RLS. Indexed.

3. **No stored balances.** Fee balance (when it ships) = `sum(charges) - sum(payments)`, computed on demand.

4. **No stored cumulative averages in most tables.** Computed from scores. Exception: `term_records` snapshots the computed result at approval time so printed report cards can be reproduced exactly.

## Tables

### Tenancy & configuration

**`schools`**
`id`, `name`, `address`, `phone`, `motto`, `created_at`

**`profiles`** (1:1 with `auth.users`)
`id` (uuid, PK = auth user id), `school_id`, `name`, `email`, `role` (owner | admin | teacher | bursar), `created_at`

**`sessions`** (academic years, e.g. "2025/2026")
`id`, `school_id`, `name`, `is_current`

**`terms`** (First/Second/Third, child of a session)
`id`, `school_id`, `session_id`, `name`, `sequence`, `is_current`, `days_opened`, `next_term_begins`

**`classes`**
`id`, `school_id`, `name`, `session`, `session_id`, `teacher_id`, `level_order`

**`subjects`**
`id`, `school_id`, `name`, `display_order`

**`grade_bands`** (school-specific grading scale)
`id`, `school_id`, `min_score`, `max_score`, `grade`, `remark`, `display_order`

### People

**`students`**
`id`, `school_id`, `name`, `reg_no`, `class_id`, `gender`, `age`, `assessment` (JSONB), `created_at`
Unique: `(school_id, reg_no)`

**`enrolments`**
`id`, `school_id`, `student_id`, `class_id`, `session_id`, `status` (active | transferred | withdrawn)
Unique: `(student_id, session_id)`

**`class_subjects`** (which subjects a class offers)
`id`, `school_id`, `class_id`, `subject_id`, `session_id`, `staff_id`
Unique: `(class_id, subject_id, session_id)`

### Results

**`scores`**
`id`, `school_id`, `enrolment_id`, `class_subject_id`, `term_id`, `ca_score`, `exam_score`, `sa_score`, `status` (draft | submitted | approved), `server_updated_at`
Unique: `(enrolment_id, class_subject_id, term_id)`

**`trait_ratings`**
`id`, `school_id`, `enrolment_id`, `term_id`, `trait_key`, `trait_domain` (affective | psychomotor), `rating` (1–5)
Unique: `(enrolment_id, term_id, trait_key)`

**`term_records`** (per-student-per-term summary: attendance + comments + approval state)
`id`, `school_id`, `enrolment_id`, `term_id`, `days_opened`, `days_present`, `days_absent`, `class_teacher_comment`, `head_teacher_comment`, `status` (draft | submitted | approved), `approved_by`, `approved_at`, `server_updated_at`
Unique: `(enrolment_id, term_id)`

### Attendance (new)

**`attendance_logs`**
`id`, `school_id`, `enrolment_id`, `date`, `status` (present | absent), `recorded_by`, `recorded_at`, `server_updated_at`
Unique: `(enrolment_id, date)`

### Audit (new)

**`audit_log`**
`id`, `school_id`, `actor_id`, `actor_name`, `action`, `target_table`, `target_id`, `target_label`, `metadata` (JSONB), `created_at`

### Fee tables (planned, not yet created)

Will follow the same append-only ledger pattern. See `docs/specs/fees.md`.

## Indexes that matter

```sql
-- RLS performance
create index profiles_school_id_idx on profiles (school_id);
create index students_school_id_idx on students (school_id);
create index classes_school_id_idx on classes (school_id);

-- Common queries
create index attendance_logs_school_date_idx on attendance_logs (school_id, date);
create index attendance_logs_enrolment_idx on attendance_logs (enrolment_id);
create index audit_log_school_created_idx on audit_log (school_id, created_at desc);
create index scores_enrolment_term_idx on scores (enrolment_id, term_id);

RLS helper functions
Defined in Supabase, used by every policy:

my_school_id() → (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid

is_school_admin() → auth.jwt() -> 'app_metadata' ->> 'role' in ('admin', 'owner')

teaches_class(class_id) → true if caller is form teacher OR subject teacher of that class

owns_class_subject(class_subject_id) → true if caller owns that class-subject row

teaches_enrolment(enrolment_id) → true if caller teaches the enrolment's class

None of these query the database. They read from the JWT. Querying profiles from an RLS policy causes infinite recursion — this was learned the hard way.

Full policy definitions are in docs/security.md.