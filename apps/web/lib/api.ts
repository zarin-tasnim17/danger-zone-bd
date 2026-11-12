import { setSocketAuthToken } from './socket';

export interface ApiFetchOptions extends RequestInit {
  skipAuthRefresh?: boolean;
  timeoutMs?: number;
}

export class ApiError extends Error {
  statusCode: number;
  data: any;

  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

/**
 * Universal endpoint resolver:
 * - In the browser, always targets same-origin /api/v1 to leverage the Next.js reverse proxy.
 *   This ensures HttpOnly SameSite=Strict cookies (accessToken, refreshToken) are stored
 *   as first-party cookies, eliminates cross-origin restrictions, and avoids CORS preflights.
 * - On the server (SSR), uses INTERNAL_API_URL or defaults to localhost.
 * - Deduplicates /api/v1 prefixing if already supplied.
 */
export function resolveApiUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  // Determine base prefix
  const isBrowser = typeof window !== 'undefined';
  const rawBase = isBrowser
    ? '/api/v1'
    : (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');

  const base = isBrowser || rawBase.endsWith('/api/v1') ? rawBase : `${rawBase}/api/v1`;

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // If endpoint already has /api/v1 prefix, don't duplicate
  if (cleanEndpoint.startsWith('/api/v1/')) {
    if (isBrowser) return cleanEndpoint;
    const origin = rawBase.replace(/\/api\/v1$/, '');
    return `${origin}${cleanEndpoint}`;
  }

  return `${base}${cleanEndpoint}`;
}

const AUTH_NO_REFRESH_PATHS = [
  '/auth/refresh',
  '/auth/device',
  '/auth/login',
  '/auth/logout',
];

let refreshPromise: Promise<boolean> | null = null;

const DEFAULT_API_TIMEOUT_MS = 25000;
const UUID_CLEANUP_TIMEOUT_MS = 15000;

function createRequestSignal(
  timeoutMs: number,
  callerSignal?: AbortSignal | null
): {
  signal: AbortSignal;
  didTimeout: () => boolean;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;

  const onCallerAbort = () => {
    controller.abort(callerSignal?.reason);
  };

  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort(callerSignal.reason);
    } else {
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  const timerId =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort(new DOMException('Request timed out', 'AbortError'));
        }, timeoutMs)
      : null;

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      if (timerId !== null) clearTimeout(timerId);
      if (callerSignal) {
        callerSignal.removeEventListener('abort', onCallerAbort);
      }
    },
  };
}

/**
 * Coalesces concurrent 401 refresh attempts behind a single in-flight promise so
 * single-use rotated refresh tokens are never consumed twice simultaneously.
 */
async function refreshSessionSingleFlight(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const timeoutGuard = createRequestSignal(UUID_CLEANUP_TIMEOUT_MS);
      try {
        const refreshUrl = resolveApiUrl('/auth/refresh');
        const refreshRes = await fetch(refreshUrl, {
          method: 'POST',
          credentials: 'include',
          signal: timeoutGuard.signal,
        });

        if (!refreshRes.ok) {
          return false;
        }

        const refreshJson = await refreshRes.json().catch(() => null);
        if (typeof window !== 'undefined' && refreshJson?.data?.socketToken) {
          setSocketAuthToken(refreshJson.data.socketToken);
        }
        return true;
      } catch {
        return false;
      } finally {
        timeoutGuard.cleanup();
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

function shouldAttemptSilentRefresh(endpoint: string, skipAuthRefresh?: boolean): boolean {
  if (skipAuthRefresh) return false;
  const endpointPath = endpoint.split('?')[0];
  return !AUTH_NO_REFRESH_PATHS.some((path) => endpointPath.includes(path));
}

/**
 * Universal typed API fetcher:
 * - Automatically handles credentials: 'include' (HttpOnly cookie propagation)
 * - Enforces default AbortController timeout (25000ms) linked with optional caller signal
 * - Intercepts 401 responses and triggers silent session refresh before retrying
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const url = resolveApiUrl(endpoint);
  const {
    skipAuthRefresh,
    timeoutMs = DEFAULT_API_TIMEOUT_MS,
    signal: callerSignal,
    ...fetchOptions
  } = options;

  const headers: Record<string, string> = {
    ...(fetchOptions.body && !(fetchOptions.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  const requestGuard = createRequestSignal(timeoutMs, callerSignal);
  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      signal: requestGuard.signal,
      headers,
      credentials: 'include',
    });
  } catch (networkErr: any) {
    const timedOut = requestGuard.didTimeout();
    throw new ApiError(
      timedOut
        ? 'Request timed out. Please try again.'
        : networkErr?.message || 'Network connection failed. API is unreachable.',
      0,
      { isNetworkError: true, ...(timedOut ? { isTimeout: true } : {}) }
    );
  } finally {
    requestGuard.cleanup();
  }

  // Handle 401 Unauthorized with single-flight silent token refresh
  if (
    response.status === 401 &&
    shouldAttemptSilentRefresh(endpoint, skipAuthRefresh)
  ) {
    const refreshed = await refreshSessionSingleFlight();
    if (refreshed) {
      // Retry original request once
      return apiFetch<T>(endpoint, { ...options, skipAuthRefresh: true });
    }
  }

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg =
      json?.message ||
      json?.error?.message ||
      json?.error ||
      response.statusText ||
      `API request failed with status ${response.status}`;
    throw new ApiError(errorMsg, response.status, json);
  }

  return json?.data !== undefined ? json.data : json;
}
