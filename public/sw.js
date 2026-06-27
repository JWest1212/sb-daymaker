// Neutralized service worker — self-destruct.
// The offline-cache worker (cache-first on /_next/static) was masking code
// changes during the wave-next build with stale assets. This version, the next
// time any browser checks /sw.js, clears all caches, unregisters itself, and
// reloads open pages so nothing stale lingers. (A fresh offline worker can be
// reintroduced at go-live.) No fetch handler → every request hits the network.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })(),
  );
});
