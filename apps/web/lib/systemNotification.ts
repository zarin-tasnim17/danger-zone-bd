/**
 * Browser System Notification Service for Hazard Proximity
 *
 * Dispatches high-priority visual notifications to the operating system notification
 * center using the browser's Service Worker (`registration.showNotification()`)
 * with fallback to window-level `new Notification()`.
 *
 * ============================================================================
 * ARCHITECTURAL SPECIFICATION: FOREGROUND CLIENT GPS vs. BACKEND WEB PUSH
 * ============================================================================
 *
 * 1. Client-Side Geospatial Execution Model:
 *    bd-safety-map executes all hazard proximity evaluations entirely within the
 *    client browser engine using pure Haversine spherical trigonometry. This
 *    preserves 100% user privacy (coordinates never leave the device) and incurs
 *    strictly $0 in external cloud infrastructure or mapping API costs.
 *
 * 2. Foreground vs. Background Tab Notification Delivery:
 *    - Foreground Tab: When the application is open and active, proximity alerts
 *      trigger HUD warning banners, Web Audio chimes, and haptic vibrations.
 *    - Background Tab: When the user switches tabs or minimizes the browser,
 *      modern browsers (Chrome, Edge, Firefox) maintain the active Web Worker
 *      and Geolocation watchPosition for a grace period. When an entry event occurs,
 *      `navigator.serviceWorker.ready.then(reg => reg.showNotification())` or the
 *      Notification constructor displays a native OS notification.
 *
 * 3. Mobile Device Sleep & OS Process Suspension Limitations:
 *    Both Apple iOS (WebKit) and Android (Chromium) deliberately suspend JavaScript
 *    execution and terminate `navigator.geolocation.watchPosition` timers when
 *    the device screen sleeps or the browser application is fully backgrounded.
 *    This is a hard OS-level battery conservation and privacy sandbox boundary.
 *
 * 4. Architectural Requirements for True "Device-Asleep" Background Push:
 *    To wake a locked, sleeping device when approaching a hazard, an application must
 *    employ the W3C Web Push Protocol (RFC 8030 / RFC 8291 / RFC 8292):
 *    a) User must grant Push permission, generating a `PushSubscription` endpoint.
 *    b) Client coordinates would need to be continuously streamed to a backend
 *       server (introducing privacy trade-offs and network data consumption).
 *    c) Server-side spatial geofencing algorithms (PostGIS / spatial indexing)
 *       would detect radius intersections and sign a Web Push message using VAPID
 *       (Voluntary Application Server Identification) key pairs.
 *    d) The push message is delivered through platform Push Services (Apple APNs /
 *       Google FCM) which wake the device's network radio and invoke the Service
 *       Worker `push` event handler.
 *
 *    In bd-safety-map, foreground and active background-tab tracking are fully supported
 *    without requiring continuous coordinate streaming or paid backend infrastructure.
 * ============================================================================
 */

export interface DangerZoneHazardMetadata {
  id: string;
  title?: string;
  category: string;
  locationName?: string;
  description?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

/**
 * Returns current Notification permission state or 'denied' if unsupported.
 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof Notification === 'undefined') {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Requests system notification permission from the user.
 * Safe to call on user gestures; never throws errors on denial or unsupported platforms.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') {
    return 'denied';
  }

  try {
    if (typeof Notification.requestPermission === 'function') {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  } catch {
    return 'denied';
  }
}

/**
 * Dispatches a native operating system notification for an entered danger zone.
 * Attempts ServiceWorker registration first, then falls back to window Notification.
 *
 * @param hazard - Hazard metadata (id, title, category, etc.)
 * @param distanceMeters - Geodesic distance in meters to hazard center.
 * @returns boolean - True if notification was emitted, false if denied or unsupported.
 */
export async function showDangerSystemNotification(
  hazard: DangerZoneHazardMetadata,
  distanceMeters: number
): Promise<boolean> {
  if (getNotificationPermission() !== 'granted') {
    return false;
  }

  const roundedDistance = Math.max(0, Math.round(distanceMeters));
  const categoryLabel = hazard.category || 'Hazard';
  const titleLabel = hazard.title ? `${categoryLabel} - ${hazard.title}` : categoryLabel;

  // Title: ⚠️ DANGER ZONE ALERT: [Category/Title]
  const title = `⚠️ DANGER ZONE ALERT: ${titleLabel}`;

  // Body: You are [distance]m from an active danger zone. Stay alert.
  const body = `You are ${roundedDistance}m from an active danger zone. Stay alert.`;

  const options: NotificationOptions & { renotify?: boolean } = {
    body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: `hazard-${hazard.id}`,
    renotify: false,
    data: {
      hazardId: hazard.id,
      distanceMeters: roundedDistance,
      coordinates: hazard.coordinates,
    },
  };

  // Attempt Service Worker registration first
  if (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    navigator.serviceWorker &&
    typeof navigator.serviceWorker.ready !== 'undefined'
  ) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(title, options);
        return true;
      }
    } catch {
      // Graceful fallback to window-level Notification constructor
    }
  }

  // Fallback to window-level Notification API
  try {
    if (typeof Notification !== 'undefined') {
      new Notification(title, options);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}
