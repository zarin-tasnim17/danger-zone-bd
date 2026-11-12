# Frontend API Integration Inventory — DangerZoneBD (`apps/web`)

**Document Status:** Audit Complete (Synchronized with Backend API Baseline & Executed Frontend Test Suite)  
**Frontend Target:** `apps/web` (Next.js 14.2.3 App Router, TypeScript, Zustand 4.5.2, Socket.IO Client 4.7.5)  
**Backend Reference Baseline:** [`API_Endpoint_Inventory.md`](../../../api/docs/testing/API_Endpoint_Inventory.md) (`EP-001`–`EP-047`), [`API_Findings.json`](../../../api/docs/testing/API_Findings.json) (`BACKEND-001`–`BACKEND-014` all `FIXED AND VERIFIED`), [`API_Test_Report.md`](../../../api/docs/testing/API_Test_Report.md)  
**Synchronized Test Reports:** [`Frontend_API_Test_Report.md`](./Frontend_API_Test_Report.md) | [`Frontend_Findings.json`](./Frontend_Findings.json) | [`results.json`](../../tests/reports/results.json) | [`coverage-summary.json`](../../tests/reports/coverage-summary.json)

---

## 1. Summary & Classification Breakdown

Every documented backend and Next.js proxy endpoint (`EP-001` through `EP-047`, **47 total interfaces**) plus **6 discovered frontend external/browser API integrations** (`EXT-001` through `EXT-006`) is inventoried below against the mandatory status taxonomy from `dontADDgit/frontend_api_test.md` Section 29.B:

| Classification Category | Count (of 47 `EP-*`) | Endpoint IDs |
| --- | ---: | --- |
| **CORRECTLY INTEGRATED** | **36** | `EP-002`, `EP-003`, `EP-006`, `EP-007`, `EP-008`, `EP-009`, `EP-010`, `EP-011`, `EP-013`, `EP-014`, `EP-015`, `EP-016`, `EP-017`, `EP-018`, `EP-019`, `EP-020`, `EP-021`, `EP-022`, `EP-023`, `EP-024`, `EP-025`, `EP-026`, `EP-027`, `EP-028`, `EP-029`, `EP-032`, `EP-033`, `EP-034`, `EP-035`, `EP-036`, `EP-037`, `EP-038`, `EP-039`, `EP-041`, `EP-044`, `EP-047` |
| **PARTIALLY INTEGRATED** | **5** | `EP-030`, `EP-040`, `EP-043`, `EP-045`, `EP-046` *(mocked/contract verified cleanly; live mock-storage branch & external RSS news crawl excluded from offline CI)* |
| **INCORRECTLY INTEGRATED** | **0** | None *(all 11 confirmed defects `FRONTEND-001`–`FRONTEND-011` and `/health` probe URL normalization fixed & verified)* |
| **MISSING INTEGRATION** | **0** | None (`apps/web` covers every consumer & admin endpoint intended for UI usage) |
| **INTENTIONALLY UNUSED** | **0** | Covered explicitly under `BACKEND ONLY` per backend architectural boundary |
| **BACKEND ONLY** | **6** | `EP-001`, `EP-004`, `EP-005`, `EP-012`, `EP-031`, `EP-042` |
| **BLOCKED / UNVERIFIED** | **0** | Contract parity (`47/47`) verified; see individual entries where live network calls are gated (`EP-030`, `EP-040`, `EP-043`) |

> **Execution Layer Parity Note (from `coverage-summary.json`):**  
> Consumed by Frontend UI/Client (`37`) + Next.js Proxy/Cron (`4`) + Intentionally Backend-Only (`6`) = **47 Backend Interfaces**.  
> Coverage across layers: **47/47** Contract Schema Validated, **41/47** Mocked Unit/Component Tested, **38/47** Live Express + PostgreSQL/PostGIS + Socket.IO Tested, **13/47** Real Headless Chromium Browser E2E Tested.

---

## 2. Backend-to-Frontend Traceability Matrix (`EP-001` – `EP-047`)

