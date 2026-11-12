import path from 'path';
import crypto from 'crypto';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';
import { WEB_TEST_CONFIG } from './config';

export interface LiveServerInstance {
  baseUrl: string;
  apiBaseUrl: string;
  stop: () => Promise<void>;
}

export interface LiveTrackerInstance {
  trackUser: (id?: string) => void;
  trackReport: (id?: string) => void;
  trackAlertZone: (id?: string) => void;
  trackSafeZone: (id?: string) => void;
  trackVerification: (id?: string) => void;
  trackModerationLog: (id?: string) => void;
  trackMedia: (id?: string) => void;
  trackNewsArticle: (id?: string) => void;
  cleanup: () => Promise<void>;
}

export interface OrphanSnapshot {
  ORPHAN_USERS: number;
  ORPHAN_REPORTS: number;
  ORPHAN_SAFE_ZONES: number;
  ORPHAN_ALERT_ZONES: number;
  ORPHAN_REFRESH_TOKENS: number;
  ORPHAN_MOD_LOGS: number;
}

/**
 * Simple in-memory HTTP cookie jar modeling a browser's HttpOnly cookie storage
 * when running `apiFetch` / `useAuthStore` in Node against the live local Express API.
 */
export class TestCookieJar {
  private cookies = new Map<string, string>();

  clear(): void {
    this.cookies.clear();
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }

  headerValue(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  captureFromResponse(res: Response): void {
    const anyHeaders = res.headers as unknown as {
      getSetCookie?: () => string[];
      raw?: () => Record<string, string[]>;
    };
    const setCookies: string[] =
      typeof anyHeaders.getSetCookie === 'function'
        ? anyHeaders.getSetCookie()
        : res.headers.get('set-cookie')
          ? [res.headers.get('set-cookie')!]
          : [];

    for (const raw of setCookies) {
      const [pair, ...attrs] = raw.split(';').map((s) => s.trim());
      const eqIdx = pair.indexOf('=');
      if (eqIdx <= 0) continue;
      const name = pair.slice(0, eqIdx).trim();
      const val = pair.slice(eqIdx + 1).trim();
      const maxAgeZero = attrs.some((a) => /^max-age=0$/i.test(a));
      const expiresPast = attrs.some((a) => /^expires=.*1970/i.test(a));
      if (!val || maxAgeZero || expiresPast) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, val);
      }
    }
  }
}

export interface LiveHarnessContext {
  server: LiveServerInstance;
  tracker: LiveTrackerInstance;
  prisma: any;
  cookieJar: TestCookieJar;
  rawFetch: typeof globalThis.fetch;
  installBrowserProxyFetch: () => () => void;
  createEphemeralAdmin: (email: string, password: string) => Promise<{ id: string; email: string }>;
  getOrphanCounts: () => Promise<OrphanSnapshot>;
  teardown: () => Promise<void>;
}

const apiModuleUrl = (relPath: string): string =>
  pathToFileURL(path.join(WEB_TEST_CONFIG.apiRoot, relPath)).href;

