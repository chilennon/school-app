# Security Handoff: House of Angels School Portal

**Purpose:** Give the next engineer/agent an architecture map, current security review, and a practical target design. This is a static review of the repository, not a penetration test or a verified review of the live Supabase project.

**Review context:** Next.js 16.3.3 App Router, React 19, TypeScript, Supabase Auth/Postgres, multi-tenant school records. See `package.json`. The repo has a local Next.js instruction in `AGENTS.md`: read the installed docs under `node_modules/next/dist/docs/` before changing Next.js code. The installed data-security/authentication guides recommend centralizing server-side auth and authorization and returning only minimal data to the client.

## Executive assessment

The build has some sound foundations: the privileged Supabase service-role key is referenced only in server route handlers; the admin and teacher routes authenticate the bearer token and load the caller's role/school from `profiles`; most privileged data mutations are scoped to `callerSchoolId`; and teacher mutations commonly verify class ownership. These are meaningful controls.

The primary unresolved risk is that the browser also accesses Supabase directly with the public anon key, while the repository contains no schema migrations or RLS policy definitions. `docs/UI_HANDOFF.md` says RLS isolation was verified across three schools, but that cannot be independently confirmed from the present source tree. Do not assume client-side table access is safe until the deployed policies and grants are reviewed and tested.

Other material issues to address: unrestricted privileged public signup, weak runtime validation on API inputs (especially the attendance endpoint), temporary credentials returned in API responses, and debug/error detail exposure. Treat the application as handling sensitive student records and plan remediation before wider production use.

## Architecture map

### Authentication and roles

- `lib/supabaseClient.ts` creates a browser Supabase client from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Those values are public by design; the anon key is safe only when database grants and RLS are correct.
- Staff sign in from `app/sign-in/staff/page.tsx` using Supabase password auth, then look up their `profiles` row and route according to its role.
- `app/api/admin/route.ts` and `app/api/teacher/route.ts` accept a bearer access token, validate it with `supabase.auth.getUser()`, then fetch `role`, `school_id`, and `name` from `profiles` with a service-role client. API authorization should continue to trust the server-fetched profile rather than client-provided role/school values.
- There is no Next.js `proxy.ts`/middleware auth gate in the scanned source. UI routes should be treated as presentation only; every data access path must enforce authorization itself. Hiding a page is not access control.

### Data access paths

- Browser code calls Supabase directly across `app/admin`, `app/teacher`, and `hooks` for profiles, students, classes, enrolments, terms, results, scores, traits, attendance and audit activity. Relevant entry points include `app/admin/_hooks/useAdminData.ts`, `app/teacher/_lib/fetchClassRoster.ts`, `app/teacher/_hooks/useSaveResult.ts`, and `app/teacher/_hooks/useAttendance.ts`.
- Privileged operations use a service-role client in the three route handlers: `app/api/admin/route.ts`, `app/api/teacher/route.ts`, and `app/api/schools/register/route.ts`. Service-role operations bypass RLS. Each operation therefore needs explicit authorization and tenant scoping in server code.
- The admin and teacher endpoints each expose many operations behind one POST endpoint and an `action` switch. This works but makes authorization and input validation easy to miss when actions are added.
- `lib/audit.ts` writes privileged audit records. Review which action failures are audited and ensure audit writes cannot include credentials or excessive student data.
- `app/sw.ts` has service-worker network handling; review its cache rules before relying on it for authenticated pages or student data. No runtime cache/security review was performed here.

### Tenant/data model inferred from code

The source references `schools`, `profiles`, `classes`, `students`, `enrolments`, `sessions`, `terms`, `grade_bands`, `subjects`, `class_subjects`, `scores`, `trait_ratings`, `term_records`, `attendance_logs`, and `audit_log`. Tenant ownership is generally represented by `school_id`; class and student records are connected by class IDs and enrolments. Teachers are assigned through `classes.teacher_id`. Confirm exact foreign keys, uniqueness rules, cascades, grants, and RLS predicates against the live database/schema before changing authorization logic.

## Findings to triage

### High priority

1. **Public registration performs service-role provisioning with no visible abuse controls.** `app/api/schools/register/route.ts:26-80` accepts anonymous JSON and creates a school plus initial session/terms/grade bands; later it creates an admin user with `email_confirm: true`. No CAPTCHA, rate limiting, invite gate, or email verification is visible in this handler. Automated requests can create tenants/accounts and consume resources. Decide whether public self-service registration is a product requirement. If so, add edge/server rate limits, email verification, stricter schema/size limits, and abuse monitoring; otherwise gate onboarding with an invite or operator approval. Make setup transactional (RPC/database transaction or robust idempotent provisioning) so partial failures do not leave inconsistent tenants.