| ID | Backend Endpoint | Method | Frontend Service / Call Site | Page / Component | Req Verified | Res Verified | Tests Executed | Integration Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `EP-001` | `/` | `GET` | None (Backend metadata root) | N/A (`BACKEND ONLY`) | Contract | Contract | `contracts/01`, `workflows/01` | **BACKEND ONLY** |
| `EP-002` | `/health` | `GET` | `fetch(${targetUrl}/health)` (`app/health/page.tsx`), Next `/api/health` (`app/api/health/route.ts:21`), `apiFetch("/health")` (`app/dev-test/page.tsx:375`, `RouteTestNav.tsx:51`) | `/health`, `/dev-test`, `RouteTestNav`, `/api/health` | Mocked+Live | Mocked+Live | `api/03`, `contracts/01`, `workflows/01`, `e2e/01` | **CORRECTLY INTEGRATED** (`health/page.tsx` strips trailing slashes & `/api/v1` consistently with `/api/health`) |
| `EP-003` | `/health/db` | `GET` | `fetch(${targetUrl}/health/db)` (`app/health/page.tsx`), Next `/api/health` (`app/api/health/route.ts:34`) | `/health`, `/api/health` | Mocked+Live | Mocked+Live | `api/03`, `contracts/01`, `workflows/01`, `e2e/01` | **CORRECTLY INTEGRATED** (`health/page.tsx` normalizes base URL by stripping trailing slashes & `/api/v1`) |
| `EP-004` | `/api/v1/health` | `GET` | `apiFetch("/health")` (`app/dev-test/page.tsx:375`, `RouteTestNav.tsx:51`) resolves here via `/api/v1` prefix | `/dev-test`, `RouteTestNav` | Contract+Live | Contract+Live | `contracts/01`, `workflows/01` | **BACKEND ONLY** (API alias of `EP-002`) |
| `EP-005` | `/api/v1/health/db` | `GET` | `next.config.mjs:19-21` rewrite `/health/db` -> `${targetUrl}/api/v1/health/db` | Vercel/Next rewrite proxy | Contract+Live | Contract+Live | `contracts/01`, `workflows/01` | **BACKEND ONLY** (API alias of `EP-003`) |
| `EP-006` | `/api/v1/auth/device` | `POST` | `useAuthStore.initAuth()` / `resetAnonymousIdentity()` (`store/useAuthStore.ts`), `handleSwitchIdentity()` (`app/profile/page.tsx`) | `/`, `/feed`, `/report`, `/safe-zones`, `/alerts`, `/profile`, `/routes`, `/reports/[id]` | Mocked+Live+E2E | Mocked+Live+E2E | `api/02`, `auth/01`, `contracts/01`, `workflows/01`, `e2e/01`, `regression/01` | **CORRECTLY INTEGRATED** (`FRONTEND-004`, `FRONTEND-011` fixed: checks `/users/me` first & single-flight mutex deduplicates calls) |
| `EP-007` | `/api/v1/auth/login` | `POST` | `useAuthStore.loginAdminWithPassword()` (`store/useAuthStore.ts`) | `/admin` (Admin gate form) | Mocked+Live | Mocked+Live | `api/01`, `api/02`, `auth/01`, `contracts/01`, `workflows/01`, `regression/01` | **CORRECTLY INTEGRATED** (`FRONTEND-002`, `FRONTEND-003` fixed: skips silent refresh on 401 & revokes non-ADMIN cookies via `/auth/logout`) |
| `EP-008` | `/api/v1/auth/refresh` | `POST` | `apiFetch()` single-flight silent refresh (`lib/api.ts`), `app/dev-test/page.tsx` (`auth-refresh` test) | Global `apiFetch` interceptor, `/dev-test` | Mocked | Mocked | `api/01`, `contracts/01`, `regression/01` | **CORRECTLY INTEGRATED** (`FRONTEND-001`, `FRONTEND-002` fixed: module-scoped mutex & excluded `/auth/login` & `/auth/logout`) |
| `EP-009` | `/api/v1/auth/logout` | `POST` | `useAuthStore.logout()` & non-ADMIN cleanup (`store/useAuthStore.ts`) | `/profile` (`handleResetDevice`), `/admin` sign-out & non-admin guard | Mocked+Live | Mocked+Live | `auth/01`, `contracts/01`, `workflows/01`, `regression/01` | **CORRECTLY INTEGRATED** (`FRONTEND-003`, `FRONTEND-004` fixed: revokes non-ADMIN cookies & avoids minting DB row on logout) |
| `EP-010` | `/api/v1/users/me` | `GET` | `useAuthStore.initAuth()` (`store/useAuthStore.ts`), `loginAdminWithPassword`, `refreshProfile()` | All authenticated pages, `Navbar`, `/profile`, `/admin` | Mocked+Live+E2E | Mocked+Live+E2E | `api/01`, `api/02`, `auth/01`, `contracts/01`, `workflows/01`, `e2e/01` | **CORRECTLY INTEGRATED** (`FRONTEND-001`, `FRONTEND-004`, `FRONTEND-011` fixed: checked first on bootstrap & protected by refresh mutex) |
| `EP-011` | `/api/v1/users/verify` | `POST` | `apiFetch("/users/verify")` (`app/profile/page.tsx:110`) | `/profile` (`handleSubmitVerification`) | Mocked+Live | Mocked+Live | `forms/01`, `contracts/01`, `workflows/01` | **CORRECTLY INTEGRATED** |
| `EP-012` | `/api/v1/users/verify/:id/approve` | `POST` | None (Frontend uses `EP-033` `/admin/verifications/:id/approve`) | N/A | Contract | Contract | `contracts/01` | **BACKEND ONLY** (legacy/admin alias) |
| `EP-013` | `/api/v1/reports` | `POST` | `apiFetch("/reports")` (`app/report/page.tsx`, `ReportIncidentModal.tsx`, `dev-test/page.tsx`) | `/report`, `ReportIncidentModal`, `/dev-test` | Mocked+Live+E2E | Mocked+Live+E2E | `forms/01`, `contracts/01`, `workflows/01`, `e2e/01`, `regression/01` | **CORRECTLY INTEGRATED** (`FRONTEND-007`, `FRONTEND-010` fixed: trimmed inputs, `<=1000` modal & `500`-char prompt caps, safe coords) |
| `EP-014` | `/api/v1/reports` | `GET` | `useIncidentStore.fetchIncidents()` / `fetchInitialMapData()` (`store/useIncidentStore.ts:90,129`), `apiFetch("/reports?...")` (`app/feed/page.tsx:193`, `app/admin/page.tsx:126`) | `/`, `/feed`, `/admin` | Mocked+Live+E2E | Mocked+Live+E2E | `api/02`, `contracts/01`, `workflows/01`, `e2e/01` | **CORRECTLY INTEGRATED** |
| `EP-015` | `/api/v1/reports/:id` | `GET` | `apiFetch("/reports/${reportId}")` (`app/reports/[id]/page.tsx:168,311`) | `/reports/[id]` | Mocked+Live+E2E | Mocked+Live+E2E | `contracts/01`, `workflows/01`, `e2e/01` | **CORRECTLY INTEGRATED** |
| `EP-016` | `/api/v1/reports/:id/resolve` | `PATCH` | `apiFetch("/reports/${reportId}/resolve")` (`app/reports/[id]/page.tsx:413`, `app/dev-test/page.tsx:293`) | `/reports/[id]`, `/dev-test` | Mocked+Live | Mocked+Live | `authz/01`, `contracts/01`, `workflows/01` | **CORRECTLY INTEGRATED** |
| `EP-017` | `/api/v1/reports/:id/vote` | `POST` | `useIncidentStore.voteIncident()` (`store/useIncidentStore.ts:199`), `app/feed/page.tsx:325`, `app/reports/[id]/page.tsx:356` | `/`, `/feed`, `/reports/[id]` | Mocked+Live | Mocked+Live | `api/02`, `contracts/01`, `workflows/01` | **CORRECTLY INTEGRATED** |
| `EP-018` | `/api/v1/reports/:id/updates` | `POST` | `useIncidentStore.postIncidentUpdate()` (`store/useIncidentStore.ts:249`), `app/feed/page.tsx:389`, `app/reports/[id]/page.tsx:393` | `/feed`, `/reports/[id]` | Mocked+Live | Mocked+Live | `contracts/01`, `workflows/01` | **CORRECTLY INTEGRATED** |
| `EP-019` | `/api/v1/reports/:id/updates` | `GET` | `apiFetch("/reports/${reportId}/updates")` (`app/feed/page.tsx:373`, `app/reports/[id]/page.tsx:169`) | `/feed`, `/reports/[id]` | Mocked+Live+E2E | Mocked+Live+E2E | `contracts/01`, `workflows/01`, `e2e/01` | **CORRECTLY INTEGRATED** |
| `EP-020` | `/api/v1/safe-zones` | `GET` | `useIncidentStore.fetchSafeZones()` (`store/useIncidentStore.ts:154`), `apiFetch(query)` (`app/safe-zones/page.tsx`) | `/`, `/safe-zones` | Mocked+Live+E2E | Mocked+Live+E2E | `api/02`, `contracts/01`, `workflows/01`, `e2e/01`, `regression/01` | **CORRECTLY INTEGRATED** (`FRONTEND-008` fixed: removed `selectedZone` from `useCallback` deps, eliminating redundant fetches) |
| `EP-021` | `/api/v1/safe-zones` | `POST` | `apiFetch("/safe-zones")` (`app/safe-zones/page.tsx`) | `/safe-zones` (Admin modal) | Mocked+Live | Mocked+Live | `authz/01`, `forms/01`, `contracts/01`, `workflows/01`, `regression/01` | **CORRECTLY INTEGRATED** (`FRONTEND-008` fixed: `name.trim().length >= 2`, `Number.isFinite` & Bangladesh coordinate bounds validated before POST) |
| `EP-022` | `/api/v1/safe-zones/:id` | `DELETE` | `apiFetch("/safe-zones/${id}")` (`app/safe-zones/page.tsx:271`) | `/safe-zones` (Admin control) | Mocked+Live | Mocked+Live | `authz/01`, `contracts/01`, `workflows/01` | **CORRECTLY INTEGRATED** |
| `EP-023` | `/api/v1/routes/safe-path` | `POST` | `apiFetch("/routes/safe-path")` (`app/routes/page.tsx:161`) | `/routes` | Mocked+Live | Mocked+Live | `forms/01`, `contracts/01`, `workflows/01` | **CORRECTLY INTEGRATED** |
| `EP-024` | `/api/v1/alerts/zones` | `POST` | `apiFetch("/alerts/zones")` (`app/alerts/page.tsx:405`) | `/alerts` | Mocked+Live | Mocked+Live | `forms/01`, `contracts/01`, `workflows/01` | **CORRECTLY INTEGRATED** |
| `EP-025` | `/api/v1/alerts/zones` | `GET` | `apiFetch("/alerts/zones")` (`app/alerts/page.tsx:197`) | `/alerts` | Mocked+Live+E2E | Mocked+Live+E2E | `contracts/01`, `workflows/01`, `e2e/01` | **CORRECTLY INTEGRATED** |
| `EP-026` | `/api/v1/alerts/zones/:id` | `DELETE` | `apiFetch("/alerts/zones/${id}")` (`app/alerts/page.tsx:436`) | `/alerts` | Mocked+Live | Mocked+Live | `contracts/01`, `workflows/01` | **CORRECTLY INTEGRATED** |
| `EP-027` | `/api/v1/alerts/subscribe` | `POST` | `apiFetch("/alerts/subscribe")` (`app/alerts/page.tsx:537`) | `/alerts` (`handleSubscribePush`) | Mocked+Live | Mocked+Live | `contracts/01`, `forms/01`, `workflows/01`, `regression/01` | **CORRECTLY INTEGRATED** (`FRONTEND-006` fixed: real VAPID `PushManager.subscribe` + honest error toast; fake fallback removed) |
| `EP-028` | `/api/v1/media/presigned-url` | `GET` | `uploadReportEvidence()` (`lib/mediaUpload.ts:152`) | `/report` (`handleSubmit` / `handleRetryMediaUpload`) | Mocked+Live | Mocked+Live | `contracts/01`, `workflows/01` | **CORRECTLY INTEGRATED** |
| `EP-029` | `/api/v1/media/confirm` | `POST` | `uploadReportEvidence()` (`lib/mediaUpload.ts:179`) | `/report` | Mocked+Live | Mocked+Live | `contracts/01`, `workflows/01` | **CORRECTLY INTEGRATED** |
| `EP-030` | `/api/v1/media/mock-upload` | `POST` | `uploadReportEvidence()` (`lib/mediaUpload.ts:158` when `presigned.isMock`) | `/report` (local mock storage fallback) | Mocked+Contract | Contract | `contracts/01` | **PARTIALLY INTEGRATED** (Verified mocked/contract; live test runs against S3/Supabase branch) |
| `EP-031` | `/api/v1/media/webhook` | `POST` | None (Backend S2S storage webhook) | N/A | Contract | Contract | `contracts/01` | **BACKEND ONLY** |
| `EP-032` | `/api/v1/admin/verifications` | `GET` | `apiFetch("/admin/verifications")` (`app/admin/page.tsx`) | `/admin` | Mocked+Live | Mocked+Live | `authz/01`, `contracts/01`, `workflows/01`, `regression/01` | **CORRECTLY INTEGRATED** (`FRONTEND-009` fixed: surfaces fetch errors via toast & visible error banner) |
| `EP-033` | `/api/v1/admin/verifications/:id/approve` | `POST` | `apiFetch("/admin/verifications/${verifId}/approve")` (`app/admin/page.tsx`) | `/admin` | Mocked+Live | Mocked+Live | `authz/01`, `contracts/01`, `workflows/01` | **CORRECTLY INTEGRATED** |
| `EP-034` | `/api/v1/admin/verifications/:id/reject` | `POST` | `apiFetch("/admin/verifications/${rejectTarget.id}/reject")` (`app/admin/page.tsx`) | `/admin` | Mocked+Live | Mocked+Live | `forms/01`, `authz/01`, `contracts/01`, `regression/01` | **CORRECTLY INTEGRATED** (`FRONTEND-009` fixed: enforces `rejectReason.trim().length >= 3`) |
| `EP-035` | `/api/v1/admin/users/:id/ban` | `POST` | `apiFetch("/admin/users/${banUserId.trim()}/${action}")` (`app/admin/page.tsx`) | `/admin` | Mocked+Live | Mocked+Live | `forms/01`, `contracts/01`, `workflows/01`, `regression/01` | **CORRECTLY INTEGRATED** (`FRONTEND-009` fixed: validates UUID format & `banReason.trim().length >= 3`) |
| `EP-036` | `/api/v1/admin/users/:id/unban` | `POST` | `apiFetch("/admin/users/${banUserId.trim()}/${action}")` (`app/admin/page.tsx`) | `/admin` | Mocked+Live | Mocked+Live | `forms/01`, `contracts/01`, `workflows/01`, `regression/01` | **CORRECTLY INTEGRATED** (`FRONTEND-009` fixed: validates UUID format & `banReason.trim().length >= 3`) |
| `EP-037` | `/api/v1/admin/reports/:id/purge` | `POST` | `apiFetch("/admin/reports/${purgeTarget.id}/purge")` (`app/admin/page.tsx`, `app/reports/[id]/page.tsx:448`) | `/admin`, `/reports/[id]` | Mocked+Live | Mocked+Live | `forms/01`, `authz/01`, `contracts/01`, `workflows/01`, `regression/01` | **CORRECTLY INTEGRATED** (`FRONTEND-009` fixed: enforces `purgeReason.trim().length >= 3`) |
| `EP-038` | `/api/v1/admin/logs` | `GET` | `apiFetch("/admin/logs?page=1&limit=30")` (`app/admin/page.tsx`) | `/admin` | Mocked+Live | Mocked+Live | `contracts/01`, `workflows/01`, `regression/01` | **CORRECTLY INTEGRATED** (`FRONTEND-009` fixed: surfaces fetch errors via toast & visible error banner) |
| `EP-039` | `/api/v1/admin/analytics/trends` | `GET` | `apiFetch("/admin/analytics/trends")` (`app/admin/page.tsx`) | `/admin` | Mocked+Live | Mocked+Live | `contracts/01`, `workflows/01`, `regression/01` | **CORRECTLY INTEGRATED** (`FRONTEND-009` fixed: surfaces fetch errors via toast & visible error banner) |
| `EP-040` | `/api/v1/admin/news/crawl` | `POST` | `apiFetch("/admin/news/crawl", { method: "POST" })` (`app/admin/page.tsx:313`) | `/admin` (`handleTriggerNewsCrawl`) | Mocked+Contract | Mocked+Contract | `contracts/01` | **PARTIALLY INTEGRATED** (Live RSS crawl excluded from deterministic offline tests) |
| `EP-041` | `/api/v1/stats` | `GET` | `useStatsStore.fetchStats()` (`store/useStatsStore.ts:35`) | `/`, `/feed` | Mocked+Live+E2E | Mocked+Live+E2E | `api/02`, `contracts/01`, `workflows/01`, `e2e/01` | **CORRECTLY INTEGRATED** |
| `EP-042` | `/api/v1/cron/news-crawl` | `GET` | None (Backend crawler health probe) | N/A | Contract | Contract | `contracts/01` | **BACKEND ONLY** |
| `EP-043` | `/api/v1/cron/news-crawl` | `POST` | `fetch("${targetUrl}/api/v1/cron/news-crawl")` (`app/api/cron/news-crawl/route.ts:64`) | Vercel Cron Next.js Proxy (`EP-045`/`EP-046`) | Mocked+Contract | Mocked+Contract | `api/03`, `contracts/01` | **PARTIALLY INTEGRATED** (Proxy mocked cleanly; live RSS trigger avoided) |
| `EP-044` | `/api/health` | `GET` | `app/api/health/route.ts:1-79` -> consumed by `app/health/page.tsx:130` & `browserHelper.ts` | `/health` edge card | Mocked+Live+E2E | Mocked+Live+E2E | `api/03`, `workflows/01`, `e2e/01` | **CORRECTLY INTEGRATED** |
| `EP-045` | `/api/cron/news-crawl` | `GET` | `app/api/cron/news-crawl/route.ts:17` (`GET`) | Vercel Cron Scheduler (`vercel.json:6-11`) | Mocked+Contract | Mocked+Contract | `api/03`, `contracts/01` | **PARTIALLY INTEGRATED** (Auth & forwarding verified via handler unit test) |
| `EP-046` | `/api/cron/news-crawl` | `POST` | `app/api/cron/news-crawl/route.ts:99` (`export const POST = GET`) | Manual/webhook cron trigger | Mocked+Contract | Mocked+Contract | `api/03`, `contracts/01` | **PARTIALLY INTEGRATED** (Auth & forwarding verified via handler unit test) |
| `EP-047` | `WS /socket.io` | `WS` | `lib/socket.ts:getSocket()` + `useIncidentStore` + `useStatsStore` + `feed`, `reports/[id]`, `alerts` | Global real-time feeds & geofence alerts | Mocked+Live+E2E | Mocked+Live+E2E | `workflows/01`, `e2e/01`, `regression/01` | **CORRECTLY INTEGRATED** (`FRONTEND-005` fixed: `/alerts` binds `getSocket()` after `await initAuth()` + token reconnect/logout fix in `lib/socket.ts`) |

