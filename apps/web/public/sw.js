const CACHE_NAME = "bd-safety-map-v2";
const STATIC_ASSETS = ["/", "/feed", "/safe-zones", "/alerts", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only intercept GET requests - mutation requests (POST/PATCH/DELETE) pass through natively
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // Do not intercept Socket.IO polling or WebSockets
  if (url.pathname.includes("/socket.io/") || url.pathname.startsWith("/api/")) {
    return;
  }

  // Cache OpenStreetMap or CartoDB tiles with stale-while-revalidate
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

  // Network-first for static pages and navigation, falling back to cache or offline fallback response
  event.respondWith(
    fetch(event.request).catch(async () => {
      try {
        const cached = await caches.match(event.request);
        if (cached) {
          return cached;
        }
        if (event.request.mode === "navigate") {
          const fallback = await caches.match("/");
          if (fallback) return fallback;
        }
      } catch {
        // Fall through to offline response
      }

      return new Response("Network unavailable. Service is offline.", {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "text/plain" },
      });
    })
  );
});
