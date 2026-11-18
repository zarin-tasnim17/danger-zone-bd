/**
 * Mobile Vibration Wrapper for Danger Zone Proximity Alerts
 *
 * Implements haptic feedback using browser-standard navigator.vibrate([300, 150, 300])
 * (300ms vibration, 150ms pause, 300ms vibration).
 *
 * Features defensive feature checks for platforms that lack the Vibration API
 * (such as iOS Safari and desktop browsers), failing safely and returning false
 * without throwing runtime exceptions.
 */

export const DEFAULT_VIBRATION_PATTERN = [300, 150, 300];

/**
 * Checks if the current environment supports the W3C Vibration API.
 */
export function isVibrationSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'vibrate' in navigator &&
    typeof (navigator as unknown as { vibrate?: unknown }).vibrate === 'function'
  );
}

/**
 * Triggers a danger proximity vibration pattern on supported mobile devices.
 *
 * @param pattern - Millisecond vibration pattern. Defaults to [300, 150, 300].
 * @returns boolean - True if vibration was dispatched to the device, false if unsupported,
 *                   pattern was invalid, or device blocked vibration.
 */
export function triggerDangerVibration(
  pattern: number[] = DEFAULT_VIBRATION_PATTERN
): boolean {
  if (!isVibrationSupported()) {
    return false;
  }

  if (
    !Array.isArray(pattern) ||
    pattern.length === 0 ||
    pattern.every((duration) => typeof duration !== 'number' || duration <= 0)
  ) {
    return false;
  }

  try {
    return Boolean(navigator.vibrate(pattern));
  } catch {
    return false;
  }
}
