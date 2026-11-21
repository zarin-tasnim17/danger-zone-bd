"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Handle stale Next.js chunks when a new deployment invalidates old chunk hashes
    const handleChunkError = (event: ErrorEvent) => {
      const isChunkError =
        event.error?.name === "ChunkLoadError" ||
        /Loading chunk [\w-]+ failed/i.test(event.message || "") ||
        /Loading CSS chunk [\w-]+ failed/i.test(event.message || "");

      if (isChunkError) {
        const key = "dz_last_chunk_reload";
        const lastReload = Number(sessionStorage.getItem(key) || 0);
        const now = Date.now();
        // Prevent infinite reload loops: reload at most once every 10 seconds
        if (now - lastReload > 10000) {
          sessionStorage.setItem(key, String(now));
          window.location.reload();
        }
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const isChunkError =
        reason?.name === "ChunkLoadError" ||
        /Loading chunk [\w-]+ failed/i.test(reason?.message || "");

      if (isChunkError) {
        const key = "dz_last_chunk_reload";
        const lastReload = Number(sessionStorage.getItem(key) || 0);
        const now = Date.now();
        if (now - lastReload > 10000) {
          sessionStorage.setItem(key, String(now));
          window.location.reload();
        }
      }
    };

    window.addEventListener("error", handleChunkError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    if ("serviceWorker" in navigator) {
      // Purge legacy caches from window context to immediately liberate browser from stale Next.js chunks
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            if (key === "bd-safety-map-v1" || key === "bd-safety-map-v2") {
              caches.delete(key);
            }
          });
        });
      }

      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Actively check for service worker updates on every page visit
          reg.update();
        })
        .catch((err) => console.warn("Service Worker registration failed:", err));
    }

    return () => {
      window.removeEventListener("error", handleChunkError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
