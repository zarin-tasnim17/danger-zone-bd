/**
 * Isolated DOM/Browser Storage polyfill for running Zustand stores, lib utilities,
 * and React components in pure Node without polluting state across tests.
 */

export class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

export interface MockGeolocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface MockGeolocationPosition {
  coords: MockGeolocationCoordinates;
  timestamp: number;
}

export interface MockGeolocationPositionError {
  code: number;
  message: string;
  PERMISSION_DENIED: 1;
  POSITION_UNAVAILABLE: 2;
  TIMEOUT: 3;
}

export type GeolocationSuccessCallback = (position: MockGeolocationPosition) => void;
export type GeolocationErrorCallback = (error: MockGeolocationPositionError) => void;

export class MockGeolocation {
  private nextWatchId = 1;
  private watches = new Map<
    number,
    {
      success: GeolocationSuccessCallback;
      error?: GeolocationErrorCallback;
      options?: PositionOptions;
    }
  >();
  private pendingGetCurrent: Array<{
    success: GeolocationSuccessCallback;
    error?: GeolocationErrorCallback;
    options?: PositionOptions;
  }> = [];

  public defaultPosition: MockGeolocationPosition | null = null;
  public defaultError: MockGeolocationPositionError | null = null;
  public clearedWatchIds: number[] = [];
  public calls: Array<{
    type: 'getCurrentPosition' | 'watchPosition' | 'clearWatch';
    options?: PositionOptions;
    id?: number;
    timestamp: number;
  }> = [];

  getCurrentPosition(
    success: GeolocationSuccessCallback,
    error?: GeolocationErrorCallback,
    options?: PositionOptions
  ): void {
    this.calls.push({
      type: 'getCurrentPosition',
      options,
      timestamp: Date.now(),
    });

    if (this.defaultError && error) {
      const err = this.defaultError;
      queueMicrotask(() => error(err));
      return;
    }

    if (this.defaultPosition) {
      const pos = this.defaultPosition;
      queueMicrotask(() => success(pos));
      return;
    }

    this.pendingGetCurrent.push({ success, error, options });
  }

  watchPosition(
    success: GeolocationSuccessCallback,
    error?: GeolocationErrorCallback,
    options?: PositionOptions
  ): number {
    const id = this.nextWatchId++;
    this.calls.push({
      type: 'watchPosition',
      options,
      id,
      timestamp: Date.now(),
    });

    this.watches.set(id, { success, error, options });

    if (this.defaultError && error) {
      const err = this.defaultError;
      queueMicrotask(() => error(err));
    } else if (this.defaultPosition) {
      const pos = this.defaultPosition;
      queueMicrotask(() => success(pos));
    }

    return id;
  }

  clearWatch(id: number): void {
    this.calls.push({
      type: 'clearWatch',
      id,
      timestamp: Date.now(),
    });
    this.clearedWatchIds.push(id);
    this.watches.delete(id);
  }

  get activeWatchCount(): number {
    return this.watches.size;
  }

  isWatchActive(id: number): boolean {
    return this.watches.has(id);
  }

