# Review loops

How to review your own work before shipping. Short checklists, not comprehensive audits.

## Before every commit

- [ ] `npm run build` is green
- [ ] No `console.log` left in (except deliberate `console.error` in catch blocks)
- [ ] No commented-out code
- [ ] No `TODO` without a date and reason
- [ ] No `any` without a comment explaining why
- [ ] Diff reviewed — no unintended changes to unrelated files

## Before every push to main

- [ ] Everything above
- [ ] Tested on the Pixel 7 emulator
- [ ] Tested as the affected role (teacher / admin / owner)
- [ ] If data changed: verified in Supabase directly
- [ ] If RLS changed: two-school isolation test passes

## Before shipping to a school

- [ ] Everything above
- [ ] Tested on a real Android phone (not just emulator)
- [ ] Tested as a teacher (the primary user, not just admin)
- [ ] Tested on the production URL, not localhost
- [ ] Deployed and verified on the live app
- [ ] Backup plan: know how to roll back (Vercel promote previous deploy)

## After each feature ships

Answer these in the feature spec:
1. What was built?
2. What was considered and rejected?
3. What's next for this feature?
4. What did we learn?

## Weekly review

Once a week, answer:
- What shipped this week?
- What broke this week?
- What's next week's focus?
- Anything to add to `docs/decisions/`?

## Monthly review

Once a month:
- Re-read `docs/plan.md` — is the roadmap still right?
- Check Supabase usage (bandwidth, storage, MAU)
- Look at `audit_log` activity — are teachers using the app?
- Look at `attendance_logs` — is attendance being marked daily?

If any answer is "no" or "barely," ask why. The reason might be a product problem, not a technical one.

## When reviewing an agent's work

If another agent (or future you) made a change:

1. **Diff it.** Read every line changed, not just the summary.
2. **Check the architectural rules** in `AGENTS.md` — did any get broken?
3. **Check RLS** — did any policy change?
4. **Check the SW** — did any data path become cacheable?
5. **Build it locally** — did it compile?
6. **Test on the emulator** — did behavior match the description?

If anything feels off, revert first, ask later. A bad change that got reverted is cheap. A bad change that shipped is expensive.

## The most important review

**Watch a real teacher use the app.** Nothing beats this. Sit in the staff room. Say nothing. Take notes on every hesitation, every wrong tap, every confusion. That list is the roadmap.