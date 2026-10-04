# 001 — Multi-tenant model

**Date:** September 2026
**Status:** Locked

## Context

The app is built for one school initially (House of Angels), but expected to grow to 3–30 schools. Two options were considered:

1. **Single-tenant** — one deployment per school. Simpler, no isolation logic.
2. **Multi-tenant** — one deployment, many schools, isolated by `school_id`.

## Decision

Multi-tenant from day one. Every table has `school_id`. Every query filters by it. RLS enforces isolation at the database level.

## Consequences

**Good:**
- School #2 signs up by filling a form. No redeploy, no new database.
- Updates ship to all schools instantly.
- One codebase, one Vercel project.

**Costs:**
- Every table, query, and RLS policy must respect `school_id`. A single missed filter is a data leak.
- Testing must always include the "two schools" check.
- The `school_id` on every row is ~15% storage overhead (negligible at this scale).

**Non-negotiable:** if you ever think "we only have one school, let's skip `school_id` here," stop. That's the decision that would make multi-tenancy a rewrite.