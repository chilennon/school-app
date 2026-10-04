
---

## `docs/decisions/008-pwa-over-native.md`

```markdown
# 008 — PWA over native app

**Date:** September 2026
**Status:** Locked

## Context

Options for distributing the app to teachers:
1. **React Native** — native Android + iOS app, distributed via Play Store
2. **Capacitor** — wrapper around a web app, distributed as APK
3. **PWA (Progressive Web App)** — installable from Chrome, no app store

## Decision

PWA.

## Why

**React Native is a rewrite.** The entire app (admin CRUD, result compiler, PDF generation) would need reimplementing. Shipping a ~40MB APK to teachers on low-end Androids.

**Capacitor is a wrapper.** Would preserve the code but adds a native build step, still needs an APK, still needs to be sideloaded or store-distributed. Solves nothing.

**PWA:**
- "Add to homescreen" is the install flow. No store, no review, no code signing.
- Sub-5MB install vs 40MB APK.
- Updates ship instantly (teachers get the new version on next open).
- Works on Android 5+ (Chrome has supported PWAs for years).
- The whole app is already React/Next.js. Zero port.

**Trade-off:** iOS PWA support is worse than Android. Some quirks (no native gestures, no background sync as reliable). But the target is Android, so it doesn't matter.

## Consequences

**Good:**
- One codebase, one deploy
- Fixes ship in seconds
- No app store gatekeepers

**Costs:**
- iOS experience is second-class (acceptable — target is Android)
- No native push notifications (not needed in v1)
- No native file system access (jsPDF saves to Downloads, which works)
- Service worker quirks require careful testing

## What this makes possible

The offline-first architecture (see `docs/specs/offline-dexie.md`) only makes sense in a PWA context. A native app would require a separate offline implementation.