---

## 3. Detailed 20-Attribute Catalog (`EP-001` – `EP-047`)

> Standard transport baseline unless overridden per row:  
> - **Base URL resolution (`lib/api.ts:7-32`)**: Browser defaults to relative `/api/v1` (proxied in production via `next.config.mjs:15-17` or overridden via `NEXT_PUBLIC_API_URL`); SSR resolves `${INTERNAL_API_URL || NEXT_PUBLIC_API_URL || 'https://danger-zone-bd.onrender.com'}/api/v1`.  
> - **Headers & Auth (`lib/api.ts:62-77`)**: `credentials: "include"` sends `access_token` & `refresh_token` `HttpOnly` cookies; `Content-Type: "application/json"` added automatically when body is not `FormData`.  
> - **Standard Response Unwrapping (`lib/api.ts:112-122`)**: Backend `{ success: true, data }` is unwrapped to `data` directly; non-2xx extracts `data.error?.message || data.message || data.error`.

### Group A: Infrastructure, Health & Proxy Routes (`EP-001` – `EP-005`, `EP-042` – `EP-046`)

- **`EP-001` — `GET /`**
  - 1. ID: `EP-001` | 2. Endpoint & Method: `GET /` | 3. Purpose: Backend root status & service banner.
  - 4. Expected Frontend Consumption: No | 5. API File & Fn: None | 6. Hooks: None | 7. Pages/Components: None.
  - 8. Headers/Auth: Public | 9. Params: None | 10. Request Payload: None.
  - 11. Expected Backend Response: `200 { success: true, data: { message, status, environment, timestamp } }` (`BACKEND-009` envelope alignment).
  - 12. Frontend Parsing: N/A | 13. State: N/A | 14. UI States: N/A | 15. AuthZ: Public | 16. Trigger: Render/uptime probe.
  - 17. Tests: `contracts/01-backend-contract-alignment.test.ts` (`healthEnvelopeSchema`). | 18. Status: **BACKEND ONLY**.
  - 19. Identified Issues: None | 20. Evidence: Live verified by backend suite (`API_Test_Report.md`); manifest verified in `contracts/01`.

- **`EP-002` — `GET /health`**
  - 1. ID: `EP-002` | 2. Endpoint & Method: `GET /health` | 3. Purpose: Backend liveness probe & Render cold-start check.
  - 4. Expected Frontend Consumption: Yes | 5. API File & Fn: `app/health/page.tsx:101` (`fetch`), `app/api/health/route.ts:21` (`fetch`).
  - 6. Hooks: `runDiagnostics` (`useCallback`, `app/health/page.tsx:81`). | 7. Pages/Components: `/health`, `/api/health`.
  - 8. Headers/Auth: Public (`cache: "no-store"`). | 9. Params: None | 10. Request Payload: None.
  - 11. Expected Backend Response: `200 { success: true, data: { status: "OK", message, uptime, timestamp } }`.
  - 12. Frontend Parsing: `resB.ok` -> `resB.json()` stored in `backendProbe.data`. | 13. State: Local `useState` in `app/health/page.tsx`.
  - 14. UI States: Polling loop (`12` attempts x `4s` in `health/page.tsx:92-126`), success badge, offline warning fallback.
  - 15. AuthZ: Public | 16. Trigger: `/health` page mount / manual re-probe button.
  - 17. Tests: `api/03-next-route-handlers.test.ts`, `workflows/01-live-backend-integration.test.ts`, `e2e/01-browser-playwright-e2e.test.ts`.
  - 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Identified Issues: None (`app/health/page.tsx` now normalizes `NEXT_PUBLIC_API_URL` by stripping trailing slashes and `/api/v1` consistently with `app/api/health/route.ts`).
  - 20. Evidence: Executed live (`GET /health 200` in `e2e/01` and `workflows/01`).

- **`EP-003` — `GET /health/db`**
  - 1. ID: `EP-003` | 2. Endpoint & Method: `GET /health/db` | 3. Purpose: PostgreSQL + PostGIS connectivity check.
  - 4. Expected Frontend Consumption: Yes | 5. API File & Fn: `app/health/page.tsx:114`, `app/api/health/route.ts:34`.
  - 6. Hooks: `runDiagnostics` | 7. Pages/Components: `/health`, `/api/health`, `e2e/01` readiness probe.
  - 8. Headers/Auth: Public (`cache: "no-store"`). | 9. Params: None | 10. Request Payload: None.
  - 11. Expected Backend Response: `200 { success: true, data: { status: "OK" | "CONNECTED", database: "connected", postgis: "enabled", timestamp } }` (or `503` on failure).
  - 12. Frontend Parsing: `resD.ok` -> latency + `dbProbe.data` (`health/page.tsx:115-119`), `503` degraded status in `/api/health` (`route.ts:62`).
  - 13. State: Local component state. | 14. UI States: 12-iteration cold-start polling + edge fallback via `/api/health`.
  - 15. AuthZ: Public | 16. Trigger: `/health` mount & `GET /api/health`.
  - 17. Tests: `api/03`, `workflows/01`, `e2e/01`. | 18. Status: **CORRECTLY INTEGRATED** (`app/health/page.tsx` normalizes `NEXT_PUBLIC_API_URL` by stripping trailing slashes & `/api/v1`).
  - 19. Identified Issues: None.
  - 20. Evidence: Executed live (`GET /health/db 200` in `workflows/01` and `e2e/01`).

