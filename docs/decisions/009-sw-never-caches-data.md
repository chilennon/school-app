# 009 — Service worker never caches data

**Date:** September 2026
**Status:** Locked

## Context

Serwist (the service worker library) ships with default caching strategies. By default it caches some GET requests, including some API responses.

For a school app holding children's data, this is a privacy problem. Cached data sits in the browser's Cache Storage — readable by anyone with dev tools on an unlocked device. And once Dexie lands, having two separate data caches (Cache Storage + IndexedDB) creates corruption risk.

## Decision

The service worker caches **the app shell only** — HTML, JS, CSS, fonts, icons. It never caches any data response.

Implementation in `app/sw.ts`:

```ts
runtimeCaching: [
  {
    matcher: ({ url, sameOrigin }) =>
      (sameOrigin && url.pathname.startsWith("/api/")) ||
      url.hostname.endsWith("supabase.co"),
    handler: new NetworkOnly(),
  },
  ...defaultCache,
],


he NetworkOnly rule comes before defaultCache, so it wins.

Consequences
Good:

Data lives in one place only (eventually Dexie)

Clear separation: SW = app shell, DB = data

No accidental data caching in Cache Storage

Fewer places to look when data misbehaves

Costs:

If a data request fails offline, the app doesn't fall back to a cached copy. This is correct — the app hasn't built Dexie yet, so there's no local data to fall back to. Once Dexie exists, reads come from Dexie, not from the network.

If you ever need to add caching: cache the app shell, never data. If you think you need data caching in the SW, that's a bug in the plan — bring it up.
