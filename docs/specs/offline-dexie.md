# Offline Data Layer — Dexie Specification

**Status:** Approved  
**Owner:** Master Architect  
**Approvers:** Product Owner (John)  
**Date:** 2026-10-25  
**Applies to:** Phase 1 — Teacher-first offline

---

## 0. Purpose

This document is the authoritative contract for the Phase 1 offline data layer.
It governs:

- What data lives on the device.
- Where it lives (Dexie schema).
- How writes flow (repository → Dexie → outbox → sync).
- How reads flow (Dexie via `useLiveQuery`, never blocking on network).
- How the push and pull endpoints behave on the server.
- How failures, conflicts, deletions, and migrations are handled.
- What is explicitly out of scope for Phase 1.

If an agent needs to work against this layer and the spec is ambiguous,
the agent stops and raises it. Do not guess.

---

## 1. Scope and non-goals

### 1.1 In scope (Phase 1)

- Teacher portal: Roll Call (attendance), Result Compiler (scores,
  traits, term records), per-student report card PDF generation.
- Reference data: schools, sessions, terms, subjects, grade bands.
- Teacher-to-class assignment via `classes.teacher_id`.
- Local IndexedDB persistence, outbox queueing, background sync.

### 1.2 Out of scope (Phase 1)

- **Fees.** All fees reads and writes remain online-only.
  `recordPayment`, `voidPayment`, `addFamily`, `importFamilies`,
  `updatePaymentNote` stay Server Actions. No Dexie tables, no outbox
  entries, no offline behavior. Fees Agent must not import from
  `lib/db.ts`.
- **Admin portal.** Approvals, batch report cards, CRUD, activity feed
  stay online. Admin does not initialize a Dexie DB in Phase 1.
- **Admin batch report cards.** Remain online-only. Only the
  teacher-side per-student preview is offline-capable.
- **Excel import.** Online-only. Never queued in the outbox.
- **Realtime.** Not used in Phase 1. Outbox + pull cycle is sufficient.

---

## 2. The one-write-path rule

The load-bearing rule. Everything else is derived from it.

