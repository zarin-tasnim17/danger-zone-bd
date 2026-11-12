import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startLiveBackendHarness, type LiveHarnessContext } from '../framework/liveHarness';
import {
  launchHeadlessBrowser,
  startNextDevForTest,
  type HeadlessBrowserSession,
  type NextDevServerHandle,
} from '../framework/browserHelper';
import { findChromiumExecutable, WEB_TEST_CONFIG } from '../framework/config';

const canRunBrowserE2E =
  WEB_TEST_CONFIG.runBrowserE2E && Boolean(findChromiumExecutable());

const waitUntil = async (predicate: () => boolean, timeoutMs = 20000, label = 'condition') => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for ${label} after ${timeoutMs}ms`);
};

describe('[E2E][Real Chromium Browser] Full Next.js + Live API Roundtrip Verification', { skip: !canRunBrowserE2E }, () => {
  let harness: LiveHarnessContext;
  let nextServer: NextDevServerHandle;
  let browserSession: HeadlessBrowserSession;
  const runTag = `E2E-BROWSER-${Date.now()}`;
  let createdBrowserDeviceId: string | null = null;

  before(async () => {
    harness = await startLiveBackendHarness();
    nextServer = await startNextDevForTest(harness.server.baseUrl);
    browserSession = await launchHeadlessBrowser();
  });

  after(async () => {
    try {
      if (browserSession) await browserSession.close();
    } finally {
      try {
        if (nextServer) await nextServer.stop();
      } finally {
        const browserReports = await harness.prisma.report.findMany({
          where: { description: { contains: runTag } },
          select: { id: true, userId: true },
        });
        for (const r of browserReports) {
          harness.tracker.trackReport(r.id);
          harness.tracker.trackUser(r.userId);
        }

        if (createdBrowserDeviceId) {
          const browserUser = await harness.prisma.user.findUnique({
            where: { anonymousId: createdBrowserDeviceId },
            select: { id: true },
          });
          if (browserUser) harness.tracker.trackUser(browserUser.id);
        }

        await harness.teardown();
      }
    }
  });

  it('loads /, completes real browser anonymous HttpOnly auth + feed + safe-zones + stats without page errors', async () => {
    const { page, telemetry } = browserSession;
    await page.goto(`${nextServer.url}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await waitUntil(
      () =>
        telemetry.apiCalls.some((c) => c.url.includes('/api/v1/auth/device') && (c.status === 200 || c.status === 201)) &&
        telemetry.apiCalls.some((c) => c.url.includes('/api/v1/users/me') && (c.status === 200 || c.status === 304)),
      30000,
      'browser anonymous auth + /users/me bootstrap'
    );

    assert.equal(telemetry.pageErrors.length, 0, `Uncaught page errors: ${telemetry.pageErrors.join('; ')}`);

    createdBrowserDeviceId = await page.evaluate(() => localStorage.getItem('bd_safety_device_id'));
    assert.ok(createdBrowserDeviceId && createdBrowserDeviceId.length >= 4);
  });

  it('submits an interactive incident form on /report and opens its live /reports/[id] dossier', async () => {
    const { page, telemetry } = browserSession;
    browserSession.clearTelemetry();

    await page.goto(`${nextServer.url}/report`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('main form textarea', { timeout: 30000 });
    // Wait until client auth bootstrap finishes so React hydration & onChange handlers are active
    await waitUntil(
      () => telemetry.apiCalls.some((c) => c.url.includes('/api/v1/users/me')),
      20000,
      '/report client hydration and auth bootstrap'
    );

    const expectedDesc = `${runTag} Interactive Chromium E2E incident submission.`;
    // Wait until React 18 attaches event handlers (__reactProps*) before updating the controlled textarea
    await page.waitForFunction(() => {
      const el = document.querySelector('main form textarea');
      return Boolean(el && Object.keys(el).some((k) => k.startsWith('__reactProps')));
    }, { timeout: 15000 });

    await page.evaluate((desc: string) => {
      const el = document.querySelector('main form textarea') as HTMLTextAreaElement | null;
      if (!el) throw new Error('Textarea not found');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(el, desc);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, expectedDesc);

    await page.waitForFunction(
      (tag: string) => {
        const el = document.querySelector('main form textarea') as HTMLTextAreaElement | null;
        return Boolean(el && el.value.includes(tag) && el.value.length > 20);
      },
      { timeout: 10000 },
      runTag
    );

    const reportResponsePromise = page.waitForResponse(
      (res) => res.url().endsWith('/api/v1/reports') && res.request().method() === 'POST',
      { timeout: 25000 }
    );

    const submitDiagnostic = await page.evaluate(() => {
      const form = document.querySelector('main form') as HTMLFormElement | null;
      const btn = document.querySelector('main form button[type="submit"]') as HTMLButtonElement | null;
      if (!form || !btn) {
        return { found: false, disabled: null, text: null };
      }
      btn.scrollIntoView({ block: 'center' });
      const wasDisabled = btn.disabled;
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit(btn);
      } else {
        btn.click();
      }
      return {
        found: true,
        disabled: wasDisabled,
        text: btn.innerText,
      };
    });
    assert.equal(submitDiagnostic.found, true, 'Expected submit button inside main form on /report');

    let reportResponse;
    try {
      reportResponse = await reportResponsePromise;
    } catch (waitErr: any) {
      const pageSnapshot = await page.evaluate(() => ({
        isDisabledNow: (document.querySelector('main form button[type="submit"]') as HTMLButtonElement | null)?.disabled,
        bodySnippet: document.body.innerText.slice(0, 600),
      }));
      throw new Error(
        `Timed out waiting for POST /api/v1/reports (${waitErr.message}). submitDiagnostic=${JSON.stringify(
          submitDiagnostic
        )} pageSnapshot=${JSON.stringify(pageSnapshot)} consoleErrors=${JSON.stringify(
          telemetry.consoleErrors
        )} failedNet=${JSON.stringify(telemetry.failedNetworkRequests)} apiCalls=${JSON.stringify(telemetry.apiCalls)}`
      );
    }
    assert.ok(
      reportResponse.status() === 201 || reportResponse.status() === 200,
      `Expected POST /api/v1/reports 201|200, got ${reportResponse.status()}`
    );
    const createdBody = (await reportResponse.json()) as {
      success?: boolean;
      data?: { id?: string; userId?: string; description?: string };
    };
    const reportId = createdBody.data?.id;
    assert.ok(reportId, `POST /api/v1/reports response missing data.id: ${JSON.stringify(createdBody)}`);
    harness.tracker.trackReport(reportId);
    if (createdBody.data?.userId) harness.tracker.trackUser(createdBody.data.userId);

    await page.waitForFunction(
      () => document.body.innerText.toLowerCase().includes('incident published successfully'),
      { timeout: 15000 }
    );

    const created = await harness.prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, description: true },
    });
    assert.ok(created?.id, 'Submitted report must be persisted in PostgreSQL');
    assert.ok(created.description.includes(runTag), `Expected persisted description to contain ${runTag}, got ${created.description}`);

    await page.goto(`${nextServer.url}/reports/${reportId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(
      (tag: string) => document.body.innerText.includes(tag),
      { timeout: 25000 },
      runTag
    );
    assert.equal(telemetry.pageErrors.length, 0, `Page errors during report/dossier flow: ${telemetry.pageErrors.join('; ')}`);
  });

  it('navigates all remaining routes (/feed, /routes, /safe-zones, /alerts, /profile, /health, /dev-test, /admin) with 0 uncaught runtime errors', async () => {
    const { page, telemetry } = browserSession;
    const routes = ['/feed', '/routes', '/safe-zones', '/alerts', '/profile', '/health', '/dev-test', '/admin'];

    for (const route of routes) {
      browserSession.clearTelemetry();
      await page.goto(`${nextServer.url}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 1200));

      assert.equal(
        telemetry.pageErrors.length,
        0,
        `Uncaught JS runtime error on ${route}: ${telemetry.pageErrors.join('; ')}`
      );

      const server500s = telemetry.httpErrorResponses.filter((r) => r.status >= 500);
      assert.equal(server500s.length, 0, `HTTP 5xx error on ${route}: ${JSON.stringify(server500s)}`);
    }

    // Verify /health probes live backend + Next /api/health returns 200
    await page.goto(`${nextServer.url}/health`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitUntil(
      () =>
        telemetry.apiCalls.some(
          (c) => (c.url.endsWith('/health') || c.url.endsWith('/api/v1/health')) && c.status === 200
        ) &&
        telemetry.apiCalls.some(
          (c) => (c.url.endsWith('/health/db') || c.url.endsWith('/api/v1/health/db')) && c.status === 200
        ),
      20000,
      '/health probes to complete'
    );
    const nextHealthStatus = await page.evaluate(async () => {
      const r = await fetch('/api/health');
      return r.status;
    });
    assert.equal(nextHealthStatus, 200);
  });
});