export const startLiveBackendHarness = async (): Promise<LiveHarnessContext> => {
  // Force HTTP-friendly test cookies and rate-limit settings BEFORE loading apps/api/.env
  if (process.env.NODE_ENV !== 'test') {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
  }

  const serverMod = (await import(apiModuleUrl('tests/framework/server.ts'))) as {
    startTestServer: () => Promise<LiveServerInstance>;
  };
  const dbMod = (await import(apiModuleUrl('tests/framework/dbTracker.ts'))) as {
    TestDataTracker: new () => LiveTrackerInstance;
    prisma: any;
  };

  const server = await serverMod.startTestServer();
  const tracker = new dbMod.TestDataTracker();
  const cookieJar = new TestCookieJar();
  const rawFetch = globalThis.fetch;

  // Snapshot baseline DB counts so we detect any test-leaked orphans cleanly
  const baseline = {
    users: await dbMod.prisma.user.count(),
    reports: await dbMod.prisma.report.count(),
    safeZones: await dbMod.prisma.safeZone.count(),
    alertZones: await dbMod.prisma.userAlertZone.count(),
    refreshTokens: await dbMod.prisma.refreshToken.count(),
    modLogs: await dbMod.prisma.moderationLog.count(),
  };

  const prevInternalUrl = process.env.INTERNAL_API_URL;
  const prevPublicUrl = process.env.NEXT_PUBLIC_API_URL;
  process.env.INTERNAL_API_URL = server.baseUrl;
  process.env.NEXT_PUBLIC_API_URL = `${server.baseUrl}/api/v1`;

  /**
   * Simulates the browser + Next.js rewrite proxy in Node:
   * - Rewrites relative `/api/v1/...` URLs to `${server.baseUrl}/api/v1/...`
   * - Attaches stored HttpOnly cookies when `credentials === 'include'`
   * - Captures `Set-Cookie` headers back into the test `cookieJar`
   */
  const installBrowserProxyFetch = (): (() => void) => {
    const saved = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      let targetUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (targetUrl.startsWith('/')) {
        targetUrl = `${server.baseUrl}${targetUrl}`;
      }

      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (init?.credentials === 'include' || !init?.credentials) {
        const cookieHeader = cookieJar.headerValue();
        if (cookieHeader && !headers.has('cookie')) {
          headers.set('cookie', cookieHeader);
        }
      }

      const res = await rawFetch(targetUrl, {
        ...init,
        headers,
      });

      if (targetUrl.startsWith(server.baseUrl)) {
        cookieJar.captureFromResponse(res);
      }
      return res;
    };

    return () => {
      globalThis.fetch = saved;
    };
  };

  const getOrphanCounts = async (): Promise<OrphanSnapshot> => {
    const [users, reports, safeZones, alertZones, refreshTokens, modLogs] = await Promise.all([
      dbMod.prisma.user.count(),
      dbMod.prisma.report.count(),
      dbMod.prisma.safeZone.count(),
      dbMod.prisma.userAlertZone.count(),
      dbMod.prisma.refreshToken.count(),
      dbMod.prisma.moderationLog.count(),
    ]);
    return {
      ORPHAN_USERS: Math.max(0, users - baseline.users),
      ORPHAN_REPORTS: Math.max(0, reports - baseline.reports),
      ORPHAN_SAFE_ZONES: Math.max(0, safeZones - baseline.safeZones),
      ORPHAN_ALERT_ZONES: Math.max(0, alertZones - baseline.alertZones),
      ORPHAN_REFRESH_TOKENS: Math.max(0, refreshTokens - baseline.refreshTokens),
      ORPHAN_MOD_LOGS: Math.max(0, modLogs - baseline.modLogs),
    };
  };

  const teardown = async (): Promise<void> => {
    try {
      await tracker.cleanup();
    } finally {
      await server.stop();
      if (prevInternalUrl === undefined) delete process.env.INTERNAL_API_URL;
      else process.env.INTERNAL_API_URL = prevInternalUrl;
      if (prevPublicUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
      else process.env.NEXT_PUBLIC_API_URL = prevPublicUrl;
    }
  };

  const createEphemeralAdmin = async (
    email: string,
    password: string
  ): Promise<{ id: string; email: string }> => {
    const apiRequire = createRequire(path.join(WEB_TEST_CONFIG.apiRoot, 'package.json'));
    const bcrypt = apiRequire('bcrypt') as { hash: (plain: string, rounds: number) => Promise<string> };
    const passwordHash = await bcrypt.hash(password, 10);
    const created = await dbMod.prisma.user.create({
      data: {
        anonymousId: `admin-test-${crypto.randomUUID()}`,
        email: email.trim().toLowerCase(),
        passwordHash,
        role: 'ADMIN',
        isVerified: true,
        trustScore: 100,
      },
      select: { id: true, email: true },
    });
    tracker.trackUser(created.id);
    return { id: created.id, email: created.email };
  };

  return {
    server,
    tracker,
    prisma: dbMod.prisma,
    cookieJar,
    rawFetch,
    installBrowserProxyFetch,
    createEphemeralAdmin,
    getOrphanCounts,
    teardown,
  };
};
