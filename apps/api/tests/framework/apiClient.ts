import { TEST_CONFIG } from './config';

export interface ApiResponse<T = any> {
  status: number;
  ok: boolean;
  headers: Headers;
  setCookies: string[];
  body: T;
  rawText: string;
  durationMs: number;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
  rawBody?: string;
  timeoutMs?: number;
  useCookies?: boolean;
  bearerToken?: string;
  ip?: string;
}

export class ApiClient {
  private readonly cookies = new Map<string, string>();
  private defaultBearerToken?: string;
  private defaultIp?: string;

  constructor(private readonly baseUrl: string, defaultIp?: string) {
    this.defaultIp = defaultIp;
  }

  setBearerToken(token?: string): void {
    this.defaultBearerToken = token;
  }

  setIp(ip?: string): void {
    this.defaultIp = ip;
  }

  setCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  getCookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  clearCookies(): void {
    this.cookies.clear();
  }

  private ingestSetCookies(setCookieHeaders: string[]): void {
    for (const raw of setCookieHeaders) {
      const [pair, ...attrs] = raw.split(';').map((s) => s.trim());
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) continue;
      const name = pair.slice(0, eqIdx);
      const val = pair.slice(eqIdx + 1);
      const isCleared =
        val === '' ||
        attrs.some(
          (a) =>
            a.toLowerCase().startsWith('max-age=0') ||
            a.toLowerCase().includes('expires=thu, 01 jan 1970')
        );
      if (isCleared) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, val);
      }
    }
  }

  async request<T = any>(
    method: string,
    urlPath: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const fullUrl = urlPath.startsWith('http')
      ? urlPath
      : `${this.baseUrl}${urlPath.startsWith('/') ? urlPath : `/${urlPath}`}`;

    const headers = new Headers(options.headers || {});
    const ipToUse = options.ip ?? this.defaultIp;
    if (ipToUse && !headers.has('x-forwarded-for')) {
      headers.set('x-forwarded-for', ipToUse);
    }

    const token = options.bearerToken ?? this.defaultBearerToken;
    if (token && !headers.has('authorization')) {
      headers.set('authorization', `Bearer ${token}`);
    }

    if (options.useCookies !== false) {
      const cookieStr = this.getCookieHeader();
      if (cookieStr && !headers.has('cookie')) {
        headers.set('cookie', cookieStr);
      }
    }

    let bodyToSend: string | undefined;
    if (options.rawBody !== undefined) {
      bodyToSend = options.rawBody;
    } else if (options.body !== undefined) {
      bodyToSend = JSON.stringify(options.body);
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? TEST_CONFIG.defaultTimeoutMs
    );

    const started = performance.now();
    try {
      const response = await fetch(fullUrl, {
        method,
        headers,
        body: bodyToSend,
        signal: controller.signal,
      });

      const durationMs = Number((performance.now() - started).toFixed(2));
      const setCookies =
        typeof (response.headers as any).getSetCookie === 'function'
          ? (response.headers as any).getSetCookie()
          : response.headers.get('set-cookie')
          ? [response.headers.get('set-cookie') as string]
          : [];

      if (options.useCookies !== false && setCookies.length > 0) {
        this.ingestSetCookies(setCookies);
      }

      const rawText = await response.text();
      let parsedBody: any = rawText;
      if (rawText.length > 0) {
        try {
          parsedBody = JSON.parse(rawText);
        } catch {
          parsedBody = rawText;
        }
      } else {
        parsedBody = null;
      }

      return {
        status: response.status,
        ok: response.ok,
        headers: response.headers,
        setCookies,
        body: parsedBody as T,
        rawText,
        durationMs,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  get<T = any>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, options);
  }

  post<T = any>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, { ...options, body });
  }

  patch<T = any>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  put<T = any>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  delete<T = any>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, options);
  }
}
