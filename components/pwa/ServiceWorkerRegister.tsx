"use client";

import { useEffect } from "react";

/**
 * The offline service worker was caching stale assets during the build, so it's
 * neutralized for now (see public/sw.js). This component no longer registers a
 * worker; it tears down any existing one and clears its caches, with one guarded
 * reload so the page self-heals to fresh assets. Re-introduce a real worker at
 * go-live if offline support is wanted.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const cleanup = async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if (
        navigator.serviceWorker.controller &&
        !sessionStorage.getItem("sbd-sw-cleared")
      ) {
        sessionStorage.setItem("sbd-sw-cleared", "1");
        window.location.reload();
      }
    };
    cleanup().catch(() => {});
  }, []);

  return null;
}