- **`EP-004` & `EP-005` — `GET /api/v1/health` & `GET /api/v1/health/db`**
  - 1. IDs: `EP-004`, `EP-005` | 2. Method: `GET` | 3. Purpose: Versioned aliases for `/health` and `/health/db` (also hit indirectly by `apiFetch("/health")` in `/dev-test`, `RouteTestNav`, and `next.config.mjs:19-21` `/health/db` rewrite).
  - 4. Expected Frontend Consumption: Indirect / Backend Alias | 5-7: See `EP-002`/`EP-003` + `app/dev-test/page.tsx:375,383`, `components/layout/RouteTestNav.tsx:51`, `next.config.mjs:19-21`.
  - 8-16: Same public no-store health contract as `EP-002`/`EP-003`.
  - 17. Tests: `contracts/01`, `workflows/01`, `e2e/01` (Express logs show `GET /api/v1/health 200`, `GET /api/v1/health/db 200` on `/health` route). | 18. Status: **BACKEND ONLY** (secondary API aliases).
  - 19. Issues: None | 20. Evidence: Observed HTTP 200 in Chromium E2E logs (`e2e/01`).

- **`EP-042` — `GET /api/v1/cron/news-crawl`**
  - 1. ID: `EP-042` | 2. Endpoint & Method: `GET /api/v1/cron/news-crawl` | 3. Purpose: Backend crawler endpoint status check.
  - 4. Expected Frontend Consumption: No | 5-7: None (`POST` is used by proxy `EP-043`).
  - 8. Auth: `Bearer CRON_SECRET` / `x-cron-secret`. | 9-16: N/A in UI.
  - 17. Tests: `contracts/01` (`coverageRegistry`). | 18. Status: **BACKEND ONLY**.
  - 19. Issues: None | 20. Evidence: Inspected backend routes; not called in `apps/web`.

- **`EP-043` — `POST /api/v1/cron/news-crawl`**
  - 1. ID: `EP-043` | 2. Endpoint & Method: `POST /api/v1/cron/news-crawl` | 3. Purpose: Backend target triggered by Next.js `/api/cron/news-crawl`.
  - 4. Expected Frontend Consumption: Yes (SSR Route Handler proxy) | 5. File: `apps/web/app/api/cron/news-crawl/route.ts:64`.
  - 6-7: Next.js Route Handler only | 8. Headers/Auth: `Authorization: Bearer ${CRON_SECRET}`, `Content-Type: application/json`, `cache: 'no-store'`.
  - 9. Params: None | 10. Request Payload: None | 11. Expected Response: `200 { success, data }`.
  - 12. Parsing: Wraps upstream status/JSON into `{ success: res.ok, triggeredAt, backendStatus, result: data }`.
  - 13-16: Server-to-server Vercel Cron relay | 17. Tests: `api/03-next-route-handlers.test.ts`, `contracts/01`.
  - 18. Status: **PARTIALLY INTEGRATED** (Handler tested against local mock HTTP server; live RSS scrape skipped to avoid polluting DB/external feeds).
  - 19. Issues: None (`timingSafeStringCompare` via SHA-256 properly fails closed with `401`). | 20. Evidence: Mocked Route Handler tests PASS (`3/3` in `api/03`).

- **`EP-044` — `GET /api/health`**
  - 1. ID: `EP-044` | 2. Endpoint & Method: `GET /api/health` | 3. Purpose: Next.js App Router edge health proxy probing backend `/health` and `/health/db`.
  - 4. Expected Frontend Consumption: Yes | 5. File: `apps/web/app/api/health/route.ts:1-79` (`GET`).
  - 6. Hooks: `runDiagnostics` (`app/health/page.tsx:130`). | 7. Consuming Pages: `/health`, `browserHelper.ts` server readiness polling.
  - 8. Headers: `cache: 'no-store'`, `NO_STORE_HEADERS` on response. | 9-10: None.
  - 11. Expected Response: `200` when both backend & DB ok, `503 { status: "degraded" }` when DB probe fails/unreachable.
  - 12. Parsing: Reads `json.services.backend` & `json.services.database` (`health/page.tsx:132-145`). | 13-14: Error card & retry button on `/health`.
  - 15. AuthZ: Public | 16. Trigger: Page mount / healthcheck. | 17. Tests: `api/03`, `contracts/01`, `workflows/01`, `e2e/01`.
  - 18. Status: **CORRECTLY INTEGRATED** | 19. Issues: None | 20. Evidence: `workflows/01` live proxy `200`, `api/03` mocked `200` + `503`, `e2e/01` Chromium `GET /api/health -> 200`.

- **`EP-045` & `EP-046` — `GET /api/cron/news-crawl` & `POST /api/cron/news-crawl`**
  - 1. IDs: `EP-045`, `EP-046` | 2. Method: `GET`, `POST` (`export const POST = GET`, `route.ts:99`) | 3. Purpose: Vercel cron ingress route (`vercel.json:6-11` schedule `0 0 * * *`).
  - 4. Expected Consumption: Yes (Vercel Cron -> Next.js -> Render backend) | 5. File: `apps/web/app/api/cron/news-crawl/route.ts:17-99`.
  - 6-7: Next.js route handler only | 8. Auth: Timing-safe comparison of `CRON_SECRET` against `Authorization: Bearer ...` or `x-cron-secret`.
  - 9-10: Empty body | 11-12: `401` if secret missing/wrong, else `backendStatus` JSON relay.
  - 13-16: Cron invocation | 17. Tests: `api/03-next-route-handlers.test.ts`.
  - 18. Status: **PARTIALLY INTEGRATED** (mocked backend upstream verification passed; live news crawl excluded). | 19. Issues: None | 20. Evidence: `api/03` PASS.

---

### Group B: Authentication & User Profile / KYC (`EP-006` – `EP-012`)

- **`EP-006` — `POST /api/v1/auth/device`**
  - 1. ID: `EP-006` | 2. Method & URL: `POST /api/v1/auth/device` | 3. Purpose: Register/sign-in anonymous device session using persistent client `anonymousId`, minting `HttpOnly` JWT cookies & `socketToken`.
  - 4. Expected Consumption: Yes | 5. Service: `lib/api.ts:apiFetch` via `store/useAuthStore.ts:initAuth` (`:62`) & `app/profile/page.tsx:138`.
  - 6. Hooks: `useAuthStore` (`initAuth`), mounted in `useEffect` across `/`, `/feed`, `/report`, `/reports/[id]`, `/routes`, `/safe-zones`, `/alerts`, `/profile`.
  - 7. Consuming Pages: All client routes + `/profile` identity switcher. | 8. Headers/Auth: Public endpoint, `credentials: "include"`, `Content-Type: application/json`.
  - 9. Params: None | 10. Payload: `{ anonymousId: string }` (from `localStorage["bd_safety_device_id"]` or newly generated `crypto.randomUUID()`).
  - 11. Expected Response: `201 Created` on new user / `200 OK` on existing user with `{ success: true, data: { user, socketToken } }`.
  - 12. Parsing: Saves `socketToken` to memory (`sessionStorage` fallback omitted/in-memory `currentSocketToken` in `useAuthStore.ts:69` -> `setSocketToken`), then immediately fetches `GET /users/me`.
  - 13. State: Zustand `useAuthStore` (`user`, `deviceId`, `isLoading`, `error`) + `localStorage.bd_safety_device_id`.
  - 14. UI States: `isLoading` spinner / profile hydration; catches errors into `useAuthStore.error` (`profile/page.tsx:150` shows toast).
  - 15. AuthZ: Public | 16. Trigger: App page mount & `/profile` dev identity switcher.
  - 17. Tests: `api/02`, `auth/01`, `contracts/01`, `workflows/01`, `e2e/01`, `regression/01`.
  - 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Identified Issues: None (`FRONTEND-004` & `FRONTEND-011` fixed & verified: `initAuth()` checks `/users/me` first to preserve active Admin/Responder sessions, uses a module-scoped single-flight Promise lock to eliminate StrictMode duplicates, and `resetAnonymousIdentity()` serves `/profile` explicit identity resets).
  - 20. Evidence: Live Chromium E2E shows single `GET /users/me` per navigation and `[FRONTEND-004]` / `[FRONTEND-011]` PASS.

