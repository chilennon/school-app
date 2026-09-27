"use client";

import { useEffect } from "react";

/**
 * Configurator-mode Serwist does not auto-register the service worker.
 * This client component registers it once on mount.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[SW] registered, scope:", reg.scope);
      })
      .catch((err) => {
        console.error("[SW] registration failed:", err);
      });
  }, []);

  return null;
}