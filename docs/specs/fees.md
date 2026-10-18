# Fees Module

**Status:** 🧊 Not built — handoff ready
**Build time:** ~2–3 weeks
**Owner-only feature** (plus the bursar role, which doesn't exist yet)
**When to build:** Now. The proprietor asked for it and the current spreadsheet is at 71 families and growing.

---

## The current workflow (what we're replacing)

The school tracks fees in a single Excel workbook with three sheets:

**Sheet 1 — Family Fee Register**
- One row per family
- `Pupils/Children` column lists all children in that family
- Grouped by class for browsing (Playgroup, KG1, KG2, Nursery 1, Nursery 2, Basic 1, Basic 2…)
- Columns: S/N · Student Name · Class · Paid · Outstanding · Payment Status
- Payments are recorded against the family, not per child

**Sheet 2 — Payment Transactions** (the ledger)
- Every payment is a new row
- Columns: Pupils/Children · Total Fees Due · Total Amount Paid · Balance Owed · Payment Status · Payment Method · Receipt/Reference · Remarks
- Payment methods: Cash, Transfer, POS, Bank Transfer
- Adjustments and corrections are typed into the Remarks column manually ("removed 7,000, to balance 35,000", "excluding party 30,000 plus discount of...")

**Sheet 3 — Family Summary** (the dashboard)
- Total Families Recorded: 71
- Total Fees Due: ₦13,990,500
- Total Amount Paid: ₦8,833,500
- Total Outstanding Balance: ₦5,193,000
- Families Fully Paid: 9
- Families with Part Payment: 58
- Families Not Paid: 4

### Why this workflow is painful

1. **Finding a family requires scrolling.** 71 rows on a laptop is bad. On a phone it's unusable.
2. **Every amount is typed.** No quick buttons, no auto-fill, no keyboard shortcut.
3. **Math is manual.** Balance is a formula. When someone deletes a row or inserts one, the formula breaks. Nobody notices until a parent disputes a balance.
4. **Partial payments create ambiguity.** "Removed 7,000, to balance 35,000" is a hand-written correction. There's no way to reconstruct what actually happened.
5. **No mobile.** Not that a mobile Excel exists — the layout wouldn't work. Columns are too wide, fonts too small, keyboard too fiddly.
6. **No receipts.** Receipt numbers are typed into the Reference column. No sequential numbering. No printable receipt.
7. **No reminders.** Calling a debtor requires copying their phone number into a phone app.
8. **Two people can't work on it.** The bursar has the laptop. If the proprietor wants to see the balance, they wait.
9. **No audit trail.** If a number is edited, the old value is gone.
10. **Data entry is single-track.** You're either looking at the register, or the ledger, or the summary — never all three.

### The rule for this module

**Do not rebuild the spreadsheet on mobile.** A mobile spreadsheet is worse than a laptop spreadsheet.

The goal is to eliminate the spreadsheet by replacing each of its functions with a purpose-built mobile interaction:

| Spreadsheet does this | Mobile app does this instead |
|---|---|
| Scroll to find family | Search by name / reg no / phone → one result |
| Type amounts | Tap ₦5k / ₦10k / ₦20k / ₦50k quick buttons |
| Compute balance manually | Computed on read; can't be wrong |
| Type receipt numbers | Auto-generated sequential, printed as PDF/PNG |
| Copy phone into dialer | `tel:` link — tap to call |
| WhatsApp reminders manually | One-tap template with balance pre-filled |
| Delete a wrong row | Append-only ledger. Corrections are new rows. |
| Two people can't use it | Real-time sync via Supabase |
| Numbers get overwritten | Every change is a new row + audit log entry |

---

## The core modeling decision

**The family is the payment unit. Not the student.**

This is what the current spreadsheet does and it's correct:
- One family may have multiple children in different classes
- Fees are calculated per child per class
- The family pays a combined amount

### Two entity types

**`families`** — the payer. Has a name (usually the guardian's name) and a contact.

**`family_students`** — links students to families. A student belongs to exactly one family. A family can have many students.

Then the existing `students` table gains a `family_id` FK. Migration is a backfill: create one family per unique guardian phone, link students.

---

## Data model

### New tables

```sql
-- The payment unit
create table families (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  name text not null,                    -- e.g. "Nwachukwu Family"
  guardian_name text not null,           -- primary contact person
  guardian_phone text not null,
  guardian_phone_alt text,
  notes text,                            -- free-text: discounts, special arrangements
  created_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now()
);

create index families_school_idx on families (school_id);
create index families_phone_idx on families (guardian_phone);

-- Fee structure: what each class owes per term
create table fee_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  term_id uuid not null references terms(id),
  class_id uuid references classes(id),  -- null = applies to all classes
  name text not null,                    -- "Tuition", "Bus", "Feeding", "PTA Levy"
  amount numeric not null,
  is_optional boolean default false,
  display_order int default 0,
  created_at timestamptz not null default now()
);

-- Which optional items a specific student is enrolled for
create table student_fee_optins (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  enrolment_id uuid not null references enrolments(id),
  fee_item_id uuid not null references fee_items(id),
  unique (enrolment_id, fee_item_id)
);

-- APPEND-ONLY. What a family owes, generated at term start.
-- Corrections are new rows (positive or negative amounts).
create table charges (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  family_id uuid not null references families(id),
  term_id uuid not null references terms(id),
  fee_item_id uuid references fee_items(id),
  description text not null,             -- "Tuition — Primary 4A — Chidi"
  amount numeric not null,               -- negative for discounts/waivers
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index charges_family_term_idx on charges (family_id, term_id);

-- APPEND-ONLY. Every payment, always a new row. Never updated.
create table payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  family_id uuid not null references families(id),
  term_id uuid not null references terms(id),
  amount numeric not null,
  method text not null check (method in ('cash','transfer','pos','other')),
  reference text,                        -- bank ref / teller no
  receipt_no text not null,              -- sequential, unique per school per session
  paid_on date not null,
  note text,
  recorded_by uuid not null references profiles(id),
  device_id text,
  created_at timestamptz not null default now()
);

create index payments_family_term_idx on payments (family_id, term_id);
create index payments_school_receipt_idx on payments (school_id, receipt_no);

-- Sequential receipt counter per school per session
create table receipt_counters (
  school_id uuid not null references schools(id),
  session_id uuid not null references sessions(id),
  last_number int not null default 0,
  primary key (school_id, session_id)
);