- **`EP-007` — `POST /api/v1/auth/login`**
  - 1. ID: `EP-007` | 2. Method & URL: `POST /api/v1/auth/login` | 3. Purpose: Email/password authentication for Admin & seeded accounts.
  - 4. Expected Consumption: Yes | 5. Service: `useAuthStore.loginAdminWithPassword` (`store/useAuthStore.ts`).
  - 6. Hooks: `useAuthStore` | 7. Pages: `/admin` (Admin gate login form).
  - 8. Headers/Auth: Public (`credentials: "include"` sets `access_token` + `refresh_token` cookies). | 9. Params: None.
  - 10. Payload: `{ email: string, password: string }`.
  - 11. Expected Response: `200 { success: true, data: { user, socketToken } }` or `401 Invalid credentials`.
  - 12. Parsing: Calls `setSocketToken`, then `apiFetch<AuthUser>("/users/me")`, then checks `profile.role !== "ADMIN"`.
  - 13. State: `useAuthStore` (`user`, `isLoading`, `error`). | 14. UI States: Login error banner on `/admin`.
  - 15. AuthZ: Public login, UI gates access on `role === "ADMIN"`. | 16. Trigger: `/admin` password form submit.
  - 17. Tests: `api/01`, `api/02`, `auth/01`, `contracts/01`, `workflows/01`, `regression/01`.
  - 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Identified Issues: None (`FRONTEND-002` & `FRONTEND-003` fixed & verified: `shouldAttemptSilentRefresh` excludes `/auth/login` & `/auth/logout` on 401, and `loginAdminWithPassword` revokes cookies via `POST /auth/logout` when rejecting non-`ADMIN` accounts).
  - 20. Evidence: `api/01`, `api/02`, `workflows/01`, `regression/01` (`[FRONTEND-002]`, `[FRONTEND-003]`) PASS.

- **`EP-008` — `POST /api/v1/auth/refresh`**
  - 1. ID: `EP-008` | 2. Method & URL: `POST /api/v1/auth/refresh` | 3. Purpose: Single-use rotating refresh token flow returning fresh `HttpOnly` access/refresh cookies + `socketToken`.
  - 4. Expected Consumption: Yes | 5. Service: `lib/api.ts:refreshSessionSingleFlight` (single-flight `fetch`), plus `app/dev-test/page.tsx` (`auth-refresh` test card).
  - 6. Hooks: Transparent inside `apiFetch`. | 7. Pages: All authenticated routes; `/dev-test`.
  - 8. Headers/Auth: `credentials: "include"` (sends `refresh_token` cookie). | 9-10: Empty JSON body.
  - 11. Expected Response: `200 { success: true, data: { socketToken } }`.
  - 12. Parsing: Extracts `refreshData?.data?.socketToken`, calls `setSocketToken()`, retries original `apiFetch` once with `{ skipAuthRefresh: true }`.
  - 13. State: Updates in-memory `currentSocketToken`. | 14. Error handling: Re-throws / surfaces 401 if refresh fails; guarded by `15000ms` timeout.
  - 15. AuthZ: Requires valid `refresh_token` cookie. | 16. Trigger: Automatic on HTTP `401` or manual trigger in `/dev-test`.
  - 17. Tests: `api/01`, `contracts/01`, `regression/01`.
  - 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Identified Issues: None (`FRONTEND-001` & `FRONTEND-002` fixed & verified: module-scoped single-flight Promise mutex coalesces concurrent 401 refreshes, and `/auth/login` + `/auth/logout` skip silent refresh).
  - 20. Evidence: Mocked unit & regression suite (`api/01`, `regression/01 [FRONTEND-001]/[FRONTEND-002]`) PASS.

- **`EP-009` — `POST /api/v1/auth/logout`**
  - 1. ID: `EP-009` | 2. Method & URL: `POST /api/v1/auth/logout` | 3. Purpose: Revoke server refresh token row and clear `HttpOnly` cookies.
  - 4. Expected Consumption: Yes | 5. Service: `useAuthStore.logout()` & non-ADMIN cleanup (`store/useAuthStore.ts`).
  - 6. Hooks: `useAuthStore` | 7. Pages: `/profile` (`handleResetDevice`), `/admin` sign-out & non-admin guard.
  - 8-10: `credentials: "include"`, empty body. | 11. Expected Response: `200 { success: true, data: { message } }`.
  - 12-13: Clears `socketToken`, `localStorage.removeItem("bd_safety_device_id")`, resets `user: null, deviceId: null` without minting an orphan anonymous DB user (`resetAnonymousIdentity()` handles explicit `/profile` reset).
  - 14. Error handling: `try { await apiFetch("/auth/logout") } catch { ... }` best-effort client clear. | 15. AuthZ: Public/cookie. | 16. Trigger: Identity reset / admin logout.
  - 17. Tests: `auth/01`, `contracts/01`, `workflows/01`, `regression/01`.
  - 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Identified Issues: None (`FRONTEND-003` & `FRONTEND-004` fixed & verified).
  - 20. Evidence: Live logout + cookie revocation verified in `workflows/01`; `auth/01` & `regression/01 [FRONTEND-003]/[FRONTEND-004]` PASS.

- **`EP-010` — `GET /api/v1/users/me`**
  - 1. ID: `EP-010` | 2. Method & URL: `GET /api/v1/users/me` | 3. Purpose: Fetch authenticated user profile & verification relations.
  - 4. Expected Consumption: Yes | 5. Service: `useAuthStore` (`store/useAuthStore.ts`), `dev-test/page.tsx`.
  - 6. Hooks: `useAuthStore` | 7. Pages: `Navbar`, `/profile`, `/admin`, `/report`, `/reports/[id]`, `/alerts`, `/safe-zones`.
  - 8. Auth: Required JWT cookie (`credentials: "include"`). | 9-10: None.
  - 11. Expected Response: `200 { success: true, data: { id, email, role, trustScore, isVerified, isBanned, verifications? } }`.
  - 12-13: Unwrapped into `useAuthStore.user`. | 14. Error state: Fallback error string in `useAuthStore`.
  - 15. AuthZ: Citizen / Responder / Admin. | 16. Trigger: Bootstrap check (`initAuth`), post-auth profile fetch & `/profile` refresh.
  - 17. Tests: `api/02`, `auth/01`, `contracts/01`, `workflows/01`, `e2e/01`.
  - 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Issues: None (`FRONTEND-001`, `FRONTEND-004`, `FRONTEND-011` fixed & verified). | 20. Evidence: `workflows/01` + Chromium E2E `GET /api/v1/users/me 200/304`.

- **`EP-011` — `POST /api/v1/users/verify`**
  - 1. ID: `EP-011` | 2. Method & URL: `POST /api/v1/users/verify` | 3. Purpose: Submit KYC verification (`PHONE_OTP` or `NID_DOCUMENT`).
  - 4. Expected Consumption: Yes | 5. Service: `app/profile/page.tsx:110` (`apiFetch`), `dev-test/page.tsx`.
  - 6-7: Local form handler `handleSubmitVerification` on `/profile`.
  - 8. Auth: Required JWT cookie (`USER`). | 9. Params: None.
  - 10. Payload: `{ type: "PHONE_OTP" | "NID_DOCUMENT", phoneNumber?, documentUrl? }`.
  - 11. Expected Response: `201 { success: true, data: { id, userId, type, status, createdAt } }`.
  - 12-13: Clears form, displays `res.type` / `res.status`, calls `await refreshProfile()`.
  - 14. UI States: `isSubmittingVerify`, `verifyError`, `verifySuccess` banner. | 15. AuthZ: `USER`. | 16. Trigger: `/profile` KYC form submit.
  - 17. Tests: `forms/01`, `contracts/01`, `workflows/01`. | 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Issues: None (Note: `@repo/shared` `normalizeBangladeshPhone` does not strip spaces/hyphens, handled separately in `profile/page.tsx` cleanup before calling helper — tested in `unit/01` & `forms/01`).
  - 20. Evidence: Live `POST /api/v1/users/verify 201` in `workflows/01`.

- **`EP-012` — `POST /api/v1/users/verify/:id/approve`**
  - 1. ID: `EP-012` | 2. Method & URL: `POST /api/v1/users/verify/:id/approve` | 3. Purpose: Legacy verification approval endpoint (consolidated under `EP-033` `/admin/verifications/:id/approve`).
  - 4. Expected Consumption: No (frontend uses `EP-033`). | 5-7: None (`app/admin/page.tsx:203` uses `/admin/verifications/${verifId}/approve`).
  - 8-16: Admin-only backend endpoint. | 17. Tests: `contracts/01`. | 18. Status: **BACKEND ONLY**.
  - 19. Issues: None | 20. Evidence: Backend verified (`BACKEND-010` fixed); not invoked by `apps/web`.

---

### Group C: Reports, Voting & Incident Updates (`EP-013` – `EP-019`)

