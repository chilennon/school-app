MASTER HANDOFF: Multi-Tenant School Management SaaS
READ THIS CAREFULLY. This is a live, production Next.js PWA SaaS. The pilot tenant is "House of Angels", but the architecture supports unlimited schools. Do not guess. Do not hallucinate. Read the existing files before writing code.

1. The Tech Stack
Framework: Next.js 16 (App Router, Turbopack).

UI: React 19, Tailwind CSS v4, shadcn/ui, Lucide icons, Sonner (toasts).

Backend/DB: Supabase (Postgres, Auth, RLS).

PWA: Serwist.

PDF/Images: jspdf, html2canvas-pro (Critical: standard html2canvas fails on Tailwind v4's oklch colors), number-to-words.

Parsing: xlsx (for Excel imports).

Hosting: Vercel.

2. Immovable Architectural Decisions
These rules are load-bearing. Breaking them will break the SaaS.

A. Auth & Multi-Tenancy
Every table has school_id.

JWT is the source of truth for RLS. We use app_metadata.school_id and app_metadata.role inside the Supabase JWT. NEVER query profiles inside an RLS policy.

Roles: owner (Proprietor), admin (Head Teacher), teacher.

Cookie Auth: We use @supabase/ssr (createBrowserClient and createServerClient). The session is stored in HTTP cookies. Server Actions can read this automatically.

B. The Fees Ledger (Append-Only)
Family-Based: Fees are tied to the family, not individual students.

FIFO Allocation: Payments apply to the oldest debt first, regardless of which term they are currently in. (payments table does not have a term_id).

No Stored Balances: Balance is ALWAYS computed in memory: sum(charges) - sum(payments).

No Delete/Edit: Mistakes are fixed by inserting negative "Void" rows. Families are soft-deleted (deleted_at) to preserve ledger history.

C. Routing & Admin Navigation
NO Separate Admin Routes. Do NOT create new Next.js routes for admin tabs (e.g., /admin/fees). This caused a 2-second white screen delay.

Use URL Search Params: The admin dashboard uses a single page (app/admin/page.tsx) and switches tabs using ?tab=fees or view === "fees". This enables 0ms client-side navigation.

D. Data Fetching (Offline Preparation)
No Server Components for data. Every page that reads data MUST be a Client Component ("use client").

We use useEffect + custom hooks (e.g., useAdminData, useFeesSummary) for reads.

Server Actions are ONLY for writes. (e.g., recordPayment, addFamily).

3. What Is Done (100% Complete)
Auth & Multi-Tenant Core: Signup flow (creates new school), login, role-based routing, RLS.

Teacher Portal: Daily Attendance (Roll Call), Result Compiler (5-step wizard), Submit for Approval.

Admin Portal: Dashboard, CRUD (Teachers/Students/Classes/Subjects), Approvals, Batch PDF Report Cards, Audit Log, Settings.

Owner Portal: Role split, Create Admins, Owner-only visibility for Fees.

Fees Module (COMPLETE):

Family Dashboard (mobile cards + desktop table).

Record Payment (FIFO logic).

Receipt Engine (Exact match to physical paper, PNG/PDF generation, Web Share API).

Excel Import Flow (bulk upload).

Home Dashboard summary card.

4. What Is Left To Do
Phase 1: Offline Data Layer (THE NEXT PRIORITY)
Dexie Integration: Set up IndexedDB to mirror the Supabase schema.

Outbox Pattern: Queue offline writes, sync on reconnect.

Convert Reads: Swap useEffect Supabase fetches to Dexie useLiveQuery.

Sync Worker: Build /api/sync-push and /api/sync-pull.

Phase 2: Academic Reporting
Broadsheet: Landscape A4 PDF of a whole class.

Promotion Flow: End-of-session bulk promotion (Promote/Repeat/Graduate).

Phase 3: Admin Polish
Teacher Attendance: Build a staff_attendance table to track absent teachers.

5. Critical Rules for the Next Agent
Audit Log: Every mutation MUST call logAudit() from lib/audit.ts. Read its signature.

Confirmations: NEVER use window.confirm. Use the ConfirmDialog component.

Mobile Constraints: Every view must be wrapped in <div className="min-h-screen bg-slate-50"><main className="max-w-lg mx-auto p-4 pb-24">.

Tailwind v4: Do not use html2canvas. It does not support Tailwind v4's color space. Use html2canvas-pro.

Receipts: Receipt.tsx uses forwardRef. Do not break the ref, as html2canvas relies on it to capture the DOM node.

Testing Rule:
Before declaring a task done, run npm run build. If it fails, fix it. Then test the specific screen on a mobile viewport in Chrome DevTools.