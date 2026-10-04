# Attendance

**Status:** ✅ Shipped
**Build time:** ~4 hours

## What it does

Teachers mark daily attendance for their class. Default state is everyone present. Teacher flips the few who are absent. Data is saved per (student, date).

## Flow

1. Teacher taps **Attend.** in bottom nav
2. Sees class pills, today's date card, recent days list
3. Taps **Start Roll Call** → opens RollCallScreen (full-screen)
4. Every student defaults to Present
5. Buttons: "Mark all Present" / "Mark all Absent" at top
6. Each row has a Present/Absent toggle
7. Footer shows "N present · M absent"
8. Taps **Review & Submit** → POST to API → toast → back to Attendance tab

## Data model

`attendance_logs` — one row per (enrolment, date). Unique constraint means re-saving overwrites.

## Rules

- Only two statuses: `present` / `absent`. Late/excused deferred until a school asks.
- Attendance locked by default? No. Teachers can reopen any past day.
- Admins can see attendance via Supabase, but there's no admin UI yet. Comes with the admin restructure.

## What was considered and rejected

- **Swipe-card UI.** Faster-looking, actually slower on 30 items. Rejected.
- **Nothing selected by default.** Too slow. Rejected.
- **Late/excused statuses.** Not asked for. Rejected for v1.

## What's next for this feature

- Report card auto-fill: `days_present` and `days_absent` computed from attendance, not typed by hand
- Admin class detail page shows attendance summary per class
- Student detail page shows full attendance history
- Parent notifications on absence (Phase 2+)