  mockEmitPosition(pos: {
    coords: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      altitude?: number | null;
      altitudeAccuracy?: number | null;
      heading?: number | null;
      speed?: number | null;
    };
    timestamp?: number;
  }): void {
    const fullPosition: MockGeolocationPosition = {
      coords: {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? 15,
        altitude: pos.coords.altitude ?? null,
        altitudeAccuracy: pos.coords.altitudeAccuracy ?? null,
        heading: pos.coords.heading ?? null,
        speed: pos.coords.speed ?? null,
      },
      timestamp: pos.timestamp ?? Date.now(),
    };

    const pending = [...this.pendingGetCurrent];
    this.pendingGetCurrent = [];
    for (const req of pending) {
      req.success(fullPosition);
    }

    for (const [, watch] of this.watches) {
      watch.success(fullPosition);
    }
  }

  mockEmitPositionTo(
    watchId: number,
    pos: {
      coords: {
        latitude: number;
        longitude: number;
        accuracy?: number;
        altitude?: number | null;
        altitudeAccuracy?: number | null;
        heading?: number | null;
        speed?: number | null;
      };
      timestamp?: number;
    }
  ): boolean {
    const watch = this.watches.get(watchId);
    if (!watch) return false;

    const fullPosition: MockGeolocationPosition = {
      coords: {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? 15,
        altitude: pos.coords.altitude ?? null,
        altitudeAccuracy: pos.coords.altitudeAccuracy ?? null,
        heading: pos.coords.heading ?? null,
        speed: pos.coords.speed ?? null,
      },
      timestamp: pos.timestamp ?? Date.now(),
    };

    watch.success(fullPosition);
    return true;
  }

  mockEmitError(err: { code: number; message: string }): void {
    const fullError: MockGeolocationPositionError = {
      code: err.code,
      message: err.message,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };

    const pending = [...this.pendingGetCurrent];
    this.pendingGetCurrent = [];
    for (const req of pending) {
      if (req.error) {
        req.error(fullError);
      }
    }

    for (const [, watch] of this.watches) {
      if (watch.error) {
        watch.error(fullError);
      }
    }
  }

  mockClear(): void {
    this.watches.clear();
    this.pendingGetCurrent = [];
    this.clearedWatchIds = [];
    this.calls = [];
    this.defaultPosition = null;
    this.defaultError = null;
  }
}

// ---------------------------------------------------------------------------
// Web Audio API Mocks
// ---------------------------------------------------------------------------

export class MockAudioNode {
  connect(target: any) {
    return target;
  }
  disconnect() {}
}

export class MockAudioParam {
  value: number;
  constructor(initial = 0) {
    this.value = initial;
  }
  setValueAtTime(val: number, _time: number) {
    this.value = val;
  }
  exponentialRampToValueAtTime(val: number, _time: number) {
    this.value = val;
  }
  linearRampToValueAtTime(val: number, _time: number) {
    this.value = val;
  }
}

export class MockOscillatorNode extends MockAudioNode {
  type: OscillatorType = 'sine';
  frequency = new MockAudioParam(440);
  started = false;
  stopped = false;
  startTime?: number;
  stopTime?: number;

  start(time?: number) {
    this.started = true;
    this.startTime = time;
  }
  stop(time?: number) {
    this.stopped = true;
    this.stopTime = time;
  }
}

export class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam(1);
}

export class MockAudioContext {
  static instances: MockAudioContext[] = [];

  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = new MockAudioNode();
  oscillators: MockOscillatorNode[] = [];
  gains: MockGainNode[] = [];

  constructor() {
    MockAudioContext.instances.push(this);
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }

  async close(): Promise<void> {
    this.state = 'closed';
  }

  createOscillator(): MockOscillatorNode {
    const osc = new MockOscillatorNode();
    this.oscillators.push(osc);
    return osc;
  }

  createGain(): MockGainNode {
    const gain = new MockGainNode();
    this.gains.push(gain);
    return gain;
  }

  static reset(): void {
    MockAudioContext.instances = [];
  }
}

// ---------------------------------------------------------------------------
// Browser Notification API Mock
// ---------------------------------------------------------------------------

export class MockNotification {
  static permission: NotificationPermission = 'default';
  static instances: MockNotification[] = [];

  static async requestPermission(): Promise<NotificationPermission> {
    return MockNotification.permission;
  }

  static reset(): void {
    MockNotification.permission = 'default';
    MockNotification.instances = [];
  }

  title: string;
  options?: NotificationOptions;
  closed = false;

  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.options = options;
    MockNotification.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }
}

// ---------------------------------------------------------------------------
// Service Worker Registration Mock
// ---------------------------------------------------------------------------

export interface MockServiceWorkerRegistration {
  showNotification: (title: string, options?: any) => Promise<void>;
  notifications: Array<{ title: string; options?: any }>;
}

// ---------------------------------------------------------------------------
// Sandbox Handle & Installation
// ---------------------------------------------------------------------------

