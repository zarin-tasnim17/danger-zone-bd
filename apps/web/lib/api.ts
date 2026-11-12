import { setSocketAuthToken } from './socket';

export interface ApiFetchOptions extends RequestInit {
  skipAuthRefresh?: boolean;
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

/**
 * Coalesces concurrent 401 refresh attempts behind a single in-flight promise so
 * single-use rotated refresh tokens are never consumed twice simultaneously.
 */
async function refreshSessionSingleFlight(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshUrl = resolveApiUrl('/auth/refresh');
        const refreshRes = await fetch(refreshUrl, {
          method: 'POST',
          credentials: 'include',
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
 * - Intercepts 401 responses and triggers silent session refresh before retrying
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const url = resolveApiUrl(endpoint);

  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (networkErr: any) {
    throw new ApiError(
      networkErr?.message || 'Network connection failed. API is unreachable.',
      0,
      { isNetworkError: true }
    );
  }

  // Handle 401 Unauthorized with single-flight silent token refresh
  if (
    response.status === 401 &&
    shouldAttemptSilentRefresh(endpoint, options.skipAuthRefresh)
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
