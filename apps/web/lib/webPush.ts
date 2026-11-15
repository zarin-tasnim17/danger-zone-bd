/**
 * Web Push VAPID Utilities & Standard Key Defaults
 */

/**
 * Application default VAPID public key (P-256 base64url uncompressed 65-byte EC point)
 * Used as standard Web Push applicationServerKey when NEXT_PUBLIC_VAPID_PUBLIC_KEY is not overridden.
 */
export const DEFAULT_VAPID_PUBLIC_KEY =
  "BEtmSYaZLymwNuQkRyYVz9YxDEE24DnaZps-8EWvh_Q6v9Hy1kTKXUxb1WvOLieZuaPcEKLpEkBD0WBjP49bxNE";

/**
 * Convert URL-safe base64 VAPID key into bytes for PushManager.subscribe.
 * Handles both browser atob and Node.js Buffer environments safely.
 * Strips surrounding whitespace and wrapping quotes.
 */
export const urlBase64ToUint8Array = (base64String: string): Uint8Array<ArrayBuffer> => {
  if (!base64String || typeof base64String !== "string") {
    throw new Error("Invalid VAPID base64 key: value must be a non-empty string");
  }

  const clean = base64String.trim().replace(/^["']|["']$/g, "");
  if (!clean) {
    throw new Error("Invalid VAPID base64 key: string is empty after trimming");
  }

  const padding = "=".repeat((4 - (clean.length % 4)) % 4);
  const base64 = (clean + padding).replace(/-/g, "+").replace(/_/g, "/");
  const atobFn =
    typeof window !== "undefined" && typeof window.atob === "function"
      ? window.atob.bind(window)
      : typeof atob === "function"
      ? atob
      : (str: string) => Buffer.from(str, "base64").toString("binary");

  let rawData: string;
  try {
    rawData = atobFn(base64);
  } catch (err: any) {
    throw new Error(`Failed to decode base64 VAPID key: ${err?.message || "Invalid encoding"}`);
  }

  const output = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
};

/**
 * Resolve the active VAPID public key from environment or fallback default.
 */
export const getVapidPublicKey = (): string => {
  const envKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim().replace(/^["']|["']$/g, "");
  return envKey || DEFAULT_VAPID_PUBLIC_KEY;
};
