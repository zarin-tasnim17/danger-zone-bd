/**
 * Deterministic HTTP Fetch mock/interceptor for unit, resilient-error, and state tests.
 * Clearly isolated from live backend tests (zero shared global leakage).
 */

export interface MockCallRecord {
  index: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  credentials?: RequestCredentials;
  bodyText: string | null;
  bodyJson: unknown;
  isFormData: boolean;
  timestampMs: number;
}

export interface MockHandlerContext {
  call: MockCallRecord;
  signal?: AbortSignal | null;
}

export type MockRouteHandler = (
  ctx: MockHandlerContext
) => Promise<Response> | Response;

export interface FetchMockController {
  calls: MockCallRecord[];
  on: (
    matcher: string | RegExp | ((url: string, init?: RequestInit) => boolean),
    handler: MockRouteHandler,
    options?: { method?: string; once?: boolean }
  ) => FetchMockController;
  setDefault: (handler: MockRouteHandler) => FetchMockController;
  getCallsFor: (substrOrRegex: string | RegExp, method?: string) => MockCallRecord[];
  reset: () => void;
  restore: () => void;
}

interface RegisteredRoute {
  matcher: string | RegExp | ((url: string, init?: RequestInit) => boolean);
  method?: string;
  once?: boolean;
  handler: MockRouteHandler;
}

export const jsonResponse = (
  payload: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

export const textResponse = (
  body: string,
  status = 200,
  contentType = 'text/plain'
): Response =>
  new Response(body, {
    status,
    headers: { 'Content-Type': contentType },
  });

export const htmlErrorResponse = (status = 502): Response =>
  textResponse(`<html><body><h1>${status} Bad Gateway</h1></body></html>`, status, 'text/html');

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const installFetchMock = (): FetchMockController => {
  const originalFetch = globalThis.fetch;
  const routes: RegisteredRoute[] = [];
  const calls: MockCallRecord[] = [];
  let defaultHandler: MockRouteHandler = ({ call }) =>
    jsonResponse(
      {
        success: false,
        error: {
          code: 'UNMOCKED_FETCH',
          message: `No mock handler matched ${call.method} ${call.url}`,
        },
      },
      500
    );

  const normalizeHeaders = (h?: HeadersInit): Record<string, string> => {
    const result: Record<string, string> = {};
    if (!h) return result;
    if (h instanceof Headers) {
      h.forEach((v, k) => {
        result[k.toLowerCase()] = v;
      });
      return result;
    }
    if (Array.isArray(h)) {
      for (const [k, v] of h) {
        result[k.toLowerCase()] = v;
      }
      return result;
    }
    for (const [k, v] of Object.entries(h)) {
      if (v !== undefined) result[k.toLowerCase()] = String(v);
    }
    return result;
  };

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
    const bodyText = typeof init?.body === 'string' ? init.body : null;
    let bodyJson: unknown = null;
    if (bodyText) {
      try {
        bodyJson = JSON.parse(bodyText);
      } catch {
        bodyJson = null;
      }
    }

    const record: MockCallRecord = {
      index: calls.length,
      url,
      method,
      headers: normalizeHeaders(init?.headers),
      credentials: init?.credentials,
      bodyText,
      bodyJson,
      isFormData,
      timestampMs: Date.now(),
    };
    calls.push(record);

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      if (route.method && route.method !== method) continue;
      let matched = false;
      if (typeof route.matcher === 'string') {
        matched = url.includes(route.matcher);
      } else if (route.matcher instanceof RegExp) {
        matched = route.matcher.test(url);
      } else {
        matched = route.matcher(url, init);
      }
      if (matched) {
        if (route.once) {
          routes.splice(i, 1);
        }
        return route.handler({ call: record, signal: init?.signal });
      }
    }

    return defaultHandler({ call: record, signal: init?.signal });
  };

  const controller: FetchMockController = {
    calls,
    on(matcher, handler, options) {
      routes.push({
        matcher,
        method: options?.method?.toUpperCase(),
        once: options?.once,
        handler,
      });
      return controller;
    },
    setDefault(handler) {
      defaultHandler = handler;
      return controller;
    },
    getCallsFor(substrOrRegex, method) {
      return calls.filter((c) => {
        if (method && c.method !== method.toUpperCase()) return false;
        return typeof substrOrRegex === 'string'
          ? c.url.includes(substrOrRegex)
          : substrOrRegex.test(c.url);
      });
    },
    reset() {
      routes.length = 0;
      calls.length = 0;
    },
    restore() {
      globalThis.fetch = originalFetch;
    },
  };

  return controller;
};