2. **Attendance input is not runtime validated.** `app/api/teacher/route.ts:141-215` checks `entries` is an array and verifies enrollment IDs belong to the caller's class and school, which is good. But `status` is copied directly from client JSON at line 203; the TypeScript cast is erased at runtime. Validate each entry with a schema (including allowed values, ID format, count limit, and date format/range), reject the whole batch if any row is invalid, and enforce database constraints too. Also consider duplicate enrollment IDs and maximum request body size.

3. **RLS policies and database privileges are not present in this repo.** Client-side Supabase calls depend on them. Obtain the authoritative Supabase schema/policies and verify RLS is enabled on every tenant-bearing and sensitive table, with least-privilege grants and tests for anonymous, teacher, same-school admin, and cross-school admin access. In particular inspect profiles/role writes, audit logs, storage buckets (if any), views, RPCs, and join-table policies. A README assertion or UI handoff note is not a substitute for checking the deployed project.

### Medium priority

4. **Temporary passwords/PINs are returned to the browser.** `app/api/admin/route.ts:409-475` creates an admin with a predictable-format password and returns it; `:480-530` does the same for password reset. `Math.random()` is used to generate a six-digit PIN (`:418-421`, `:501-504`), which is not a cryptographic credential generator. Prefer Supabase invite/password-reset links or a short-lived one-time secret generated cryptographically, enforce password change at first login, rate-limit resets, and never log credential responses. Consider invalidating existing sessions after reset.

5. **Raw backend errors are returned from privileged routes.** Several branches return Supabase `error.message` to the client (for example `app/api/teacher/route.ts` and `app/api/admin/route.ts`). Return stable generic error codes/messages publicly; log sanitized detailed diagnostics server-side with a request/correlation ID. Never log request bodies, bearer tokens, passwords, temporary credentials, or full student records.

6. **Sign-in debug logging should be removed.** `app/sign-in/staff/page.tsx:39-45` logs auth identifiers, profile data, and profile errors in the browser. Even when the queried profile contains only role, this leaves unnecessary operational/user data in console collection and screenshots. Remove the temporary logs and avoid displaying backend error detail in the UI.

7. **No central runtime schema validation is visible at API boundaries.** Route bodies are read with `req.json()` and largely trusted. Add schemas for all actions, with strict allowed fields, bounds, enum checks, date/UUID parsing, string length limits, and rejection of unknown properties where appropriate. Validate relationship consistency server-side; client-side form validation is only usability, not security.

8. **Service-role privileges are concentrated in large action routers.** The admin route is a large switch covering approval, term/session management, account provisioning, teacher/class/student/subject operations. Each case must independently prove both role and tenant ownership, and selected objects must be scoped before mutation. Keep a written authorization matrix and tests per action. Refactor incrementally into action modules or a server-only data access layer so auth, schemas, tenant checks and audit handling are harder to omit.

### Lower priority / deployment checks

9. **Browser-side auth session and XSS exposure.** Supabase browser sessions are accessible to JavaScript, so any XSS can steal/use them. No obvious `dangerouslySetInnerHTML` or `eval` was found in the initial scan, but this is not a full XSS audit. Keep React's escaping, avoid unsafe HTML, add a restrictive Content Security Policy and security headers at the deployment boundary, and assess moving session handling to secure HttpOnly cookies if adopting a server-centric architecture.

10. **No visible rate limits on sensitive authenticated actions.** Password reset, account creation, attendance/result batch mutations and registration should have per-IP/user limits and sensible payload bounds. Add monitoring for unusual volume and repeated failures.

11. **Dependency/deployment posture remains unverified.** Lockfile versions are pinned, but this review did not run an advisory scan or inspect hosting settings. Check current dependency advisories, secret deployment configuration, HTTPS, preview deployment access, logging/analytics redaction, backup retention, and database point-in-time recovery. Never put `SUPABASE_SERVICE_ROLE_KEY` under a `NEXT_PUBLIC_` name or in browser bundles.

## What was not verified

- Live Supabase RLS policies, SQL grants, constraints, triggers, RPCs, storage policy, auth settings, MFA/password policy, or deployed data.
- Whether signup is intentionally open to the public, or what registration protections may exist outside this repository.
- Vercel/edge/WAF rate limiting, CSP/security headers, preview access controls, logs, backups, TLS, and secret rotation.
- Full action-by-action authorization correctness, frontend XSS, dependency advisories, or dynamic exploitability.
- Secrets in `.env.local` were not inspected. `.env*` is ignored in `.gitignore`, but ignored does not prove secrets were never committed elsewhere.

The working tree already had unrelated local edits, including teacher attendance files and a changed teacher API, at review time. Preserve those changes; this handoff documents the state visible in the current checkout and does not claim the current working tree is clean.

## Recommended target architecture

### 1. Establish the database as an explicit security boundary

