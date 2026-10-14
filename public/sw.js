/* INFINITY // terminal — offline shell cache.
 * The production build is a single inlined HTML file (vite-plugin-singlefile),
 * so caching the document itself is enough to make an installed PWA launch
 * offline. Registered only in production http(s) contexts (see index.tsx).
 *
 * Cache policy:
 *   navigations  → network-first. The whole game lives in index.html, so a
 *                  cache-first document would pin returning players to the
 *                  build they first saw — the HTTP `no-cache` on /index.html
 *                  cannot help, because a cache hit never reaches the network.
 *                  Offline launches still fall back to the cached shell.
 *   other GETs   → cache-first (icons/manifest are content-stable).
 *
 * Bump CACHE whenever the offline payload changes; `activate` drops the rest. */
const CACHE = "infinity-shell-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(["./", "./index.html"]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

async function offlineShell(cache, req) {
  return (
    (await cache.match(req, { ignoreSearch: true })) ??
    (await cache.match("./index.html", { ignoreSearch: true })) ??
    new Response("offline", { status: 503, statusText: "offline" })
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // leaderboard API is always live — never serve it from cache
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return offlineShell(cache, req);
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return new Response("offline", { status: 503, statusText: "offline" });
      }
    })(),
  );
});
