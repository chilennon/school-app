# 006 — Attendance defaults to Present

**Date:** October 2026
**Status:** Locked

## Context

Daily attendance for a 32-student class. Options:

1. **Nothing selected by default.** Teacher taps each student's status.
2. **Default Present.** Teacher taps only the absent students.
3. **Swipe card-stack UI.** Swipe right for present, left for absent.

## Decision

Option 2. Everyone defaults to Present. Two shortcut buttons ("Mark all Present" / "Mark all Absent") above the list. Below, each student has a Present/Absent toggle. Teacher taps only the absent ones.

## Why

**Option 1 is too slow.** 32 taps per day, every day. Reality check: on a normal day, 30 of 32 are present.

**Option 3 was considered and rejected.** Swipe gestures look modern but require a gesture library, are physically slower, and don't beat "tap the few outliers" on a 30-item list.

## Consequences

**Good:**
- Common case (everyone present) = 1 tap total
- Uncommon case (a few absent) = N+1 taps
- Zero gesture learning curve

**Costs:**
- Saves without confirmation are possible. If a teacher saves without looking, everyone is marked present, which might be wrong. Mitigation: the "Review & Submit" button is explicit.
- Late / excused statuses aren't supported. If a school asks, they can be added.