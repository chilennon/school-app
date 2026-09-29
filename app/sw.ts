/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import { Serwist, NetworkOnly } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (string | { url: string; revision: string | null })[];
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Never cache data. Dexie owns the data layer — the service worker
    // caches only the app shell (JS/CSS/fonts/icons). Any request to
    // /api/* or *.supabase.co must always hit the network.
    {
      matcher: ({ url, sameOrigin }) =>
        (sameOrigin && url.pathname.startsWith("/api/")) ||
        url.hostname.endsWith("supabase.co"),
      handler: new NetworkOnly(),
    },
    // Default app-shell caching for everything else.
    ...defaultCache,
  ],
});

serwist.addEventListeners();