export interface BrowserSandboxHandle {
  localStorage: MemoryStorage;
  sessionStorage: MemoryStorage;
  geolocation: MockGeolocation;
  vibrations: Array<number | number[]>;
  notifications: typeof MockNotification;
  audioContextInstances: MockAudioContext[];
  serviceWorkerRegistration: MockServiceWorkerRegistration | null;
  setVisibilityState: (state: DocumentVisibilityState) => void;
  restore: () => void;
}

export interface InstallBrowserGlobalsOptions {
  origin?: string;
  online?: boolean;
  isSecureContext?: boolean;
  permissionState?: PermissionState;
  notificationPermission?: NotificationPermission;
  supportsVibration?: boolean;
  supportsServiceWorker?: boolean;
}

const createEventTarget = () => {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    addEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent: (event: { type: string }) => {
      const set = listeners.get(event.type);
      if (set) {
        for (const fn of set) {
          if (typeof fn === 'function') fn(event as any);
          else if (fn && typeof fn === 'object' && 'handleEvent' in fn) (fn as any).handleEvent(event);
        }
      }
      return true;
    },
    clear: () => listeners.clear(),
  };
};

export const installBrowserGlobals = (
  options: InstallBrowserGlobalsOptions = {}
): BrowserSandboxHandle => {
  const g = globalThis as Record<string, unknown>;
  const prev = {
    hasWindow: 'window' in g,
    window: g.window,
    hasDocument: 'document' in g,
    document: g.document,
    hasLocalStorage: 'localStorage' in g,
    localStorage: g.localStorage,
    hasSessionStorage: 'sessionStorage' in g,
    sessionStorage: g.sessionStorage,
    hasNavigator: 'navigator' in g,
    navigator: g.navigator,
    hasIsSecureContext: 'isSecureContext' in g,
    isSecureContext: g.isSecureContext,
    hasAudioContext: 'AudioContext' in g,
    audioContext: g.AudioContext,
    hasWebkitAudioContext: 'webkitAudioContext' in g,
    webkitAudioContext: g.webkitAudioContext,
    hasNotification: 'Notification' in g,
    notification: g.Notification,
    hasScreen: 'screen' in g,
    screen: g.screen,
    hasDevicePixelRatio: 'devicePixelRatio' in g,
    devicePixelRatio: g.devicePixelRatio,
  };

  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const mockGeolocation = new MockGeolocation();
  const origin = options.origin ?? 'http://127.0.0.1:3000';
  const urlObj = new URL(origin);
  const isSecure =
    options.isSecureContext ??
    (urlObj.protocol === 'https:' ||
      urlObj.hostname === 'localhost' ||
      urlObj.hostname === '127.0.0.1');

  const windowEvents = createEventTarget();
  const documentEvents = createEventTarget();

  const vibrationCalls: Array<number | number[]> = [];
  const swNotifications: Array<{ title: string; options?: any }> = [];

  const mockRegistration: MockServiceWorkerRegistration = {
    notifications: swNotifications,
    showNotification: async (title, options) => {
      swNotifications.push({ title, options });
    },
  };

  const mockServiceWorker =
    options.supportsServiceWorker !== false
      ? {
          ready: Promise.resolve(mockRegistration),
          getRegistration: async () => mockRegistration,
          register: async () => mockRegistration,
        }
      : undefined;

  const mockVibrate =
    options.supportsVibration !== false
      ? (pattern: number | number[]) => {
          vibrationCalls.push(pattern);
          return true;
        }
      : undefined;

  MockNotification.reset();
  MockNotification.permission = options.notificationPermission ?? 'default';
  MockAudioContext.reset();

  const mockScreen = {
    deviceXDPI: 96,
    logicalXDPI: 96,
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1080,
    colorDepth: 24,
    pixelDepth: 24,
  };

  const windowObj: Record<string, unknown> = {
    location: {
      origin,
      href: `${origin}/`,
      pathname: '/',
      search: '',
      hostname: urlObj.hostname,
      protocol: urlObj.protocol,
    },
    isSecureContext: isSecure,
    localStorage,
    sessionStorage,
    AudioContext: MockAudioContext,
    webkitAudioContext: MockAudioContext,
    Notification: MockNotification,
    screen: mockScreen,
    devicePixelRatio: 1,
    addEventListener: windowEvents.addEventListener,
    removeEventListener: windowEvents.removeEventListener,
    dispatchEvent: windowEvents.dispatchEvent,
  };

  const navigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  g.window = windowObj;
  g.isSecureContext = isSecure;
  g.AudioContext = MockAudioContext;
  g.webkitAudioContext = MockAudioContext;
  g.Notification = MockNotification;
  g.screen = mockScreen;
  g.devicePixelRatio = 1;

  let currentVisibilityState: DocumentVisibilityState = 'visible';

  const docObj: Record<string, unknown> = {
    cookie: '',
    title: 'DangerZoneBD Test',
    get visibilityState() {
      return currentVisibilityState;
    },
    set visibilityState(v: DocumentVisibilityState) {
      currentVisibilityState = v;
    },
    addEventListener: documentEvents.addEventListener,
    removeEventListener: documentEvents.removeEventListener,
    dispatchEvent: documentEvents.dispatchEvent,
    createElement: () => ({
      style: {},
      className: '',
      setAttribute: () => {},
      appendChild: () => {},
    }),
    documentElement: { style: {} },
  };

  windowObj.document = docObj;
  g.document = docObj;
  g.localStorage = localStorage;
  g.sessionStorage = sessionStorage;

  const mockPermissions = {
    query: async ({ name }: { name: string }) => ({
      state: options.permissionState ?? 'granted',
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  };

  try {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        onLine: options.online ?? true,
        userAgent: 'DangerZoneBD-WebAudit/1.0',
        platform: 'Win32',
        serviceWorker: mockServiceWorker,
        geolocation: mockGeolocation,
        permissions: mockPermissions,
        vibrate: mockVibrate,
      },
    });
  } catch {
    // Ignore if runtime locks navigator
  }

  windowObj.navigator = globalThis.navigator;

  return {
    localStorage,
    sessionStorage,
    geolocation: mockGeolocation,
    vibrations: vibrationCalls,
    notifications: MockNotification,
    audioContextInstances: MockAudioContext.instances,
    serviceWorkerRegistration: options.supportsServiceWorker !== false ? mockRegistration : null,
    setVisibilityState: (state: DocumentVisibilityState) => {
      currentVisibilityState = state;
      documentEvents.dispatchEvent({ type: 'visibilitychange' });
    },
    restore: () => {
      windowEvents.clear();
      documentEvents.clear();
      MockNotification.reset();
      MockAudioContext.reset();

      const restoreKey = (key: string, had: boolean, val: unknown) => {
        if (had) {
          g[key] = val;
        } else {
          delete g[key];
        }
      };
      restoreKey('window', prev.hasWindow, prev.window);
      restoreKey('document', prev.hasDocument, prev.document);
      restoreKey('localStorage', prev.hasLocalStorage, prev.localStorage);
      restoreKey('sessionStorage', prev.hasSessionStorage, prev.sessionStorage);
      restoreKey('isSecureContext', prev.hasIsSecureContext, prev.isSecureContext);
      restoreKey('AudioContext', prev.hasAudioContext, prev.audioContext);
      restoreKey('webkitAudioContext', prev.hasWebkitAudioContext, prev.webkitAudioContext);
      restoreKey('Notification', prev.hasNotification, prev.notification);
      restoreKey('screen', prev.hasScreen, prev.screen);
      restoreKey('devicePixelRatio', prev.hasDevicePixelRatio, prev.devicePixelRatio);

      if (navigatorDesc) {
        try {
          Object.defineProperty(globalThis, 'navigator', navigatorDesc);
        } catch {
          // ignore
        }
      } else {
        restoreKey('navigator', prev.hasNavigator, prev.navigator);
      }
    },
  };
};
