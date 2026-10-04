
---

## `docs/architecture.md`

```markdown
# Architecture

## Shape


┌──────────────────────────────────────────────────────────┐
│ User's Phone (PWA) │
│ │
│ ┌────────────────┐ ┌────────────────────────────┐ │
│ │ React UI │ ──→ │ Service Worker (Serwist) │ │
│ │ (Next.js │ │ - caches app shell only │ │
│ │ App Router) │ │ - NEVER caches data │ │
│ └────────┬───────┘ └────────────────────────────┘ │
│ │ │
│ ↓ Supabase JS client │
└───────────┼──────────────────────────────────────────────┘
│
│ HTTPS
↓
┌──────────────────────────────────────────────────────────┐
│ Supabase │
│ │
│ ┌─────────────┐ ┌──────────────┐ ┌─────────────────┐ │
│ │ Postgres │ │ Auth │ │ RLS │ │
│ │ 12 tables │ │ JWT w/ │ │ every query │ │
│ │ + audit │ │ app_metadata│ │ filtered by │ │
│ │ + attend. │ │ school_id │ │ school_id │ │
│ └─────────────┘ └──────────────┘ └─────────────────┘ │
│ │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Edge Functions (Next.js API) │ │
│ │ /api/admin → privileged CRUD via service key │ │
│ │ /api/teacher → scoped teacher actions │ │
│ │ /api/schools/register → school signup │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘



## The critical property

**Reads go from the phone directly to Supabase.** They don't pass through Vercel. This means:

1. Student data never lands on Vercel's servers.
2. Latency is one hop, not two.
3. RLS is the enforcement layer, not application code.

**Writes go through Vercel API routes** only when the write requires service-role privileges (creating auth users, resetting passwords, verifying cross-table constraints). Everything else writes directly via the Supabase client.

## Layers

**Presentation (`app/*/page.tsx`, `_components/*`)**
- Client components only for data screens.
- Read hooks from `_hooks/`.
- Render from those hooks.

**State (`app/*/_hooks/*`)**
- One concern per hook.
- Fetches, transforms, exposes typed state + actions.
- Never render.

**Logic (`app/*/_lib/*`, `lib/*`)**
- Pure functions, no React.
- Data fetchers, computations, formatters.

**Data (Supabase)**
- Postgres + RLS.
- Multi-tenant via `school_id` on every table.
- JWT `app_metadata` carries tenant + role for RLS.

**Privileged operations (`app/api/*`)**
- Runs with service-role key (bypasses RLS).
- Verifies JWT + role + school_id on every request.
- Writes audit_log for every mutation.

## PWA / offline

**Current state:** app shell caches, data does not.

- Service worker: 48 URLs precached (~2.2 MB): HTML, JS, CSS, icons, fonts.
- Data paths (`/api/*`, `*.supabase.co`) are `NetworkOnly` — never cached.
- Offline behavior: the app opens, but any data fetch fails.

**Planned (Phase 3):** Dexie local database + outbox pattern + sync endpoints. See `docs/specs/offline-dexie.md`.

## File structure


app/
├── page.tsx Landing (role picker)
├── layout.tsx Root layout
├── sw.ts Service worker source
├── admin/ Admin/Owner dashboard
│ ├── page.tsx Orchestrator (single return, view-switched)
│ ├── SettingsTab.tsx
│ ├── _lib/ Pure logic
│ ├── _hooks/ Reactive state
│ └── _components/ Presentation
│ ├── tabs/ Home, Students, Approvals, More
│ ├── sections/ Teachers, Admins, Subjects, Classes
│ └── approvals/ Approval-specific components
├── teacher/ Teacher dashboard
│ ├── page.tsx
│ ├── _lib/
│ ├── _hooks/
│ ├── _components/
│ │ ├── tabs/ Home, Scores, Attendance, Profile
│ │ ├── scores/ Class pills, term tabs, roster
│ │ └── attendance/ Roll call screen
│ └── results/ Result compiler (5-step wizard)
│ ├── page.tsx
│ ├── _lib/
│ ├── _hooks/
│ └── _components/
├── signup/school/page.tsx School signup
├── sign-in/staff/page.tsx
└── api/
├── admin/route.ts Privileged admin actions
├── teacher/route.ts Teacher actions
└── schools/register/route.ts

components/
├── ui/ shadcn primitives
├── ServiceWorkerRegister.tsx

hooks/ Cross-app hooks (useSchoolConfig, etc.)
lib/ Cross-app logic (supabaseClient, reportCardPdf, audit)
types/ Shared types



## Data flow examples

**Teacher enters a score:**

RollCallScreen / CompilerWizard
→ onSave(updatedStudent)
→ teacher/page.tsx handleSave()
→ saveResultToSupabase() (in _hooks/useSaveResult.ts)
→ Supabase client upserts scores, traits, term_records, students
→ RLS enforces school_id + teacher ownership
→ Local state patched, toast shown



**Admin approves a result:**


ApprovalsTab → tap Approve
→ confirmation dialog
→ callAdminApi("approve-student", {...})
→ /api/admin/route.ts validates JWT + role + school
→ upserts term_records with status="approved"
→ writes audit_log row
→ client refreshes pending list



**Teacher marks attendance:**

RollCallScreen → Save
→ handleSaveAttendance(statuses)
→ callTeacherApi("save-attendance", { classId, date, entries })
→ /api/teacher/route.ts validates class + teacher
→ upserts attendance_logs (unique on enrolment_id, date)
→ writes audit_log
→ attendance.refresh() → AttendanceTab shows today's summary


