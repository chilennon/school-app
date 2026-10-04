# 005 — Wizard compiler pattern

**Date:** October 2026
**Status:** Locked

## Context

The original result compiler was a single scroll page with 5 stacked cards: Details, Attendance, Subjects, Traits, Remarks. On a 360px phone, this was 4-5 screens of scrolling. Teachers had to scroll down to find Save, then scroll back up to fix a mistake.

## Decision

Split the compiler into a 5-step wizard:
1. Details (school, student)
2. Attendance (days opened/present/absent)
3. Subjects (scores — the meat)
4. Traits (16 ratings)
5. Remarks (teacher + head comments)

**Step indicator** at the top shows progress.
**Bottom bar** has Previous / Next / "Save draft and exit".
**Save happens silently on Next** (no toast). **Save draft and exit shows a toast.**
**Failure to save blocks advancement** — the teacher stays on the current step.

## Consequences

**Good:**
- One clear action per screen
- Progress visible
- Save happens continuously, so interruption-safe
- Complies with mobile-first design law ("the thumb owns the bottom third")

**Costs:**
- One additional save per step transition (5 saves per result, not 1)
- If a teacher abandons at step 3, a partial result is saved — this is fine, it's a draft

## Read-only mode

The wizard has a `readOnly` prop. Admin read-only view skips the wizard entirely and renders sections stacked. This is deliberate — admins want to scan everything, not click through steps.