"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker in production (where hashed asset URLs
 * make its cache-first strategy safe). In development it instead tears down any
 * worker left over from a past prod build and clears its caches, so dev never
 * serves stale assets. Renders nothing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches
          .keys()
          .then((keys) => keys.forEach((k) => caches.delete(k)))
          .catch(() => {});
      }
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration failures are non-fatal */
      });
    };
    // R1 W7.4 (TP-C3-03, TP-C3-04). The real reason offline never worked. This
    // used to wait for the window's `load` event, but an effect runs after
    // hydration, and on most visits `load` has ALREADY fired by then. The
    // listener was attached to an event that would never come again, so the
    // worker never registered and no page had an offline answer at all.
    // Measured: zero registrations five seconds after loading the homepage.
    // If the page has finished loading, register now; otherwise wait for it,
    // so registration still never competes with the first paint.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
