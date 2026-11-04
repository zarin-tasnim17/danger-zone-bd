const CACHE_NAME = "bd-safety-map-v3";

self.addEventListener("install", (event) => {
  // Activate worker immediately without waiting for existing tabs to close
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Purge all legacy caches so stale Next.js chunks are never served
          if (key !== CACHE_NAME && key !== "bd-safety-map-tiles") {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // 1. NEVER intercept navigation requests: always let browser fetch fresh HTML document from Vercel
  if (event.request.mode === "navigate") {
    return;
  }

  // 2. Only intercept GET requests
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // 3. NEVER intercept Next.js bundles, API routes, or WebSockets
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/socket.io/")
  ) {
    return;
  }

  // 4. Cache OpenStreetMap or CartoDB map tiles with stale-while-revalidate
  if (
    url.hostname.includes("tile.openstreetmap.org") ||
    url.hostname.includes("cartocdn.com")
  ) {
    event.respondWith(
      caches.open("bd-safety-map-tiles").then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response && response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch {
          return new Response("", { status: 408, statusText: "Offline" });
        }
      })
    );
    return;
  }
});
