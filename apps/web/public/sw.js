const CACHE_NAME = "bd-safety-map-v1";
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
  const url = new URL(event.request.url);

  // Cache OpenStreetMap or CartoDB tiles with stale-while-revalidate or cache-first
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

  // Network first for page navigation and API requests, fall back to cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
