/**
 * Web Audio API Danger Alert Synthesizer
 *
 * Synthesizes a dual-pulse 800 Hz alert chime (120ms beep, 60ms silence, 120ms beep)
 * with smooth exponential decay curves entirely client-side using browser-native
 * Web Audio API (AudioContext / webkitAudioContext) at strictly $0 cost with ZERO
 * external sound assets or network requests.
 *
 * Designed to handle browser autoplay policies safely via gesture unlocking,
 * debounce siren spam with a 10s cooldown, and respect user mute preferences.
 */

export interface AudioAlertOptions {
  /** Override mute state for this specific chime call. */
  isMuted?: boolean;
  /** Oscillator base frequency in Hertz. Defaults to 800 Hz. */
  frequency?: number;
  /** Minimum interval in milliseconds between consecutive chimes. Defaults to 10,000 ms. */
  cooldownMs?: number;
  /** Simulated current timestamp in milliseconds (for deterministic testing). */
  currentTime?: number;
}

let sharedAudioContext: AudioContext | null = null;
let isMutedState = false;
let lastChimeTimestamp = 0;

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window !== 'undefined') {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    return w.AudioContext || w.webkitAudioContext || null;
  }
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    return g.AudioContext || g.webkitAudioContext || null;
  }
  return null;
}

/**
 * Returns true if the Web Audio context has been created and transitioned to 'running'.
 */
export function isAudioUnlocked(): boolean {
  return sharedAudioContext !== null && sharedAudioContext.state === 'running';
}

/**
 * Updates the global audio alert mute state.
 */
export function setAudioMuted(muted: boolean): void {
  isMutedState = Boolean(muted);
}

/**
 * Returns current global audio alert mute state.
 */
export function isAudioMuted(): boolean {
  return isMutedState;
}

/**
 * Unlocks or resumes the shared AudioContext in response to a user interaction gesture
 * (click, touchstart, keydown, or Live Tracking toggle) to satisfy browser autoplay policies.
 */
export async function unlockAudioContext(): Promise<void> {
  const AudioContextClass = getAudioContextConstructor();
  if (!AudioContextClass) return;

  try {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      sharedAudioContext = new AudioContextClass();
    }
    if (sharedAudioContext.state === 'suspended' && typeof sharedAudioContext.resume === 'function') {
      await sharedAudioContext.resume();
    }
  } catch {
    // Autoplay or initialization error silently absorbed to prevent breaking gesture handlers
  }
}

/**
 * Synthesizes and plays a dual-pulse 800 Hz chime.
 * Returns true if the chime was successfully scheduled, false if muted, in cooldown,
 * or blocked by browser autoplay/unsupported audio context.
 */
export async function playDangerAlertSound(options?: AudioAlertOptions): Promise<boolean> {
  const muted = options?.isMuted ?? isMutedState;
  if (muted) {
    return false;
  }

  const now = options?.currentTime ?? Date.now();
  const cooldownMs = options?.cooldownMs ?? 10_000;

  if (lastChimeTimestamp > 0 && now - lastChimeTimestamp < cooldownMs) {
    return false;
  }

  const AudioContextClass = getAudioContextConstructor();
  if (!AudioContextClass) {
    return false;
  }

  try {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      sharedAudioContext = new AudioContextClass();
    }

    if (sharedAudioContext.state === 'suspended' && typeof sharedAudioContext.resume === 'function') {
      await sharedAudioContext.resume();
    }

    if (sharedAudioContext.state !== 'running') {
      return false;
    }

    const ctx = sharedAudioContext;
    const frequency = options?.frequency ?? 800;
    const t0 = ctx.currentTime;

    // Pulse 1: 120ms beep with exponential decay
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(frequency, t0);
    gain1.gain.setValueAtTime(0.3, t0);
    gain1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t0);
    osc1.stop(t0 + 0.12);

    // Pulse 2: 120ms beep after 60ms silence (starts at t0 + 0.18s)
    const t1 = t0 + 0.18;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(frequency, t1);
    gain2.gain.setValueAtTime(0.3, t1);
    gain2.gain.exponentialRampToValueAtTime(0.001, t1 + 0.12);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t1);
    osc2.stop(t1 + 0.12);

    lastChimeTimestamp = now;
    return true;
  } catch {
    return false;
  }
}

/**
 * Test helper to reset internal singleton state between isolated test runs.
 */
export function _resetAudioStateForTesting(): void {
  isMutedState = false;
  lastChimeTimestamp = 0;
  sharedAudioContext = null;
}
