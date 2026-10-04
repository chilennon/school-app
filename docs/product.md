# Product

## What it is

A mobile-first, PWA-installable school management system for Nigerian primary schools. Replaces the paper registers, Excel sheets, and manual report-card compilation that schools currently use.

## Who uses it

**Owner** (proprietor or proprietor-appointed superuser)
- One per school
- Creates admins, teachers, sees everything
- The only role with fee visibility (when fees ship)

**Admin** (head teacher, trusted staff)
- Full CRUD on students, classes, subjects, teachers
- Approves submitted results
- Prints report cards
- No fee visibility

**Teacher** (subject teacher or form teacher)
- Marks daily attendance for their class
- Enters scores for their subjects
- Writes remarks for their class
- Submits class results for approval
- Prints report cards for their class

**Bursar** (planned, not yet implemented)
- Fee collection, debtors list, receipts
- Own dashboard, not part of admin console

## Core features (shipped)

- **Result compilation** — 5-step wizard: Details → Attendance → Subjects → Traits → Remarks
- **Auto-computed** totals, grades, class positions, cumulative averages
- **Daily attendance** — mark all present, flip the few absent, save
- **Approval workflow** — teacher submits, admin approves, reopen if needed
- **Batch report card printing** — PDF for a whole class
- **Multi-tenant** — many schools on one app, fully isolated
- **School signup** — a new school can onboard itself
- **Activity feed** — admins see what other admins did
- **Audit log** — every action recorded with actor + timestamp

## What's planned

- **Admin restructure** — operational dashboard, class detail pages, student detail pages
- **Fee module** — charges, payments, debtors, receipts, result gating (Phase 2)
- **Offline data** — Dexie + sync (Phase 3)
- **Parent portal** — read-only access (Phase 3+)
- **Bursar dashboard** — separate role + UI (Phase 2)
- **Broadsheet** — landscape class-wide grid
- **Promotion flow** — end-of-session student promotion

## What it deliberately does not do

- No CBT / online exams
- No timetable generation
- No library management
- No payroll
- No SMS broadcast
- No native mobile app
- No student photos (in v1)
- No analytics dashboards

These were deferred in the original blueprint and remain deferred.

## The product's one-line pitch

"Compile a whole class's report cards on your phone in under an hour, without internet, and print them."