- The UI **never** calls Supabase for a write.
- The UI **never** calls `db.<table>.put()` or `.add()` directly.
- The UI calls a repository method, e.g. `teacherRepository.saveAttendance(...)`.
- The repository performs three steps atomically (in the sense of "in one
  transaction inside Dexie, then an async kick"):
  1. Apply the change optimistically to Dexie.
  2. Append an entry to the outbox.
  3. Kick `drainOutbox()` (fire-and-forget).
- Online and offline look identical to the caller. "Online" is just
  "the drain succeeds in the next tick."
- Server Actions and privileged API routes are invoked **by the sync
  worker**, not by the button press.

The only exception is Excel import (§1.2). Its Server Action is called
directly from the UI, requires `navigator.onLine === true`, and never
touches Dexie.

---

## 3. Database lifecycle

### 3.1 Identity

- One Dexie database per user identity. Database name:
  `naijaschool_db_${school_id}_${user_id}`.
- On sign-out, the database is **deleted** (`await db.delete()`).
- Bootstrap requires network. There is no offline-login path in
  Phase 1.

### 3.2 Bootstrap sequence

On successful auth and app entry (as a teacher):

1. Read `{ user_id, school_id, role }` from the session JWT
   (`app_metadata`).
2. If a Dexie DB exists with a different identity embedded in its name,
   delete it.
3. Open the correctly-named DB.
4. If `meta['installed_at']` is absent, this is a fresh bootstrap:
   - Set `meta['user_id']`, `meta['school_id']`, `meta['role']`.
   - Perform a full pull (§7.2) across all tables.
   - Set `meta['installed_at'] = now()`.
5. If `meta['installed_at']` exists, this is a warm start:
   - Perform an incremental pull (§7.2) using stored cursors.
6. Kick `drainOutbox()` regardless (idempotent if empty).

### 3.3 Sign-out

Sign-out is a **destructive** action. Sequence:

1. If online, attempt a full `drainOutbox()`. Wait up to 10 seconds.
2. If any outbox entries remain in state `pending`, `failed`, or
   `rejected`, surface the blocking modal:
   > "You have unsynced data. Signing out will lose these changes.
   >  Sync now / Sign out anyway / Cancel."
   - "Sync now": retry drain; on success continue; on failure show
     toast and stay.
   - "Sign out anyway": proceed to step 3, acknowledging loss.
   - "Cancel": abort sign-out.
3. If any entries are in `in_flight`, **block sign-out** until they
   resolve (success or rejection). Do not show the modal — show a
   spinner. This window is short.
4. Call `supabase.auth.signOut()`.
5. `await db.delete()`.
6. Redirect to `/sign-in/staff`.

The Teacher UI Agent implements the modal. The sync worker exposes
`getOutboxStatus()` returning counts by state.

---

## 4. Dexie tables

Thirteen tables. Five reference (read-only, pulled, never written
locally), eight sync (pulled and locally written via outbox).

Every sync table carries the following sync-metadata columns, which are
**managed by the sync worker, never by the repository**:

| Column | Type | Meaning |
|---|---|---|
| `id` | string (uuid) | Primary key |
| `school_id` | string | Tenant |
| `server_updated_at` | string (ISO) | Authoritative conflict clock. Set by server trigger. |
| `client_updated_at` | string (ISO) | When the client last wrote locally. Audit only, never used for LWW. |
| `client_mutation_id` | string \| null | UUID of the last outbox entry that produced this row. Audit/idempotency. |
| `deleted_at` | string \| null | Soft-delete tombstone. |

Reference tables carry `id` and `deleted_at`. They do not carry the
other four columns.

### 4.1 Reference tables (read-only)

| Table | Pull scope | Indexed columns |
|---|---|---|
| `schools` | own `school_id` | `id` |
| `sessions` | own `school_id` | `id`, `school_id`, `is_current` |
| `terms` | sessions of own school | `id`, `session_id`, `[session_id+sequence]` |
| `subjects` | own `school_id` | `id`, `school_id`, `[school_id+display_order]` |
| `grade_bands` | own `school_id` | `id`, `school_id`, `[school_id+display_order]` |

### 4.2 Sync tables (written via outbox)

| Table | Pull scope | Natural / match key | Indexed columns |
|---|---|---|---|
| `classes` | `teacher_id = current user` | `id` | `id`, `school_id`, `teacher_id`, `[school_id+teacher_id]`, `deleted_at`, `server_updated_at` |
| `class_subjects` | classes taught by user | `id` | `id`, `class_id`, `session_id`, `[class_id+session_id]`, `deleted_at`, `server_updated_at` |
| `enrolments` | classes taught by user | `id` | `id`, `class_id`, `student_id`, `session_id`, `status`, `[class_id+session_id]`, `[student_id+session_id]`, `deleted_at`, `server_updated_at` |
| `students` | students enrolled in taught classes | `id` | `id`, `school_id`, `name`, `deleted_at`, `server_updated_at` |
| `scores` | enrolments in taught classes | `[enrolment_id+class_subject_id+term_id]` | `id`, `enrolment_id`, `class_subject_id`, `term_id`, `[enrolment_id+term_id]`, `[enrolment_id+class_subject_id+term_id]`, `deleted_at`, `server_updated_at` |
| `trait_ratings` | enrolments in taught classes | `[enrolment_id+term_id+trait_domain+trait_key]` | `id`, `enrolment_id`, `term_id`, `[enrolment_id+term_id]`, `deleted_at`, `server_updated_at` |
| `term_records` | enrolments in taught classes | `[enrolment_id+term_id]` | `id`, `enrolment_id`, `term_id`, `status`, `[enrolment_id+term_id]`, `deleted_at`, `server_updated_at` |
| `attendance_logs` | enrolments in taught classes | `[enrolment_id+date]` | `id`, `enrolment_id`, `date`, `[enrolment_id+date]`, `deleted_at`, `server_updated_at` |

### 4.3 Infrastructure tables

| Table | Purpose | Indexed columns |
|---|---|---|
| `outbox` | Pending write intents | `id`, `status`, `created_at`, `[status+created_at]`, `[table_name+match_key]` |
| `meta` | Cursors, identity, lifecycle | `key` (primary) |

---

## 5. Outbox

### 5.1 Shape

Each outbox entry represents **one intent** — one repository call the
user made. Fields:

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Client-generated. Idempotency key. `crypto.randomUUID()`. |
| `school_id` | string | From JWT. |
| `user_id` | string | From JWT. |
| `table_name` | string | Must be one of §4.2. |
| `match_key` | string | Serialized natural key, format below. |
| `payload` | object | Full row the client believes the server should hold. |
| `client_updated_at` | string (ISO) | When the repository applied the local write. |
| `created_at` | string (ISO) | When the entry was enqueued. Authoritative for FIFO ordering. |
| `status` | `'pending' \| 'in_flight' \| 'failed' \| 'rejected'` | |
| `attempts` | number | Incremented on each transient failure. |
| `last_error` | string \| null | Server message from the last failure. |
| `rejected_reason` | string \| null | Set once when `status='rejected'`. |

**`match_key` format.** Deterministic serialization of the match key
columns in declaration order, joined by `|`:

- `scores`: `${enrolment_id}|${class_subject_id}|${term_id}`
- `attendance_logs`: `${enrolment_id}|${date}`
- `term_records`: `${enrolment_id}|${term_id}`
- `trait_ratings`: `${enrolment_id}|${term_id}|${trait_domain}|${trait_key}`
- `enrolments`, `students`, `classes`, `class_subjects`: `id` (they key on PK)

The sync worker and the server must agree on this format. It is
**not** part of the wire protocol — the server computes the same key
from the payload. The match_key exists only so the client can answer
"is this local row pending?"

### 5.2 Ordering

**Strict global FIFO by `created_at`.** Not per-table, not per-match-key.

Reasons:

- "Submit for approval" (`term_records.status='submitted'`) must land
  after the scores it refers to. Global FIFO gives that for free.
- Per-key ordering requires dependency computation. Not worth it at
  our scale.
- A stuck item blocks the queue. Mitigation: skip-after-N (§9.3) moves
  the item out of `pending` so the queue unblocks.

### 5.3 Mutations of the outbox

- **Append**: only repository methods append.
- **Update**: only the sync worker updates `status`, `attempts`,
  `last_error`, `rejected_reason`.
- **Delete**: only the sync worker deletes on `applied`.
- The UI never touches `outbox` directly. It reads aggregate counts
  via `useSyncStatus()` (§10).

---

## 6. Push algorithm

### 6.1 Endpoint

`POST /api/sync-push`

Auth: bearer session token (user-scoped Supabase client, **not**
service-role). RLS applies to every write inside the endpoint.

Request:
