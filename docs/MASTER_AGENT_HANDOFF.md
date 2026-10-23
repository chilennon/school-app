MASTER AGENT HANDOFF: Multi-Tenant School Management SaaS
READ THIS ENTIRE DOCUMENT BEFORE WRITING ANY CODE.
This is a live, production Next.js PWA SaaS. The pilot tenant is "House of Angels" (a real primary school in Nigeria). The architecture is built to support unlimited schools. You are inheriting a codebase that is 85% complete. Do not guess. Do not hallucinate. Read the existing files before proposing changes.

1. The Product Vision & Context
What it is: A mobile-first, offline-first school management platform built for Nigerian primary schools.

The Target User: Teachers on low-end Android phones with poor internet, and Admins/Bursars who currently use Excel/WPS spreadsheets to run the school.

The Wedge: We beat Excel and competitors (like Edves) through speed at the gate, zero data loss (offline mode), and integrated workflows (Attendance + Results + Fees in one app).

Required Reading (The Blueprints):

NaijaSchool_OS_Blueprint.pdf (The strategic vision and offline laws).

Fees-Workflow-Desktop-to-Mobile.pdf (The transition from Excel to the app).

AGENTS.md / architecture.md (The foundational rules).

2. The Tech Stack
Framework: Next.js 16 (App Router, Turbopack).

UI: React 19, Tailwind CSS v4, shadcn/ui, Lucide icons, Sonner (toasts).

Backend: Supabase (PostgreSQL, RLS, Auth, RPC).

PWA: Serwist (caches app shell, blocks data caching).

Files/PDFs: jspdf, html2canvas-pro (CRITICAL: standard html2canvas breaks on Tailwind v4's oklch colors), number-to-words, xlsx.

3. Immovable Architecture & Security
These rules are load-bearing. Breaking them will break the SaaS.

A. Multi-Tenancy & Authentication
Every single table has a school_id column. No exceptions.

JWT is the source of truth for RLS. We use app_metadata.school_id and app_metadata.role inside the Supabase JWT.

The Infinite Recursion Rule: NEVER query the profiles table inside an RLS policy. This causes a stack overflow. Use the JWT metadata or helper functions (my_school_id(), is_school_admin()).

Roles: owner (Proprietor), admin (Head Teacher), teacher. Only owner sees Fees and creates Admins.

Auth: Uses @supabase/ssr. Sessions are stored in HTTP cookies, NOT localStorage.

B. Data Fetching (Client-First for Offline)
No Server Components for data. Every page that reads data MUST be a Client Component ("use client").

We use useEffect + custom hooks for reads.

Why? We are about to integrate Dexie (IndexedDB). If data fetching happens on the server, the app breaks when offline. The UI must load instantly from memory, then fetch/sync in the background.

C. Mutations & The Repository Pattern
Mutations use Server Actions (e.g., app/admin/fees/actions.ts).

The Repository Abstraction: The UI never calls Supabase directly for writes. It calls lib/feesRepository.ts (or similar).

Why? When Dexie arrives, we only change the internals of the repository to write to IndexedDB + Outbox. The UI components remain untouched.

D. The Fees Ledger (Append-Only)
Family-Based: Fees are tied to the family, not individual students. Siblings share a ledger.

No Stored Balances: Balance is ALWAYS computed in memory: sum(charges) - sum(payments).

No Delete/Edit: Mistakes are handled via negative reversing entries (Voids). Families are soft-deleted (deleted_at).

FIFO: When a payment is made, it clears the oldest term's debt first.

4. The Routing & UI Shell
NO Separate Admin Routes: Do NOT create Next.js routes like /admin/fees. This causes a 2-second white-screen delay.

URL Search Params: The admin dashboard uses a single page (app/admin/page.tsx) and switches tabs using ?tab=fees or view === "fees". This enables 0ms client-side navigation.

Responsive Shell: <main className="max-w-lg md:max-w-7xl mx-auto">.

On Mobile: Cards, stacked vertically.

On Desktop: Dense grids (min-w-[900px] with overflow-x-auto), side-by-side metrics.

5. What Is Done (100% Complete)
Auth & Multi-Tenant Core: Signup (creates school, owner, default session/terms), login, RBAC, RLS.

Teacher Portal: Daily Attendance (Roll Call), Result Compiler (5-step wizard), Submit for Approval.

Admin Portal: Dashboard, CRUD (Teachers/Students/Classes/Subjects), Approvals, Batch PDF Report Cards, Audit Log, Settings.

Owner Portal: Role split, Create Admins, Owner-only visibility for Fees.

Fees Module:

Dashboard (Mobile cards + Desktop TanStack Grid).

Record Payment (FIFO, Server Actions).

Receipt Engine (ForwardRef + html2canvas-pro, Web Share API).

Excel Import: Idempotent Postgres RPC (import_families_bulk) that prevents duplicate family names/phones and generates atomic receipt numbers.

Merge Tool (planned): Re-points foreign keys of duplicates to the primary family, then soft-deletes.

6. What Is Left To Do (The Roadmap)
Phase 1: Offline Data Layer (THE NEXT BIG THING)
This is why the architecture was built this way. Dexie must be integrated next.

Dexie Integration: Set up IndexedDB to mirror the Supabase schema.

Outbox Pattern: Queue writes offline, sync on reconnect.

Convert Reads: Swap useEffect Supabase fetches to Dexie useLiveQuery.

Sync Worker: Build /api/sync-push and /api/sync-pull.

Rule: Imports (Excel) must require internet. Do not sync bulk imports via the outbox.

Phase 2: Academic Reporting
Broadsheet: Landscape A4 PDF of a whole class (students vs subjects).

Promotion Flow: End-of-session bulk promotion of students (Promote/Repeat/Graduate).

Phase 3: Admin Polish & NDPA
Teacher Attendance: Build a staff_attendance table and the logic to mark it (for the Home dashboard alert).

NDPA Compliance: Privacy policy page, data retention cron jobs.

7. Critical Rules for the Agent
Audit Log: Every mutation MUST call logAudit() from lib/audit.ts.

Confirmations: NEVER use window.confirm or alert. Use the ConfirmDialog component.

Testing: Run npm run build before declaring a task done. Test on a mobile viewport in Chrome DevTools.

Respect the User: The user (John) has an excellent grasp of the architecture. They have caught critical bugs (Server Component delays, RLS recursion, RPC duplicates). Listen to them. They are the Product Owner.

8. Key Files to Read First
lib/supabase/server.ts & lib/supabaseClient.ts (The dual-client architecture).

app/admin/page.tsx (The responsive shell and tab router).

lib/feesRepository.ts (The abstraction layer).

app/admin/fees/actions.ts (The Server Actions).

app/admin/fees/import/page.tsx (The RPC integration).