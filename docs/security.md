
---

## `docs/security.md`

```markdown
# Security

## Trust boundaries

1. **Supabase (server)** — source of truth. RLS enforces isolation.
2. **The device (browser)** — a copy of the teacher's own data. Not a shared secret.
3. **The network** — HTTPS via Vercel and Supabase.

## Authentication

- Email + password via Supabase Auth.
- JWT carries `app_metadata.role` and `app_metadata.school_id`.
- These fields are set **only** by the service role at user creation. Users cannot forge them.
- Client reads from `profiles` table for UI. RLS reads from JWT for enforcement.

## Roles

| Role | Access |
|---|---|
| `owner` | Everything. Creates admins. Sees fees. One per school. |
| `admin` | Students, classes, subjects, teachers. Approves results. No fees. |
| `teacher` | Their own classes and subjects only. |
| `bursar` (planned) | Fees only. No results. |

## RLS model

Two layers on every table:

**Layer 1 — tenant isolation** (school_id)
```sql
using (school_id = my_school_id())

Layer 2 — role isolation (per-table)

Read: teachers see only their classes; admins see all

Write: teachers write only their own class's data; admins write all

Non-negotiable: every table has school_id. Every policy checks it. Test with two schools after every change.


NDPA compliance (Nigeria Data Protection Act 2023)
The app processes children's personal data — the highest-risk category under NDPA.

Current status:

✅ Audit log of admin actions

✅ RLS isolation between schools

✅ HTTPS everywhere

⚠️ No privacy notice page

⚠️ No parental consent capture at admission

⚠️ No retention policy documented

⚠️ No breach playbook

⚠️ Device-level encryption not yet built (waiting on Dexie)

The school is the data controller. We are the processor. Legal decisions (deletion requests, subpoenas) go to the school.

Grades and enrolment run on legal obligation, not consent.
Optional extras (WhatsApp reminders) run on consent, withdrawable.

Required before shipping to a second school:

Privacy notice page at /privacy, linked from sign-in

Parental consent captured at admission (physical form or documented phone call)

Data retention policy written and applied

Breach playbook (one page)

NDPC registration if threshold met

What's allowed
Querying any table filtered by school_id

Writing audit_log entries

Reading public config (schools.name, grade_bands)

Client-side reads of the user's own school data

What's forbidden
Sending data through Vercel Edge / Server Components

Logging row contents (names, phones, scores, remarks) to console or external services

Storing the service-role key anywhere in the client bundle

Trusting client-supplied school_id — always derive from JWT

Querying profiles from RLS policy (causes recursion)

Deleting financial records (append-only ledger)

Server-side validation
Every API route in app/api/* must:

Verify the JWT via supabase.auth.getUser() (not just decode)

Look up the caller's role and school_id from profiles

Reject if role doesn't match the action

Filter every query by school_id

Write an audit_log entry

Return specific errors (never "Something went wrong")

Incident response
If a breach is suspected:

Tell the school immediately (they notify the NDPC within 72h)

Preserve logs — don't rotate them

Document what was exposed, to whom, when

If a device is compromised → admin revokes the user's auth via /api/admin (session invalidates on next request)