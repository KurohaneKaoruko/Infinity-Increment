/* INFINITY // terminal — offline shell cache.
 * The production build is a single inlined HTML file (vite-plugin-singlefile),
 * so caching the document itself is enough to make an installed PWA launch
 * offline. Registered only in production http(s) contexts (see index.tsx). */
const CACHE = "infinity-shell-v1";

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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;
  // leaderboard API is always live — never serve it from cache
  if (new URL(req.url).pathname.startsWith("/api/")) return;
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
        if (req.mode === "navigate") {
          const shell = await cache.match("./index.html", { ignoreSearch: true });
          if (shell) return shell;
        }
        return new Response("offline", { status: 503, statusText: "offline" });
      }
    })(),
  );
});