- Inventory every table/view/function/bucket and mark whether it contains tenant-owned, student, authentication, or audit data.
- Enable RLS on every exposed table and use least-privilege grants. Default deny; define explicit policies for each role and operation.
- Derive tenant identity from a trusted server-side profile or carefully managed auth claims. Do not accept `school_id`, `role`, `teacher_id`, or ownership from request bodies as authority.
- Scope relationships in policies as well as server queries: a row's `school_id` must match the caller's authorized school, and a teacher may only access assigned classes. Ensure joins cannot leak rows through a related table with looser policy.
- Add database constraints for allowed enums/statuses, foreign-key consistency, uniqueness, valid score/date bounds, and ownership consistency where feasible. The database is the final invariant enforcer.
- Build SQL migrations plus repeatable authorization tests; do not manage this critical state only through dashboard clicks.

### 2. Use a server-side data access layer for sensitive operations

- Add server-only modules for session validation, caller authorization, schemas, tenant-scoped reads/writes and DTO shaping. Mark these modules `server-only` and never import them from client components.
- For each request, validate the Supabase user with the provider, load the authoritative profile, and create a typed principal `{ userId, role, schoolId }`. Fail closed if profile lookup fails or the account is disabled.
- Prefer user-scoped Supabase clients that carry the user's JWT and allow RLS to enforce access. Reserve the service-role client for narrowly justified workflows (such as account provisioning) and wrap each operation with explicit checks. Keep the key in server-only environment config.
- Consider moving protected reads out of broad browser table access into authenticated server endpoints/server components returning minimal DTOs. If direct browser access remains, RLS must remain complete and continuously tested.
- Split the two mega-routes into focused route handlers or well-separated action modules. Keep the same authorization and validation helpers shared across all mutations.

### 3. Define an authorization matrix before implementation

At minimum document and test:

- Anonymous: signup only if intentionally enabled; no school/student data access.
- Teacher: own profile; assigned classes only; students/enrolments/results/attendance only for those classes and school; allowed result/attendance state transitions only.
- School admin: records belonging to exactly their school; cannot alter another school's records, their own role/tenant binding, or platform-level settings.
- Platform/operator role (if needed): separate, explicit role and audited workflows; do not overload school admin.
- Disabled/deleted/unprovisioned user: no access, including already-issued tokens where practical.

Model operations as explicit permissions (for example `attendance.write`, `results.submit`, `results.approve`, `staff.reset_password`) and validate transitions, not only row ownership. A teacher should not be able to approve a result simply because the class is theirs; an admin approval must confirm the term/enrolment belong to that same school.

### 4. Harden request and credential handling

- Use a schema validator (for example Zod) at every API boundary and cap request body and batch sizes.
- Use server-side rate limits for signup, login-adjacent actions, credential resets, account provisioning and bulk writes; return `429` with a retry strategy.
- Replace returned temporary passwords with verified invite/reset flows. Use cryptographically secure randomness where one-time secrets are unavoidable, expire them, force rotation, and audit issuance without storing the secret.
- Use generic user-facing errors and structured, redacted server logs. Add request IDs and avoid logging auth headers, passwords, access tokens, PII, or whole request/response objects.
- Add CSRF/origin protections if switching to cookie-authenticated mutations; use Secure, HttpOnly, SameSite cookies and validate Origin/Host as appropriate. Bearer-token APIs have different CSRF properties but still need CORS/origin decisions and XSS controls.

### 5. Protect student data in the frontend and operations

- Minimize returned columns and payloads; avoid broad `select('*')` for profiles, students, audit rows and administrative lists where not needed.
- Review service-worker caching to ensure authenticated pages and API responses containing student data are never cached/shared across accounts.
- Add CSP/security headers, keep dependencies updated, review preview deployments, enforce MFA for admins if product/provider setup supports it, and define retention/backup/access procedures for student data.
- Keep audit logs append-only to ordinary roles, tenant-scoped, and free of credential values. Audit role-sensitive events and failed high-risk attempts.

## Suggested remediation sequence

1. Obtain current Supabase schema/policies and verify cross-school isolation with two test tenants and anon/teacher/admin accounts. Fix any policy/grant gap before expanding features.
2. Close or protect public registration; add rate limiting and safe provisioning/rollback.
3. Add runtime schemas and database constraints, starting with attendance and all service-role writes; reject invalid enum/status/date/relationship values.
4. Replace temporary password responses and weak PIN generation; remove sign-in debug logging and sanitize client errors.
5. Create a shared server-only auth/authorization/data-access layer and migrate one route/action at a time with an authorization matrix.
6. Add automated policy and API authorization tests (cross-school IDOR, role escalation, invalid state transitions, oversized batches, unauthenticated access, reset abuse); review service-worker cache and deployment headers/logging.

Do not start by doing a broad rewrite. First capture the current schema and expected workflows, then make each control testable and migrate incrementally.
