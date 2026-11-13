/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import { Serwist, NetworkOnly, NetworkFirst } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (string | { url: string; revision: string | null })[];
};

const isApiOrSupabase = ({ url }: { url: URL }) =>
  url.pathname.startsWith("/api/") || url.hostname.endsWith("supabase.co");

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    // 1. API and Supabase routes (Bypass cache)
    { matcher: isApiOrSupabase, handler: new NetworkOnly(), method: "GET" },
    { matcher: isApiOrSupabase, handler: new NetworkOnly(), method: "POST" },
    { matcher: isApiOrSupabase, handler: new NetworkOnly(), method: "PUT" },
    { matcher: isApiOrSupabase, handler: new NetworkOnly(), method: "PATCH" },
    { matcher: isApiOrSupabase, handler: new NetworkOnly(), method: "DELETE" },
    
    // 2. Next.js Page Navigations (Try network, fallback to cache)
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages",
        networkTimeoutSeconds: 3, // Don't hang forever offline
      }),
    },
    
    // 3. Static assets (JS, CSS, Images)
    ...defaultCache,
  ],
});

// 4. THE BULLETPROOF FALLBACK (Native API)
serwist.setCatchHandler(async ({ event }) => {
  // Cast to FetchEvent so TypeScript knows .request exists
  const fetchEvent = event as unknown as FetchEvent;
  
  // If the user is navigating to a page and it fails offline
  if (fetchEvent.request && fetchEvent.request.mode === "navigate") {
    const offlineUrl = new URL("/offline", self.location.origin).href;
    const cachedOffline = await caches.match(offlineUrl);
    
    if (cachedOffline) {
      return cachedOffline;
    }
  }
  
  return Response.error();
});

serwist.addEventListeners();