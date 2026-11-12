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

export interface BrowserSandboxHandle {
  localStorage: MemoryStorage;
  sessionStorage: MemoryStorage;
  restore: () => void;
}

export const installBrowserGlobals = (
  options: { origin?: string; online?: boolean } = {}
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
  };

  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const origin = options.origin ?? 'http://127.0.0.1:3000';

  const windowObj: Record<string, unknown> = {
    location: {
      origin,
      href: `${origin}/`,
      pathname: '/',
      search: '',
    },
    localStorage,
    sessionStorage,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };

  const navigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  g.window = windowObj;
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

  try {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        onLine: options.online ?? true,
        userAgent: 'DangerZoneBD-WebAudit/1.0',
        serviceWorker: undefined,
      },
    });
  } catch {
    // Ignore if runtime locks navigator
  }

  return {
    localStorage,
    sessionStorage,
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
