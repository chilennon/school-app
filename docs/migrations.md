
---

## `docs/migrations.md`

```markdown
# Migrations

**There is no migration tool.** SQL is run manually in the Supabase SQL editor. Every migration is recorded here.

## Rule

Never run a schema change in production without adding it to this file first. Copy-paste the exact SQL that was run. Include a one-line rationale.

## How to run

1. Open Supabase → SQL Editor
2. Paste the migration SQL
3. Run
4. Verify with a SELECT
5. Add the block to this file (below)

## Migration log

---

### 2026-09 — Multi-tenant foundation

**Why:** Add `school_id` to every table so multiple schools can coexist.

```sql
-- profiles
alter table profiles add column school_id uuid references schools(id);
update profiles set school_id = '<house-of-angels-id>' where school_id is null;
alter table profiles alter column school_id set not null;
create index profiles_school_id_idx on profiles (school_id);

-- classes
alter table classes add column school_id uuid references schools(id);
update classes set school_id = '<house-of-angels-id>' where school_id is null;
alter table classes alter column school_id set not null;
create index classes_school_id_idx on classes (school_id);

-- students
alter table students add column school_id uuid references schools(id);
update students set school_id = '<house-of-angels-id>' where school_id is null;
alter table students alter column school_id set not null;
create index students_school_id_idx on students (school_id);