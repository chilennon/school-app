# UI Polish Handoff

**Context:** House of Angels School Portal — Next.js 16 · React 19 · Tailwind v4 · shadcn/ui. Multi-tenant school management app for Nigerian primary schools. Live at school-app-rho-six.vercel.app. Currently 3 schools exist.

**This phase:** Polishing the UI on top of the existing working app. No new data-layer work, no Dexie, no offline changes. Those come later and are documented separately.

**Owner context:** Solo builder. Learning as they go. Be explicit, be patient, explain the "why."

---

## State of the app right now

Working:
- Multi-tenant auth with JWT + RLS isolation (verified across 3 schools)
- Teacher dashboard: mobile-native, bottom nav (Home / Scores / Profile)
- Admin dashboard: mobile-native, bottom nav (Home / Students / Approvals / More)
- Result compiler: functional, but internal layout is still desktop-shaped
- Batch report card PDFs
- School signup flow

Already mobile-native (don't touch structure):
- `app/teacher/page.tsx`
- `app/admin/page.tsx`
- All `_components/tabs/*` and `_components/sections/*`

Not yet polished:
- The compiler's internal layout (`app/teacher/results/page.tsx` + `SchoolResult.css`)
- Loading states throughout (spinners → skeletons)
- Confirmations (window.confirm → shadcn Dialog)
- Errors (window.alert → shadcn Toast)
- Empty states
- Onboarding after school signup

---

## Priority order

### P1 — Compiler internal layout

`app/teacher/results/page.tsx` renders `SchoolResult.css` — a hand-written stylesheet that was designed desktop-first. It works but doesn't feel mobile-native. This is the most-used screen (teachers live here).

What to change:
- Cards use the same visual language as the rest of the app (`rounded-2xl border border-slate-200 bg-white`)
- Step headers → consistent with `SectionHeader` in admin
- Form fields: inputs need `text-base` (16px) so iOS doesn't zoom
- Subject score table: currently a horizontal-scroll table with 8 columns. On mobile this is painful. Consider: two-column layout per subject row on mobile, table on `md:` and up. Or a "current subject" focus mode that shows one subject at a time with prev/next.
- Sticky bottom bar: Save Draft and Export PDF should be thumb-reachable, not at the top
- Remove `SchoolResult.css` in favour of Tailwind if practical, OR keep the CSS file but modernize it to match the app's design tokens

Test on the Pixel 7 emulator. Load time target: opening a student's compiler should feel instant. If it doesn't, the CSS or the initial render is too heavy.

### P2 — Feedback primitives

Install and adopt:
```bash
npx shadcn@latest add sonner dialog skeleton