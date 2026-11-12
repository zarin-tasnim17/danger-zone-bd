import { ALL_BACKEND_ENDPOINT_IDS } from './contractSchemas';

export interface EndpointCoverageMeta {
  id: string;
  route: string;
  frontendIntegration:
    | 'CONSUMED'
    | 'PROXY_OR_CRON'
    | 'BACKEND_ONLY_WEBHOOK'
    | 'BACKEND_ONLY_API';
  testedMocked: boolean;
  testedContract: boolean;
  testedLiveBackend: boolean;
  testedBrowserE2E: boolean;
}

/**
 * Exact 1:1 mirror of `EP-001`..`EP-047` from `apps/api/docs/testing/API_Endpoint_Inventory.md`.
 */
export const ENDPOINT_COVERAGE_MANIFEST: EndpointCoverageMeta[] = [
  { id: 'EP-001', route: 'GET /', frontendIntegration: 'BACKEND_ONLY_API', testedMocked: false, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-002', route: 'GET /health', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: true },
  { id: 'EP-003', route: 'GET /health/db', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: true },
  { id: 'EP-004', route: 'GET /api/v1/health', frontendIntegration: 'BACKEND_ONLY_API', testedMocked: false, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-005', route: 'GET /api/v1/health/db', frontendIntegration: 'BACKEND_ONLY_API', testedMocked: false, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-006', route: 'POST /api/v1/auth/device', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: true },
  { id: 'EP-007', route: 'POST /api/v1/auth/login', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-008', route: 'POST /api/v1/auth/refresh', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: false, testedBrowserE2E: false },
  { id: 'EP-009', route: 'POST /api/v1/auth/logout', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-010', route: 'GET /api/v1/users/me', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: true },
  { id: 'EP-011', route: 'POST /api/v1/users/verify', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-012', route: 'POST /api/v1/users/verify/:id/approve', frontendIntegration: 'BACKEND_ONLY_API', testedMocked: false, testedContract: true, testedLiveBackend: false, testedBrowserE2E: false },
  { id: 'EP-013', route: 'POST /api/v1/reports', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: true },
  { id: 'EP-014', route: 'GET /api/v1/reports', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: true },
  { id: 'EP-015', route: 'GET /api/v1/reports/:id', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: true },
  { id: 'EP-016', route: 'PATCH /api/v1/reports/:id/resolve', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-017', route: 'POST /api/v1/reports/:id/vote', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-018', route: 'POST /api/v1/reports/:id/updates', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-019', route: 'GET /api/v1/reports/:id/updates', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: true },
  { id: 'EP-020', route: 'GET /api/v1/safe-zones', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: true },
  { id: 'EP-021', route: 'POST /api/v1/safe-zones', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-022', route: 'DELETE /api/v1/safe-zones/:id', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-023', route: 'POST /api/v1/routes/safe-path', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-024', route: 'POST /api/v1/alerts/zones', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-025', route: 'GET /api/v1/alerts/zones', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: true },
  { id: 'EP-026', route: 'DELETE /api/v1/alerts/zones/:id', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-027', route: 'POST /api/v1/alerts/subscribe', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-028', route: 'GET /api/v1/media/presigned-url', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-029', route: 'POST /api/v1/media/confirm', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-030', route: 'POST /api/v1/media/mock-upload', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: false, testedBrowserE2E: false },
  { id: 'EP-031', route: 'POST /api/v1/media/webhook', frontendIntegration: 'BACKEND_ONLY_WEBHOOK', testedMocked: false, testedContract: true, testedLiveBackend: false, testedBrowserE2E: false },
  { id: 'EP-032', route: 'GET /api/v1/admin/verifications', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-033', route: 'POST /api/v1/admin/verifications/:id/approve', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-034', route: 'POST /api/v1/admin/verifications/:id/reject', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-035', route: 'POST /api/v1/admin/users/:id/ban', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-036', route: 'POST /api/v1/admin/users/:id/unban', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-037', route: 'POST /api/v1/admin/reports/:id/purge', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-038', route: 'GET /api/v1/admin/logs', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-039', route: 'GET /api/v1/admin/analytics/trends', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: false },
  { id: 'EP-040', route: 'POST /api/v1/admin/news/crawl', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: false, testedBrowserE2E: false },
  { id: 'EP-041', route: 'GET /api/v1/stats', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: true },
  { id: 'EP-042', route: 'GET /api/v1/cron/news-crawl', frontendIntegration: 'BACKEND_ONLY_API', testedMocked: false, testedContract: true, testedLiveBackend: false, testedBrowserE2E: false },
  { id: 'EP-043', route: 'POST /api/v1/cron/news-crawl', frontendIntegration: 'PROXY_OR_CRON', testedMocked: true, testedContract: true, testedLiveBackend: false, testedBrowserE2E: false },
  { id: 'EP-044', route: 'GET /api/health', frontendIntegration: 'PROXY_OR_CRON', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: true },
  { id: 'EP-045', route: 'GET /api/cron/news-crawl', frontendIntegration: 'PROXY_OR_CRON', testedMocked: true, testedContract: true, testedLiveBackend: false, testedBrowserE2E: false },
  { id: 'EP-046', route: 'POST /api/cron/news-crawl', frontendIntegration: 'PROXY_OR_CRON', testedMocked: true, testedContract: true, testedLiveBackend: false, testedBrowserE2E: false },
  { id: 'EP-047', route: 'WS /socket.io', frontendIntegration: 'CONSUMED', testedMocked: true, testedContract: true, testedLiveBackend: true, testedBrowserE2E: true },
];

export const buildCoverageSummary = () => {
  const consumed = ENDPOINT_COVERAGE_MANIFEST.filter((e) => e.frontendIntegration === 'CONSUMED');
  const proxyOrCron = ENDPOINT_COVERAGE_MANIFEST.filter((e) => e.frontendIntegration === 'PROXY_OR_CRON');
  const backendOnly = ENDPOINT_COVERAGE_MANIFEST.filter(
    (e) => e.frontendIntegration === 'BACKEND_ONLY_API' || e.frontendIntegration === 'BACKEND_ONLY_WEBHOOK'
  );

  return {
    totalBackendInterfaces: ALL_BACKEND_ENDPOINT_IDS.length,
    manifestEntries: ENDPOINT_COVERAGE_MANIFEST.length,
    consumedByFrontend: consumed.length,
    nextjsProxyOrCronHandlers: proxyOrCron.length,
    intentionallyBackendOnly: backendOnly.length,
    coverageBreakdown: {
      contractValidated: ENDPOINT_COVERAGE_MANIFEST.filter((e) => e.testedContract).length,
      mockedUnitOrComponentTested: ENDPOINT_COVERAGE_MANIFEST.filter((e) => e.testedMocked).length,
      liveBackendIntegrationTested: ENDPOINT_COVERAGE_MANIFEST.filter((e) => e.testedLiveBackend).length,
      browserE2ETested: ENDPOINT_COVERAGE_MANIFEST.filter((e) => e.testedBrowserE2E).length,
    },
    endpoints: ENDPOINT_COVERAGE_MANIFEST,
  };
};
