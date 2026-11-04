"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

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
  }, []);

  return null;
}
