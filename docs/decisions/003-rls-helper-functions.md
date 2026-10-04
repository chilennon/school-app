# 003 — RLS helper functions

**Date:** September 2026
**Status:** Locked

## Context

Many policies need the same logic:
- "Is the caller a teacher of this class?"
- "Is the caller the owner of this class-subject?"
- "Is this enrolment in a class the caller teaches?"

Duplicating this SQL in every policy is fragile.

## Decision

Define helper functions in Postgres once. Reference them from policies.

- `my_school_id()` — caller's school_id from JWT
- `is_school_admin()` — caller's role is admin or owner
- `teaches_class(class_id)` — form teacher OR subject teacher
- `owns_class_subject(class_subject_id)` — owns the class-subject row
- `teaches_enrolment(enrolment_id)` — teaches the enrolment's class

## Consequences

**Good:**
- One source of truth for authorization logic
- Policies stay short and readable
- Fixes propagate to every policy at once

**Costs:**
- Function definitions must be maintained in the SQL editor (no migration tool — see `docs/migrations.md`)
- Changes to helper logic affect every policy immediately (test carefully)

**Warning:** `teaches_class`, `owns_class_subject`, and `teaches_enrolment` are `SECURITY DEFINER` — they run as the function owner, not the caller. They must never be exposed to unauthenticated users. Current usage is safe (RLS policies only).