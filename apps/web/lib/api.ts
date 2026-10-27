const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

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
 * Universal typed API fetcher:
 * - Automatically handles credentials: 'include' (HttpOnly cookie propagation)
 * - Intercepts 401 responses and triggers silent session refresh before retrying
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle 401 Unauthorized with silent token refresh
  if (response.status === 401 && !options.skipAuthRefresh && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/device')) {
    try {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (refreshRes.ok) {
        // Retry original request once
        return apiFetch<T>(endpoint, { ...options, skipAuthRefresh: true });
      }
    } catch {
      // Refresh failed, proceed to error throw below
    }
  }

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = json?.message || json?.error?.message || response.statusText || 'API request failed';
    throw new ApiError(errorMsg, response.status, json);
  }

  return json?.data !== undefined ? json.data : json;
}
