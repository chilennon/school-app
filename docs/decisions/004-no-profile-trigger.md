# 004 — No profile trigger

**Date:** September 2026
**Status:** Locked

## Context

The original schema had an `on_auth_user_created` trigger that inserted a `profiles` row whenever an `auth.users` row was created. This is the "standard" Supabase pattern.

The trigger broke when we added `profiles.school_id` as NOT NULL. Creating a teacher failed with "Database error creating new user" — a generic message from Supabase that hid the actual Postgres error (NULL violation on `school_id`).

## Decision

Drop the trigger. Create the profile explicitly in the API route, right after `auth.admin.createUser`.

If the profile insert fails, delete the auth user to roll back. This keeps the two tables consistent.

## Consequences

**Good:**
- Real error messages surface to the developer and user
- Rollback is possible (delete the orphan auth user)
- No hidden behavior
- Matches the mental model of "one operation = one transaction"

**Costs:**
- Every code path that creates an auth user must also create the profile
- Currently that's two places: `create-teacher` and `create-admin` in `app/api/admin/route.ts`, and `register` in `app/api/schools/register/route.ts`

**If you add a new user-creation path:** remember to insert the profile. The trigger won't do it for you.