- **`EP-013` — `POST /api/v1/reports`**
  - 1. ID: `EP-013` | 2. Method & URL: `POST /api/v1/reports` | 3. Purpose: Submit new hazard/crime incident report with optional hardware GPS headers.
  - 4. Expected Consumption: Yes | 5. Services: `app/report/page.tsx:465`, `components/incidents/ReportIncidentModal.tsx:267`, `app/dev-test/page.tsx:268`.
  - 6. Helpers: `buildHardwareGpsHeaders()`, `evaluateHardwareGpsProximity()` (`lib/gpsVerification.ts`).
  - 7. Pages/Components: `/report`, `ReportIncidentModal`, `/dev-test`.
  - 8. Auth/Headers: JWT cookie + conditional `x-gps-lat`, `x-gps-lng`, `x-gps-accuracy`.
  - 9. Params: None | 10. Payload: `{ category, severity, latitude, longitude, description? }`.
  - 11. Response: `201 { success: true, data: { id, userId, category, severity, latitude, longitude, description, status, isGpsVerified, mediaUrl?, ... } }`.
  - 12-13: `/report` stores `createdReport` then triggers `uploadReportEvidence(result.id, file)`; modal shows toast/reset after 2s.
  - 14. UI States: `isSubmitting`, error banner, success screen with retry media button on `/report`.
  - 15. AuthZ: Authenticated citizen/responder/admin (`isBanned` blocked by backend). | 16. Trigger: Report form submit.
  - 17. Tests: `forms/01`, `contracts/01`, `workflows/01`, `e2e/01`, `regression/01`.
  - 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Identified Issues: None (`FRONTEND-007` fixed in `ReportIncidentModal.tsx`: trimmed non-empty title/description + `<=1000`-char composed limit; `FRONTEND-010` fixed in `app/report/page.tsx`: 500-char quick-prompt slice & safe manual coordinate draft handling).
  - 20. Evidence: Live `POST /api/v1/reports 201` in `workflows/01` + Chromium E2E `/report` submission -> PostgreSQL persistence -> `/reports/[id]`; `forms/01` & `regression/01` (`[FRONTEND-007]`, `[FRONTEND-010]`) PASS.

- **`EP-014` — `GET /api/v1/reports`**
  - 1. ID: `EP-014` | 2. Method & URL: `GET /api/v1/reports` | 3. Purpose: Viewport/filtered incident listing (`status`, `category`, `severity`, `isNightReport`, `minLat`, `maxLat`, `minLng`, `maxLng`, `limit`).
  - 4. Expected Consumption: Yes | 5. Service: `store/useIncidentStore.ts:90,129`, `app/feed/page.tsx:193`, `app/admin/page.tsx:126`.
  - 6. Hooks: `useIncidentStore` (`fetchIncidents`, `fetchInitialMapData`), `fetchIncidents` (`feed`), `fetchAdminData` (`admin`).
  - 7. Pages/Components: `/` (Map), `/feed`, `/admin`. | 8. Auth: Public (optional auth returns `isOwner`).
  - 9. Query Params: `minLat`, `maxLat`, `minLng`, `maxLng`, `category`, `severity`, `isNightReport`, `limit`. | 10. Body: None.
  - 11. Expected Response: `200 { success: true, data: DangerIncident[] }`.
  - 12-13: Normalized in `useIncidentStore.ts:91-106`, stored in `useIncidentStore.incidents`, `/feed` `incidents`, `/admin` `reports`.
  - 14. UI States: `isLoading`, `isUpdatingBounds`, error alert/retry, empty list state. | 15. AuthZ: Public / Admin overview (`limit=100`).
  - 16. Trigger: Map bounds change, filter toggles, initial page mount.
  - 17. Tests: `api/02`, `contracts/01`, `workflows/01`, `e2e/01`. | 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Issues: Note client `/feed` still passes `minLat=20.0&maxLat=27.0&minLng=88.0&maxLng=93.0` (`<=` Bangladesh grid) cleanly accepted by Zod.
  - 20. Evidence: Executed live (`workflows/01`) + Chromium E2E (`/`, `/feed` returning `200`/`304`).

- **`EP-015` — `GET /api/v1/reports/:id`**
  - 1. ID: `EP-015` | 2. Method & URL: `GET /api/v1/reports/:id` | 3. Purpose: Incident detail dossier including `isOwner`, coordinates, media & updates.
  - 4. Expected Consumption: Yes | 5. File: `app/reports/[id]/page.tsx:168,311`. | 6. Hook: `useEffect`. | 7. Page: `/reports/[id]`.
  - 8. Auth: Optional JWT cookie (computes `isOwner`). | 9. Path Param: `id` (`UUID`). | 10. Body: None.
  - 11. Expected Response: `200 { success: true, data: ReportDetails }`. | 12-13: Stored in local `report` state; re-fetched on `user?.id` change so `isOwner` refreshes after async device auth.
  - 14. UI States: Skeleton loader, `404`/not-found view, error state. | 15. AuthZ: Public (`isOwner` contextual). | 16. Trigger: Direct navigation or clicking feed/map card.
  - 17. Tests: `contracts/01`, `workflows/01`, `e2e/01`. | 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Issues: None | 20. Evidence: Live verified (`workflows/01`) & Chromium E2E (`/report` -> `/reports/[id]` dossier `200`).

- **`EP-016` — `PATCH /api/v1/reports/:id/resolve`**
  - 1. ID: `EP-016` | 2. Method & URL: `PATCH /api/v1/reports/:id/resolve` | 3. Purpose: Mark active incident report as `RESOLVED`.
  - 4. Expected Consumption: Yes | 5. File: `app/reports/[id]/page.tsx:413`, `app/dev-test/page.tsx:293`.
  - 6-7: `/reports/[id]` resolution button (`handleResolve`), `/dev-test` post-test cleanup.
  - 8. Auth: JWT cookie (`isOwner`, `VERIFIED_RESPONDER`, or `ADMIN`). | 9. Path Param: `id`. | 10. Body: None.
  - 11. Expected Response: `200 { success: true, data: ReportDetails }`. | 12-13: Updates `report.status` locally & triggers toast.
  - 14. UI States: `isResolving` button disabled state, success/error toast.
  - 15. AuthZ: UI renders Resolve control only when `report.isOwner || user?.role === "VERIFIED_RESPONDER" || user?.role === "ADMIN"` (`reports/[id]/page.tsx`, verified in `authz/01`).
  - 16. Trigger: Click "Mark Resolved". | 17. Tests: `authz/01`, `contracts/01`, `workflows/01`. | 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Issues: None | 20. Evidence: `workflows/01` responder resolved citizen report `200 OK`; citizen non-owner hidden cleanly in `authz/01`.

- **`EP-017` — `POST /api/v1/reports/:id/vote`**
  - 1. ID: `EP-017` | 2. Method & URL: `POST /api/v1/reports/:id/vote` | 3. Purpose: Community upvote (`1`) / downvote/flag (`-1`) with auto-purge threshold check.
  - 4. Expected Consumption: Yes | 5. Files: `store/useIncidentStore.ts:199`, `app/feed/page.tsx:325`, `app/reports/[id]/page.tsx:356`.
  - 6. Hooks: `useIncidentStore.voteIncident`, `handleVote`. | 7. Pages: `/`, `/feed`, `/reports/[id]`.
  - 8. Auth: Required JWT cookie (non-owner only). | 9. Path Param: `id`. | 10. Payload: `{ voteType: 1 | -1 }`.
  - 11. Expected Response: `201/200 { success: true, data: { upvotes, downvotes, status } }`.
  - 12-13: Optimistic count increment with rollback on HTTP failure (`store` tracks `pendingVoteIds` to prevent double-clicks; filters out if `status === "PURGED"`).
  - 14. UI States: Rollback + toast error on `400`/`429`, in-flight deduplication (`useIncidentStore.ts`). | 15. AuthZ: Self-vote guarded/reverted cleanly. | 16. Trigger: Upvote/Downvote button click.
  - 17. Tests: `api/02`, `contracts/01`, `workflows/01`. | 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Issues: None | 20. Evidence: Mocked rollback & deduplication (`api/02`), Live backend self-vote `400` rollback + second-user `201` vote (`workflows/01`).

- **`EP-018` & `EP-019` — `POST /api/v1/reports/:id/updates` & `GET /api/v1/reports/:id/updates`**
  - 1. IDs: `EP-018`, `EP-019` | 2. Method: `POST`, `GET` | 3. Purpose: Post and read chronological situation updates/comments on an incident.
  - 4. Expected Consumption: Yes | 5. Files: `store/useIncidentStore.ts:249`, `app/feed/page.tsx:373,389`, `app/reports/[id]/page.tsx:169,393`.
  - 6-7: `feed`, `reports/[id]`. | 8. Auth: `GET` public, `POST` requires JWT cookie. | 9. Path Param: `id`.
  - 10. Payload (`POST`): `{ content: string }` (trimmed `>= 2` chars validated in `reports/[id]/page.tsx:383`).
  - 11. Expected Response: Sanitized `{ id, reportId, content, createdAt, author: { isVerified, role, alias } }` (`reportUpdateService.ts:48-62,99-113`).
  - 12-13: Prepended/appended to local `commentsMap` / `updates` list cleanly (`up.author?.role` and `up.author?.alias` align 1:1 with backend!).
  - 14. UI States: `loadingCommentsId`, `submittingCommentId`, error toast. | 15. AuthZ: Authenticated post / public read. | 16. Trigger: Expand updates / submit update.
  - 17. Tests: `contracts/01`, `workflows/01`, `e2e/01`. | 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Issues: None (Earlier speculative hypothesis of author schema mismatch was **DISPROVEN** by live execution against `reportUpdateService.ts`!).
  - 20. Evidence: Live `POST` (`201`) & `GET` (`200`) + schema parity verified in `contracts/01`, `workflows/01`, and Chromium `e2e/01`.

---

### Group D: Safe Zones, Routing, Geofence Alerts & Media (`EP-020` – `EP-031`)

