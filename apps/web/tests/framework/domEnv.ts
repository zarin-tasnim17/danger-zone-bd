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

export interface BrowserSandboxHandle {
  localStorage: MemoryStorage;
  sessionStorage: MemoryStorage;
  geolocation: MockGeolocation;
  restore: () => void;
}

export const installBrowserGlobals = (
  options: {
    origin?: string;
    online?: boolean;
    isSecureContext?: boolean;
    permissionState?: PermissionState;
  } = {}
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
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };

  const navigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  g.window = windowObj;
  g.isSecureContext = isSecure;
  g.document = {
    cookie: '',
    title: 'DangerZoneBD Test',
    visibilityState: 'visible',
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: () => ({}),
  };
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
        serviceWorker: undefined,
        geolocation: mockGeolocation,
        permissions: mockPermissions,
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
    restore: () => {
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
