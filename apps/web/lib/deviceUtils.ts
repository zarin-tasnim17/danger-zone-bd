/**
 * Detects mobile devices and viewports (mobile user-agent, iPadOS, coarse pointer, touch points, or compact screens).
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = typeof navigator !== "undefined" && navigator.userAgent ? navigator.userAgent : "";
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const maxTouch =
    typeof navigator !== "undefined" && navigator.maxTouchPoints != null ? navigator.maxTouchPoints : 0;
  const isTouch = "ontouchstart" in window || maxTouch > 0;
  // Modern iPadOS (iOS 13+) identifies as Macintosh with touch points
  const isIPad = maxTouch > 1 && /Macintosh/i.test(ua);
  const isCoarsePointer =
    typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const width = typeof window.innerWidth === "number" ? window.innerWidth : 1024;
  const isSmallScreen = width <= 768;
  const isTabletTouch = isTouch && width <= 1024;

  return isMobileUa || isIPad || (isTouch && isCoarsePointer) || isTabletTouch || isSmallScreen;
}
