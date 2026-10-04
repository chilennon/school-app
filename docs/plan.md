# Plan

## Current phase: Polish + v1 readiness

The MVP is shipped. Two schools can already run entirely on this app. What remains is polish, secondary features, and the offline layer.

## Roadmap

### ✅ Done
- Multi-tenant foundation (school_id, JWT, RLS)
- School signup flow
- Owner/Admin/Teacher roles (owner not yet split from admin)
- Result compiler wizard
- Attendance feature
- Approval workflow
- Batch report card printing
- Audit log + activity feed
- Admin password change + reset for staff

### 🔨 In progress / next
- **Admin dashboard restructure** — operational layout, not CRUD-console
- **Class detail page** — tap a class → students, attendance, results status
- **Student detail page** — tap a student → full record
- **Owner role split** — promote one admin to owner, gate fee visibility

### 📋 Scheduled
- **Fee module** (Phase 2, weeks) — charges, payments, debtors, receipts
- **Bursar role + dashboard** — separate login for money
- **Offline Dexie + sync** (Phase 3, weeks) — local-first data layer
- **Broadsheet** — landscape A4 class grid
- **Promotion flow** — end-of-session student promotion
- **Parent portal** — read-only report card view

### 🧊 Deferred (until a paying school asks)
- Paystack integration
- SMS / WhatsApp notifications
- Multi-school proprietor dashboard
- Cross-school benchmarking
- Attendance graphs / trends
- Report card auto-fill from attendance data

## Decision rules

**Ship the current term's work before building the next thing.** Attendance was built, tested, and shipped. Next is admin restructure. Don't start fees until a real school asks.

**Watch real usage before building.** Two weeks of watching teachers use attendance will tell you more than two months of speculating. Build what hurts, not what seems important.

**Nothing else in the roadmap is urgent.** Every item in "scheduled" waits until the item before it is live, tested, and used. No parallel tracks.

## The honest sequencing

1. Ship what exists to House of Angels
2. Watch for a week
3. Build the admin restructure (1 day)
4. Watch for another week
5. Ask the owner: is fee tracking actually broken today?
   - If yes → build fees (weeks)
   - If no → move to offline layer (weeks)
6. Everything else waits