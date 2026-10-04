# CI / Deploy

## Current pipeline



## No GitHub Actions

There is no CI beyond Vercel's build check. Nothing else runs on push:
- No tests (see `docs/tests.md`)
- No linter gate (ESLint runs locally, not in CI)
- No dependency audit

## Rules

**Always run `npm run build` locally before pushing.** Vercel runs the same build. If it fails locally, don't push — fix first.

**Test on the deployed URL, not just localhost.** The service worker and PWA behavior depend on HTTPS.

## Environment variables

Set in Vercel project settings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

Set locally in `.env.local` (gitignored).

Never commit `.env.local`. Never log values.

## Rolling back

Vercel → Deployments → find the last good deploy → "Promote to Production". Instant.

## When things go wrong

1. Check Vercel deploy logs first — the build error is always there
2. If the build is green but the app misbehaves, check the browser console + Vercel function logs
3. If data is corrupted, use Supabase SQL editor directly (with care — see `docs/migrations.md`)

## Future CI (when to build it)

When the codebase grows past ~1 school, add GitHub Actions that:
1. Runs `npm run build`
2. Runs the multi-tenant isolation test
3. Runs `npm run lint`

Not needed yet.

git push origin main
│
↓
Vercel detects push
│
↓
Runs npm run build
│
├── Fails → rollback, previous deploy stays live
│
↓
Succeeds → new deploy live in ~60s
│
↓
Auto-promoted to production URL