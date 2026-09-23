// SB Daymaker service worker: the offline shell.
//
// R1 W7.4 (TP-C3-03, TP-C3-04). Before this, the only offline answer was a
// fallback most navigations never reached: /saved, the one page whose content
// lives entirely on the device, fell to the framework's generic "This page
// couldn't load", and so did every listing and the planner.
//
// Now, for navigations: network first. If the network fails, /saved is served
// from its own last good copy, because it renders from localStorage and works
// offline; every other page gets /offline, a calm branded page with a way back
// to the saved list. Install caches both pages AND the scripts, styles and
// fonts they reference, so they render even if this visitor never opened them
// while online. Hashed static assets stay cache-first. Bump CACHE to
// invalidate everything.
const CACHE = "sbd-v5";
const OFFLINE_URL = "/offline";
const SHELL = ["/saved"];

// Every hashed asset a page's HTML points at: chunks, stylesheets, preloaded fonts.
function assetsIn(html) {
  const found = new Set();
  const re = /\/_next\/static\/[^"'\s)\\]+/g;
  let m;
  while ((m = re.exec(html))) found.add(m[0]);
  return [...found];
}

// The pages the offline answer depends on. If either cannot be cached, the
// install FAILS, so the browser keeps the previous worker and tries again on a
// later visit, rather than activating a worker with no offline page to serve.
const REQUIRED = [OFFLINE_URL, ...SHELL];

async function cachePage(cache, path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`precache ${path}: ${res.status}`);
  await cache.put(path, res.clone());
  const html = await res.text();
  // The page's own scripts, styles and fonts. Best effort: a missing chunk
  // costs polish, not the page.
  await Promise.allSettled(assetsIn(html).map((a) => cache.add(a)));
}

async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(REQUIRED.map((p) => cachePage(cache, p)));
  await Promise.allSettled([cache.add("/icon-192.png")]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Keep the shell's copy fresh whenever it loads online.
          if (res.ok && SHELL.includes(url.pathname)) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          const own = SHELL.includes(url.pathname) ? await cache.match(url.pathname) : undefined;
          return own || (await cache.match(OFFLINE_URL)) || Response.error();
        }),
    );
    return;
  }

  // Cache first for real static files ONLY: hashed build assets and the icon.
  // Never for a page path. Next's client router fetches a page's data from the
  // page's own URL (/saved?_rsc=...), and matching on the path alone served
  // that data from cache forever, so after a deploy every tap on Saved came
  // back with the old build's payload and forced a full reload (review fix).
  // Page loads are the navigate branch's job.
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon-192.png") {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});
