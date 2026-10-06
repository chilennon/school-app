# AGENTS.md

**Read this first.** Everything below is the source of truth for how this codebase works and how to change it safely.

---

## What this application is

A school management system for Nigerian primary schools. Mobile-first, installable as a PWA, designed for teachers and admins on low-end Android phones with unreliable internet.

**Pilot user:** House of Angels School (owner's family school).
**Growing into:** 3–30 schools under one Supabase project, each isolated by `school_id`.

Read `docs/product.md` for the full product overview, user roles, and feature list.

---

## Stack

- **Framework:** Next.js 16.3.3 (Turbopack, App Router)
- **UI:** React 19 · TypeScript 5 · Tailwind CSS v4 · shadcn/ui · Lucide icons
- **Toasts:** Sonner
- **Database + Auth:** Supabase (Postgres, Auth, Row Level Security)
- **PDF:** jsPDF + jspdf-autotable
- **PWA:** Serwist 9.5.12 (configurator mode)
- **Hosting:** Vercel (auto-deploy on `git push origin main`)

---

## Database

Full schema, relationships, and RLS rules in `docs/database.md`.

**Key concepts:**
- Every table has `school_id`. Multi-tenant from day one.
- Enrolment-centric model: `students` are not "in" a class, they have `enrolments` that place them in a class for a session.
- Scores, traits, and term records attach to **enrolment**, not student.

---

## Authentication model

- Email + password via Supabase Auth.
- JWT carries `app_metadata.role` and `app_metadata.school_id`. Set only by service role at user creation.
- Client reads from `profiles` table for UI, but **RLS reads from the JWT** — never from `profiles`.
- Roles: `owner` (proprietor, one per school), `admin` (head teacher or trusted staff), `teacher`. `bursar` is planned but not yet implemented.

Full rules in `docs/security.md`.

---

## Architectural rules (do not break)

These are load-bearing decisions. Changing them requires asking first.

1. **No Server Components in teacher/admin routes.** Every data page is `"use client"`. Student data must never be rendered server-side — Vercel edge caches would leak it.

2. **Every query filters by `school_id`.** RLS enforces it server-side, but the client also filters explicitly for defense in depth and speed. Both layers are required.

3. **RLS helper functions never query `profiles`.** They read from `auth.jwt()`. Querying `profiles` from an RLS policy causes infinite recursion.

4. **No database trigger creates profiles.** Profile creation is explicit in API routes with proper rollback. This gives real error messages.

5. **Every mutation is audit-logged.** Use `logAudit()` from `lib/audit.ts`. Every new API action needs an audit entry.

6. **Every mutation uses `<ConfirmDialog>`.** Not `window.confirm`. One shared dialog driven by state.

7. **Component structure:**
   - `_lib/` = pure logic, no React
   - `_hooks/` = reactive state, one concern each
   - `_components/` = presentation only
   - `page.tsx` = orchestration

8. **The service worker never caches data.** `app/sw.ts` uses `NetworkOnly` for `/api/*` and `*.supabase.co`. Data caching belongs to Dexie (not yet built).

9. **Mobile-first, always.** Design at 360px width. Tap targets ≥ 44px. Inputs at 16px minimum (prevents iOS zoom).

10. **The camera/mic/geolocation are not used.** Don't add permissions.

---

## Coding conventions

- TypeScript strict mode. No `any` unless unavoidable — if you must, comment why.
- Tailwind only for styling. No CSS modules, no styled-components.
- Lucide for all icons. No emoji in product UI.
- Function components only. No class components.
- Named exports for components. Default export only for `page.tsx`.
- Toasts via `toast.success()` / `toast.error()` from `sonner`.
- Async errors are always caught and shown to the user — never silently swallowed.
- Never log row contents (PII). Log IDs and error messages only.

---

## Commands

```bash
npm run dev          # Dev server (SW disabled)
npm run build        # Production build + SW generation
npm start            # Serve production locally
npm run lint         # ESLint


Testing the PWA: the service worker only works with npm start (not npm run dev). Always test offline behavior on the production build.

Resetting the SW during dev: Chrome DevTools → Application → Service Workers → Unregister, then Application → Storage → Clear site data, then hard reload.