- **`EP-020` — `GET /api/v1/safe-zones`**
  - 1. ID: `EP-020` | 2. Method & URL: `GET /api/v1/safe-zones` | 3. Purpose: Fetch safe shelter/hospital/police stations (optional radial/bbox query).
  - 4. Expected Consumption: Yes | 5. Files: `store/useIncidentStore.ts:154`, `app/safe-zones/page.tsx:154`.
  - 6-7: `/`, `/safe-zones`. | 8. Auth: Public. | 9. Query: optional `lat`, `lng`, `radius`, `minLat`, `maxLat`, `minLng`, `maxLng`, `type`. | 10. Body: None.
  - 11. Expected Response: `200 { success: true, data: SafeZoneItem[] }` (including float `distanceMeters` fixed by `BACKEND-009`).
  - 12-13: Populates `useIncidentStore.safeZones` & `safe-zones/page.tsx` list. | 14. UI States: Loading/empty/error states. | 15. AuthZ: Public. | 16. Trigger: Map mount / category filter on `/safe-zones`.
  - 17. Tests: `api/02`, `contracts/01`, `workflows/01`, `e2e/01`, `regression/01`. | 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Identified Issues: None (`FRONTEND-008` fixed & verified: removed `selectedZone` from `fetchSafeZones` `useCallback` deps, eliminating the `3x` redundant mount request loop).
  - 20. Evidence: Chromium E2E (single `GET /api/v1/safe-zones` on `/safe-zones` load) + `regression/01 [FRONTEND-008]` PASS.

- **`EP-021` — `POST /api/v1/safe-zones`**
  - 1. ID: `EP-021` | 2. Method & URL: `POST /api/v1/safe-zones` | 3. Purpose: Admin creation of new Safe Zone (`POLICE_STATION`, `HOSPITAL`, `SAFE_HAVEN`, `PUBLIC_TRANSIT`).
  - 4. Expected Consumption: Yes | 5. File: `app/safe-zones/page.tsx`. | 6-7: `/safe-zones` Admin Modal (`handleCreateZone`).
  - 8. Auth: `ADMIN` JWT cookie. | 9. Params: None.
  - 10. Payload: `{ name, type, latitude, longitude, address?, phone?, isVerified24x7? }`.
  - 11. Response: `201 { success: true, data: SafeZoneItem }`. | 12-13: Re-fetches safe zones & closes modal.
  - 14. UI States: Button disabled during submit; error toast. | 15. AuthZ: UI renders modal only when `user?.role === "ADMIN"` (`authz/01`).
  - 16. Trigger: Admin "Add Safe Zone" form. | 17. Tests: `authz/01`, `forms/01`, `contracts/01`, `workflows/01`, `regression/01`.
  - 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Identified Issues: None (`FRONTEND-008` fixed & verified: pre-flight validation rejects `name.trim().length < 2`, `!Number.isFinite(lat/lng)`, and coordinates outside Bangladesh bounds `20.0..27.5` / `88.0..93.5`).
  - 20. Evidence: `forms/01`, `workflows/01` (valid payload `201`), `regression/01 [FRONTEND-008]` PASS.

- **`EP-022` — `DELETE /api/v1/safe-zones/:id`**
  - 1. ID: `EP-022` | 2. Method & URL: `DELETE /api/v1/safe-zones/:id` | 3. Purpose: Admin deletion of Safe Zone.
  - 4. Expected Consumption: Yes | 5. File: `app/safe-zones/page.tsx:271`. | 6-7: `/safe-zones` (`handleDeleteZone`).
  - 8. Auth: `ADMIN` JWT cookie. | 9. Path Param: `id` (`UUID`). | 10. Body: None. | 11. Response: `200 { success: true, data: { deletedId } }`.
  - 12-16: Confirms prompt, deletes, refreshes list; gated to `ADMIN`.
  - 17. Tests: `authz/01`, `contracts/01`, `workflows/01`. | 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Issues: None | 20. Evidence: Live `DELETE /api/v1/safe-zones/:id 200` in `workflows/01`.

- **`EP-023` — `POST /api/v1/routes/safe-path`**
  - 1. ID: `EP-023` | 2. Method & URL: `POST /api/v1/routes/safe-path` | 3. Purpose: Compute incident-aware safest & alternate walking/commute paths inside Bangladesh bounds.
  - 4. Expected Consumption: Yes | 5. File: `app/routes/page.tsx:161`. | 6-7: `/routes` (`calculateSafePath`).
  - 8. Auth: Public (JWT cookie optional). | 9. Params: None. | 10. Payload: `{ startLat, startLng, endLat, endLng }`.
  - 11. Response: `200 { success: true, data: SafeRouteOutput }`. | 12-13: Updates `result` state rendered on route map + hazard warnings.
  - 14. UI States: `isLoading`, `isNaN` validation guard, error banner. | 15. AuthZ: Public. | 16. Trigger: Route form submit / URL query auto-run.
  - 17. Tests: `forms/01`, `contracts/01`, `workflows/01`. | 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Issues: None (Client `isNaN` checks numbers; backend rejects out-of-Bangladesh bounds cleanly with structured error displayed in `error` state).
  - 20. Evidence: Live `POST /api/v1/routes/safe-path 200` in `workflows/01`.

- **`EP-024`, `EP-025`, `EP-026` — Alert Zones (`POST`, `GET`, `DELETE /api/v1/alerts/zones*`)**
  - 1. IDs: `EP-024`, `EP-025`, `EP-026` | 2. Methods: `POST`, `GET`, `DELETE` | 3. Purpose: CRUD polygon geofence alert zones (closed ring, `<= 25 km²`).
  - 4. Expected Consumption: Yes | 5. File: `app/alerts/page.tsx:405` (`POST`), `:197` (`GET`), `:436` (`DELETE`).
  - 6-7: `/alerts`. | 8. Auth: Required JWT cookie (`USER`). | 9. Path Param (`EP-026`): `id` (`UUID`).
  - 10. Payload (`EP-024`): `{ name, coordinates: [[lng, lat], ...] }`. | 11. Response: `201`/`200 { success: true, data }`.
  - 12-16: Validates `areaKm2 <= 25.0`, refreshes `zones` list, deletes with confirm prompt.
  - 17. Tests: `forms/01`, `contracts/01`, `workflows/01`, `e2e/01`. | 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Issues: None on CRUD endpoints themselves (WebSocket binding defect tracked under `EP-047` / `FRONTEND-005`).
  - 20. Evidence: Live `POST 201`, `GET 200`, `DELETE 200` in `workflows/01` + Chromium `GET /api/v1/alerts/zones 200`.

- **`EP-027` — `POST /api/v1/alerts/subscribe`**
  - 1. ID: `EP-027` | 2. Method & URL: `POST /api/v1/alerts/subscribe` | 3. Purpose: Register Web Push VAPID browser subscription.
  - 4. Expected Consumption: Yes | 5. File: `app/alerts/page.tsx:469-553` (`handleSubscribePush`). | 6-7: `/alerts`.
  - 8. Auth: Required JWT cookie. | 9. Params: None. | 10. Payload: `{ endpoint: string (URL), keys?: { p256dh: string, auth: string } }`.
  - 11. Response: `200 { success: true, data: { subscribed: true, ... } }`. | 12-14: Sets `pushSubscribed = true` + success toast; surfaces localized error toast if VAPID/PushManager unavailable without posting fake URLs.
  - 15. AuthZ: Authenticated user. | 16. Trigger: "Enable Push Notifications" button on `/alerts`.
  - 17. Tests: `contracts/01`, `forms/01`, `workflows/01`, `regression/01`. | 18. Status: **CORRECTLY INTEGRATED** (`FRONTEND-006 FIXED AND VERIFIED`).
  - 19. Identified Issues: Resolved — removed synthetic `https://push.safetymap.bd/device/...` fallback and dummy keys; wired `PushManager.subscribe` with `NEXT_PUBLIC_VAPID_PUBLIC_KEY`; added `push` and `notificationclick` handlers in `public/sw.js:70-124`.
  - 20. Evidence: Inspected `app/alerts/page.tsx:457-553`, `public/sw.js:70-124`; `[FRONTEND-006]` PASS + `forms/01` `5/5` PASS + `workflows/01` live contract PASS.

- **`EP-028`, `EP-029`, `EP-030` — Media Evidence Upload (`GET /media/presigned-url`, `POST /media/confirm`, `POST /media/mock-upload`)**
  - 1. IDs: `EP-028`, `EP-029`, `EP-030` | 2. Methods: `GET`, `POST`, `POST` | 3. Purpose: Presigned upload slot allocation, confirmation with SHA/URL verification, or local mock-mode upload fallback.
  - 4. Expected Consumption: Yes | 5. File: `lib/mediaUpload.ts:152` (`EP-028`), `:158` (`EP-030`), `:179` (`EP-029`).
  - 6-7: Invoked from `app/report/page.tsx:474,507` (`uploadReportEvidence`). | 8. Auth: Required JWT cookie (owner).
  - 9. Query (`EP-028`): `reportId`, `fileType`, `fileSize` (strict Zod `.strict()`). | 10. Body (`EP-029`/`EP-030`): `{ reportId, fileKey, originalUrl }` / `{ reportId, imageDataUrl }`.
  - 11. Expected Response: `200`/`201 { success: true, data }`.
  - 12-16: Pre-validated via `validateEvidenceFile()` (JPEG/PNG/WebP, `<= 5 MB`), retries safely on `/report`.
  - 17. Tests: `unit/01`, `contracts/01`, `workflows/01` (`EP-028`, `EP-029`).
  - 18. Status: `EP-028`, `EP-029`: **CORRECTLY INTEGRATED**; `EP-030`: **PARTIALLY INTEGRATED** (schema & mocked branch verified; live `mock-upload` path depends on `STORAGE_MODE=mock`).
  - 19. Issues: None | 20. Evidence: Live `EP-028` + `EP-029` executed against Express in `workflows/01`.

