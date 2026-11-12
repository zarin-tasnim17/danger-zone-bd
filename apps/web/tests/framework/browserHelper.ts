import http from 'http';
import { spawn, ChildProcess } from 'child_process';
import { AddressInfo } from 'net';
import path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { findChromiumExecutable, WEB_TEST_CONFIG } from './config';

export interface NextDevServerHandle {
  url: string;
  port: number;
  stop: () => Promise<void>;
}

export interface BrowserSessionTelemetry {
  consoleErrors: string[];
  pageErrors: string[];
  failedNetworkRequests: Array<{ url: string; method: string; errorText: string }>;
  httpErrorResponses: Array<{ url: string; status: number }>;
  apiCalls: Array<{ url: string; method: string; status: number }>;
}

const getFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as AddressInfo;
      srv.close((err) => (err ? reject(err) : resolve(addr.port)));
    });
  });

const waitForHttpReady = async (url: string, timeoutMs = 45000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  let lastErr = 'not started';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.status < 500 || res.status === 503) {
        return;
      }
      lastErr = `status ${res.status}`;
    } catch (e: any) {
      lastErr = e?.message || 'connect error';
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  throw new Error(`Timed out waiting for Next.js dev server at ${url} (${lastErr})`);
};

export const startNextDevForTest = async (apiBaseOrigin: string): Promise<NextDevServerHandle> => {
  const port = await getFreePort();
  const nextCli = path.join(WEB_TEST_CONFIG.repoRoot, 'node_modules/next/dist/bin/next');

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'development',
    INTERNAL_API_URL: apiBaseOrigin,
    NEXT_PUBLIC_API_URL: '/api/v1',
    NEXT_PUBLIC_SOCKET_URL: apiBaseOrigin,
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
  };

  const child: ChildProcess = spawn(
    process.execPath,
    [nextCli, 'dev', '-H', '127.0.0.1', '-p', String(port)],
    {
      cwd: WEB_TEST_CONFIG.webRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  let logs = '';
  child.stdout?.on('data', (chunk) => {
    logs += chunk.toString();
  });
  child.stderr?.on('data', (chunk) => {
    logs += chunk.toString();
  });

  const url = `http://127.0.0.1:${port}`;
  try {
    await waitForHttpReady(`${url}/api/health`, 60000);
  } catch (err: any) {
    child.kill('SIGTERM');
    throw new Error(`${err.message}\nNext.js logs:\n${logs.slice(-1200)}`);
  }

  return {
    url,
    port,
    stop: async () => {
      if (child.exitCode !== null) return;
      child.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (child.exitCode === null) child.kill('SIGKILL');
          resolve();
        }, 5000);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
  };
};

export interface HeadlessBrowserSession {
  browser: Browser;
  page: Page;
  telemetry: BrowserSessionTelemetry;
  clearTelemetry: () => void;
  close: () => Promise<void>;
}

export const launchHeadlessBrowser = async (): Promise<HeadlessBrowserSession> => {
  const executablePath = findChromiumExecutable();
  if (!executablePath) {
    throw new Error('No Chromium/Edge/Chrome executable found for browser E2E testing.');
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const telemetry: BrowserSessionTelemetry = {
    consoleErrors: [],
    pageErrors: [],
    failedNetworkRequests: [],
    httpErrorResponses: [],
    apiCalls: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      telemetry.consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err: unknown) => {
    telemetry.pageErrors.push(err instanceof Error ? err.message : String(err));
  });

  page.on('requestfailed', (req) => {
    const reqUrl = req.url();
    // Ignore external tile/font CDN noise in restricted offline environments if any; record local/API failures
    telemetry.failedNetworkRequests.push({
      url: reqUrl,
      method: req.method(),
      errorText: req.failure()?.errorText || 'failed',
    });
  });

  page.on('response', (res) => {
    const resUrl = res.url();
    const status = res.status();
    if (resUrl.includes('/api/') || resUrl.includes('/health')) {
      telemetry.apiCalls.push({
        url: resUrl,
        method: res.request().method(),
        status,
      });
      if (status >= 400) {
        telemetry.httpErrorResponses.push({ url: resUrl, status });
      }
    }
  });

  return {
    browser,
    page,
    telemetry,
    clearTelemetry: () => {
      telemetry.consoleErrors.length = 0;
      telemetry.pageErrors.length = 0;
      telemetry.failedNetworkRequests.length = 0;
      telemetry.httpErrorResponses.length = 0;
      telemetry.apiCalls.length = 0;
    },
    close: async () => {
      await browser.close();
    },
  };
};
