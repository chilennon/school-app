# Observability

## Current state

No logging service. No error tracking. No analytics.

What exists:
- **Browser console** — client errors, warnings, some `console.error` calls
- **Vercel function logs** — server errors from `/api/*` routes
- **Supabase logs** — Postgres and Auth logs, viewable in the dashboard
- **`audit_log` table** — user-facing action log

## What to watch

**Daily:**
- Vercel deploy succeeded
- Supabase dashboard shows normal traffic

**Weekly:**
```sql
-- Attendance is being used
select count(*) from attendance_logs where created_at > now() - interval '7 days';

-- Audit log is growing (admins are active)
select count(*) from audit_log where created_at > now() - interval '7 days';

-- No orphan users
select count(*) from auth.users u
left join profiles p on p.id = u.id
where p.id is null;


After every deploy:

Open the app on the Pixel emulator

Test the specific change

Watch the browser console for new errors

What to log
Do:

Error messages (err.message)

Row IDs when something fails

API route entry + exit for slow operations

Audit log entries for every mutation

Never:

Student names, phone numbers, addresses

Scores or remarks

JWTs or session tokens

Full row contents

Error handling conventions
Client:

ts
try {
  await doSomething();
} catch (err: any) {
  console.error("doSomething failed:", err.message);
  toast.error(err.message || "Something went wrong");
}
Server (API routes):

ts
try {
  // ...work
} catch (err) {
  console.error("API action failed:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}


Never let an error silently disappear. Always show the user something.

When to add real observability
Triggers:

School #2 signs up

A bug causes data loss in production

Vercel log volume becomes unmanageable

When triggered, add:

Sentry (with PII scrubbing enabled)

Supabase query performance dashboard

A simple uptime check (Better Stack, UptimeRobot)

Do not add analytics. User behavior tracking isn't needed and has NDPA implications for children's data.

Audit log as observability
The audit_log table is the primary record of what admins did. Query it when investigating:

sql
select action, actor_name, target_label, created_at
from audit_log
where created_at > now() - interval '1 day'
order by created_at desc;
It's not a substitute for real logging, but it answers "who did what" for user actions.