- **`EP-031` — `POST /api/v1/media/webhook`**
  - 1. ID: `EP-031` | 2. Method & URL: `POST /api/v1/media/webhook` | 3. Purpose: Server-to-server cloud storage upload webhook authenticated by `x-webhook-secret`.
  - 4. Expected Consumption: No | 5-7: None (`BACKEND ONLY`). | 17. Tests: `contracts/01`. | 18. Status: **BACKEND ONLY**.
  - 19. Issues: None | 20. Evidence: Backend verified (`BACKEND-009` envelope alignment); excluded from client bundle (`apps/web`).

---

### Group E: Administration, Moderation & Real-Time Sockets (`EP-032` – `EP-041`, `EP-047`)

- **`EP-032`, `EP-038`, `EP-039`, `EP-040` — Admin Read & Crawl Endpoints (`GET /admin/verifications`, `GET /admin/logs`, `GET /admin/analytics/trends`, `POST /admin/news/crawl`)**
  - 1. IDs: `EP-032`, `EP-038`, `EP-039`, `EP-040` | 2. Methods: `GET`, `GET`, `GET`, `POST` | 3. Purpose: Pending KYC queue, paginated moderation audit logs, 7-day incident trends, manual news crawler trigger.
  - 4. Expected Consumption: Yes | 5. File: `app/admin/page.tsx:136` (`EP-032`), `:132` (`EP-038`), `:113,140` (`EP-039`), `:313` (`EP-040`).
  - 6-7: `/admin` (`fetchAdminData`, `handleTriggerNewsCrawl`). | 8. Auth: `ADMIN` JWT cookie.
  - 9. Query: `EP-038` uses `?page=1&limit=30`; others none. | 10. Body: None. | 11. Expected Response: `{ success: true, data }`.
  - 12-16: Rendered in Admin tables/cards; gated by `/admin` password login screen.
  - 17. Tests: `authz/01`, `contracts/01`, `workflows/01` (`EP-032`, `EP-038`, `EP-039`), `regression/01`.
  - 18. Status: `EP-032`, `EP-038`, `EP-039`: **CORRECTLY INTEGRATED**; `EP-040`: **PARTIALLY INTEGRATED** (live external RSS crawl excluded from offline tests).
  - 19. Identified Issues: None for `EP-032`/`EP-038`/`EP-039` (`FRONTEND-009` fixed & verified: `fetchAdminData` surfaces errors via `showToast(..., "error")` and visible error alert banner with Retry).
  - 20. Evidence: Live `200` on `EP-032`/`EP-038`/`EP-039` in `workflows/01`; `regression/01 [FRONTEND-009]` PASS.

- **`EP-033`, `EP-034`, `EP-035`, `EP-036`, `EP-037` — Admin Moderation Actions (`approve`, `reject`, `ban`, `unban`, `purge`)**
  - 1. IDs: `EP-033`–`EP-037` | 2. Method: `POST` | 3. Purpose: Approve/reject KYC verification, ban/unban user accounts, purge spam/abusive incident reports.
  - 4. Expected Consumption: Yes | 5. Files: `app/admin/page.tsx` & `app/reports/[id]/page.tsx:448` (`EP-037`).
  - 6-7: `/admin` & `/reports/[id]` (`ADMIN` only). | 8. Auth: `ADMIN` JWT cookie. | 9. Path Param: `id` (`UUID`).
  - 10. Payload: Empty for `EP-033`; `{ reason: string (min 3) }` for `EP-034`–`EP-037`.
  - 11. Response: `200 { success: true, data }`. | 12-16: Refreshes admin lists / displays toast.
  - 17. Tests: `authz/01`, `forms/01`, `contracts/01`, `workflows/01` (`EP-033`, `EP-035`, `EP-036`, `EP-037`), `regression/01`.
  - 18. Status: **CORRECTLY INTEGRATED** (`EP-033`–`EP-037`).
  - 19. Identified Issues: None (`FRONTEND-009` fixed & verified: `/admin` enforces `.trim().length >= 3` on reject/purge/ban/unban reasons and validates `UUID_PATTERN` on `banUserId` before calling backend endpoints).
  - 20. Evidence: Live `200` on `EP-033`/`EP-035`/`EP-036`/`EP-037` in `workflows/01`; `forms/01` & `regression/01 [FRONTEND-009]` PASS.

- **`EP-041` — `GET /api/v1/stats`**
  - 1. ID: `EP-041` | 2. Method & URL: `GET /api/v1/stats` | 3. Purpose: Public platform aggregate counts (`activeReports`, `verifiedReports`, `safeZones`, `communityVotes`).
  - 4. Expected Consumption: Yes | 5. Service: `store/useStatsStore.ts:35`. | 6. Hooks: `useStatsStore` (`fetchStats`).
  - 7. Pages/Components: `/`, `/feed`. | 8. Auth: Public. | 9-10: None.
  - 11. Response: `200 { success: true, data: { activeReports, verifiedReports, safeZones, communityVotes } }`.
  - 12-16: Unwrapped & synced with real-time Socket.IO `STATS_UPDATED`.
  - 17. Tests: `api/02`, `contracts/01`, `workflows/01`, `e2e/01`. | 18. Status: **CORRECTLY INTEGRATED**.
  - 19. Issues: None | 20. Evidence: Mocked (`api/02`), Live (`workflows/01`), Chromium E2E (`e2e/01`).

- **`EP-047` — `WS /socket.io`**
  - 1. ID: `EP-047` | 2. Endpoint & Protocol: `WS /socket.io` (WebSocket + polling transport fallback) | 3. Purpose: Real-time broadcast of `NEW_REPORT`, `REPORT_UPDATED`, `REPORT_DELETED`, `STATS_UPDATED`, and private `GEOFENCE_ALERT` events.
  - 4. Expected Consumption: Yes | 5. Service: `lib/socket.ts` (`getSocket`, `setSocketAuthToken` / `setSocketToken`, `joinMapBounds`).
  - 6. Consumers: `store/useIncidentStore.ts`, `store/useStatsStore.ts`, `app/feed/page.tsx`, `app/reports/[id]/page.tsx`, `app/alerts/page.tsx:207-244`.
  - 8. Auth: Optional `auth: { token: currentSocketToken }` handshake (authenticated sockets join `user:${userId}` room for `GEOFENCE_ALERT`).
  - 9-10: Viewport room emission `UPDATE_BOUNDS` (`{ minLng, minLat, maxLng, maxLat }`). | 11-16: Live UI updates across stores & feeds.
  - 17. Tests: `workflows/01`, `e2e/01`, `regression/01`. | 18. Status: **CORRECTLY INTEGRATED** (`FRONTEND-005 FIXED AND VERIFIED`).
  - 19. Identified Issues: Resolved — `app/alerts/page.tsx:207-244` now awaits `initAuth()` before invoking `getSocket()` and attaching `GEOFENCE_ALERT` (with cleanup cancellation); `lib/socket.ts:13-36` reconnects existing/stale sockets on non-null token upgrade and disconnects cleanly without reconnecting when cleared to `null`.
  - 20. Evidence: `[FRONTEND-005]` PASS, live Socket.IO `workflows/01` `3/3` PASS, and Chromium `e2e/01` `3/3` PASS connecting `/alerts` cleanly as `[Socket.IO] Authenticated client connected`.

---

## 4. Non-Backend External & Browser APIs Discovered in `apps/web` (`EXT-001` – `EXT-006`)

| ID | Service / Browser API | Target / Mechanism | Calling File & Line | Purpose & Notes |
| --- | --- | --- | --- | --- |
| `EXT-001` | Photon Geocoding API | `GET https://photon.komoot.io/api/` | `components/map/LocationSearchBar.tsx:67-72`, `components/map/LocationCalibrationModal.tsx:85-90` | Primary Bangladesh place search & map pin calibration |
| `EXT-002` | OpenStreetMap Nominatim | `GET https://nominatim.openstreetmap.org/search` | `components/map/LocationSearchBar.tsx:98-102` | Fallback Bangladesh geocoder when Photon returns 0 hits |
| `EXT-003` | Direct Cloud Storage PUT | `PUT ${presigned.uploadUrl}` | `lib/mediaUpload.ts:167-173` | Direct browser binary upload to Supabase/S3 presigned URL |
| `EXT-004` | Service Worker Tile Cache & Web Push | `caches.open("bd-safety-map-tiles")`, `push`, `notificationclick` | `public/sw.js:1-124` | Stale-while-revalidate for OSM & CartoDB tiles (excludes `/_next/`, `/api/`, `/socket.io/`), plus `push` & `notificationclick` listeners (`FRONTEND-006` fix) |
| `EXT-005` | Browser Web Push API | `Notification.requestPermission()`, `reg.pushManager.getSubscription()`, `reg.pushManager.subscribe()` | `app/alerts/page.tsx:469-553` | Subscribes via VAPID (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`) or surfaces honest unsupported/missing-config error (`FRONTEND-006` fix) |
| `EXT-006` | Hardware Geolocation API | `navigator.geolocation.getCurrentPosition()` | `app/report/page.tsx:356-374`, `components/incidents/ReportIncidentModal.tsx` | Supplies genuine hardware coordinates & accuracy (`<=250m`, within `200m`) for trusted responder badge headers |
