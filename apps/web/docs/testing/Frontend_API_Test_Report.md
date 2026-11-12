# Frontend API Integration & Functional Audit Test Report — DangerZoneBD (`apps/web`)

**Generated:** `2026-11-12T16:22:56.515Z` (Synchronized with `results.json` & `coverage-summary.json`)  
**Audited Application:** `apps/web` (Next.js 14.2.3 App Router, React 18, TypeScript, Zustand 4.5.2, Socket.IO Client 4.7.5)  
**Verified Backend Baseline:** `apps/api` ([`API_Test_Report.md`](../../../api/docs/testing/API_Test_Report.md), [`API_Endpoint_Inventory.md`](../../../api/docs/testing/API_Endpoint_Inventory.md) `EP-001`–`EP-047`, [`API_Findings.json`](../../../api/docs/testing/API_Findings.json) `BACKEND-001`–`BACKEND-014` all `FIXED AND VERIFIED`)  
**Companion Inventory & Machine Findings:** [`Frontend_API_Integration_Inventory.md`](./Frontend_API_Integration_Inventory.md) | [`Frontend_Findings.json`](./Frontend_Findings.json)  
**Application Source Integrity:** All `FRONTEND-001`–`FRONTEND-011` defects and `/health` probe normalization fixed & verified in `apps/web`; **`apps/api/**` 100% PRESERVED** (`0` backend edits).

---

## Section A — Executive Summary & Production-Readiness Verdict

### Verdict: **READY FOR PRODUCTION RELEASE (`54/54` PASS — ALL 11 DEFECTS FIXED & VERIFIED)**

- All **54/54 automated tests across all 12 suites passed (`0 failed`, `0 skipped`, `0 cancelled`)** covering Mocked Unit/API/Auth/RBAC/Forms/Components (`33/33`), Contract Schema Parity (`4/4` covering `47/47` endpoints), Live Ephemeral Express + PostgreSQL/PostGIS + Socket.IO Workflows (`3/3`, `0` database orphans across all 6 tables), Real Headless Chromium + Next.js E2E (`3/3`, all 10 App Router routes & interactive `/report` -> PostgreSQL -> `/reports/[id]` roundtrip), and the **11-case Defect Regression Suite (`11/11` passing)** for `FRONTEND-001`–`FRONTEND-011`.

### Mandatory Audit Statistics

| Metric | Observed Value |
| --- | --- |
| Total backend & Next proxy interfaces in contract baseline | **47** (`EP-001`–`EP-047`) |
| Additional non-backend external/browser integrations discovered | **6** (`EXT-001`–`EXT-006`) |
| Consumed by frontend UI / Client stores (`coverage-summary.json`) | **37** |
| Next.js App Router Proxy / Cron handlers | **4** (`EP-043`, `EP-044`, `EP-045`, `EP-046`) |
| Intentionally Backend Only (`BACKEND ONLY`) | **6** (`EP-001`, `EP-004`, `EP-005`, `EP-012`, `EP-031`, `EP-042`) |
| **Correctly Integrated** (`EP-*`) | **36** |
| **Partially Integrated** (`EP-*`) | **5** (`EP-030`, `EP-040`, `EP-043`, `EP-045`, `EP-046` — mocked/contract verified cleanly; live RSS & mock-storage excluded from offline CI) |
| **Incorrectly Integrated** (`EP-*`) | **0** |
| **Missing Integration / Intentionally Unused / Blocked** | **0 / 0 / 0** |
| **Total Automated Tests Executed (`--profile=report`)** | **54** (`43` Verification + `11` Defect Regression) |
| **Verification Suites Passed / Failed / Skipped** | **43 / 0 / 0** (`100%` verified) |
| **Defect Regression Cases Executed** | **11 / 11 PASS (`11 pass, 0 fail` — `FRONTEND-001`..`011` FIXED AND VERIFIED)** |
| **Endpoint Verification Breakdown (`coverage-summary.json`)** | Contract: **47/47** \| Mocked: **41/47** \| Live Backend: **38/47** \| Chromium E2E: **13/47** |
| Next.js TypeScript Check (`tsc --noEmit`) | **PASS (exit code 0)** |
| Next.js Production Build (`next build`) | **PASS (exit code 0, `13/13` App Router routes)** |
| Total Suite Execution Duration (`--profile=report`) | **69.53s** (`69,526 ms`) |

---

## Section B — Backend-to-Frontend API Mapping Summary

Complete 20-attribute mapping and traceability tables for `EP-001`–`EP-047` and `EXT-001`–`EXT-006` live in [`Frontend_API_Integration_Inventory.md`](./Frontend_API_Integration_Inventory.md). High-level architectural routing:

- **Browser HTTP Transport (`apps/web/lib/api.ts:7-32`)**: Defaults to same-origin `/api/v1` (forwarded in production by `apps/web/next.config.mjs:15-17` rewrites to `https://danger-zone-bd.onrender.com/api/v1/:path*`) or uses `NEXT_PUBLIC_API_URL` directly when configured. Sends `credentials: "include"` so `HttpOnly` JWT cookies traverse CORS cleanly.
- **Next.js App Router Route Handlers**:
  - `GET /api/health` (`apps/web/app/api/health/route.ts`) strips `/api/v1` cleanly and probes `/health` & `/health/db`, returning `200` healthy or `503` degraded.
  - `GET|POST /api/cron/news-crawl` (`apps/web/app/api/cron/news-crawl/route.ts`) performs SHA-256 timing-safe verification of `CRON_SECRET` (`Authorization: Bearer` or `x-cron-secret`) and relays `POST /api/v1/cron/news-crawl`.
- **Real-Time Transport (`apps/web/lib/socket.ts`)**: Connects `socket.io-client` to stripped root origin (`replace(/\/api\/v1$/, "")`) with in-memory `currentSocketToken` handshake and `withCredentials: true`.

---

## Section C — API Integration Architecture Audit

1. **Strengths Verified Live:**
   - **Envelope & Error Extraction (`lib/api.ts:112-122`)**: Correctly unwraps `{ success: true, data }`, omits `Content-Type` automatically for `FormData`, and surfaces structured Zod `{ error: { message } }` errors as `ApiError` instances.
   - **Security Token Hygiene**: JWTs remain strictly inside `HttpOnly` cookies on REST calls, and `socketToken` is held strictly in JS memory (not `localStorage`/`sessionStorage`).
   - **Route Handler Hardening**: `/api/cron/news-crawl` uses constant-time `crypto.timingSafeEqual` on SHA-256 digests and fails closed (`401`) if `CRON_SECRET` is unset.
   - **Hardware GPS & Media Guards (`lib/gpsVerification.ts`, `lib/mediaUpload.ts`)**: Enforces unmodified hardware GPS fix proximity (`<= 250m` accuracy, `<= 200m` pin distance) and MIME/5MB validation prior to upload.
2. **Architectural Gaps Discovered & Resolved:**
   - **Refresh & Auth Mutexes (`FRONTEND-001`, `FRONTEND-011` — FIXED AND VERIFIED):** `lib/api.ts` now serializes `401` token refreshes behind a module-scoped Promise mutex (`refreshInFlightPromise`), and `useAuthStore.initAuth()` deduplicates StrictMode/concurrent mounts behind `initAuthPromise` while checking `GET /users/me` before `/auth/device` (`FRONTEND-004` — FIXED AND VERIFIED).
   - **Request Timeout Guard (`FRONTEND-010` — FIXED AND VERIFIED):** `apiFetch` now applies a default `25,000ms` `AbortController` timeout (`createRequestSignal`) merged with caller `options.signal` and cleaned up in `finally`.
   - **Direct Probe URL Normalization (`apps/web/app/health/page.tsx` — FIXED AND VERIFIED):** Strips trailing slashes and `/api/v1` before probing `/health` and `/health/db` (matching `app/api/health/route.ts`).
   - **Service Worker Push Support (`apps/web/public/sw.js` & `app/alerts/page.tsx` — FIXED AND VERIFIED):** Registers genuine `PushManager.subscribe` with `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (no synthetic fallback) and handles `push` / `notificationclick` events in `sw.js` (`FRONTEND-006`).
3. **Disproven Hypothesis (Confirmed Compliant):**
   - Prior static inspection raised a concern that `app/reports/[id]/page.tsx` expected `up.author?.role` / `alias` differently from backend updates. Live verification and inspection of `apps/api/src/services/reportUpdateService.ts:48-62,99-113` proved the backend returns `{ id, reportId, content, createdAt, author: { isVerified, role, alias } }`, matching frontend types 1:1 (`contracts/01` + `workflows/01` PASS).

---

## Section D — Detailed Test Execution Results (Strictly Separated by Layer)

> **Mocked vs. Live Separation Rule:** Mocked Node tests, Schema Contract checks, Live Ephemeral Express+PostgreSQL integration runs, Headless Chromium E2E runs, and Defect Regression checks are isolated in separate suites and counters.

| Execution Layer | Test Files | Executed | Passed | Failed | Skipped | Duration / Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| **1. Mocked (Unit / API / Stores / Route Handlers / Auth / RBAC / Forms / SSR Components)** | `unit/01`, `api/01`, `api/02`, `api/03`, `authentication/01`, `authorization/01`, `forms/01`, `components/01` | **33** | **33** | **0** | **0** | Offline deterministic `fetch` stubbing (`installFetchMock`) + isolated DOM storage (`installBrowserGlobals`). Covers single-flight 401 refresh mechanics, 502 HTML errors, AbortController timeouts, Zustand store rollback & `resetAnonymousIdentity()`, `/api/health`, `/api/cron/news-crawl`, RBAC, validation & SSR hydration. |
| **2. Contract Verification (Backend Schema Parity)** | `contracts/01-backend-contract-alignment.test.ts` | **4** | **4** | **0** | **0** | Validates 100% `EP-001`–`EP-047` manifest alignment, strict outgoing Zod payload parity, `EP-018`/`EP-019` `author.role` alignment, and `/dev-test` route alignment. |
| **3. Live Backend Integration (Express + PostgreSQL/PostGIS + Socket.IO)** | `workflows/01-live-backend-integration.test.ts` | **3** | **3** | **0** | **0** | Boots real ephemeral Express + Socket.IO server against PostgreSQL + PostGIS with in-memory `TestCookieJar` (`30,238ms`). Executes `/api/health` (`274.59ms`), full citizen -> KYC -> responder -> admin lifecycle (`27,245.21ms`), and real Socket.IO `UPDATE_BOUNDS` (`126.39ms`). PostgreSQL verification confirmed `0` leaked records across all 6 DB tables. |
| **4. Real Browser E2E (Headless Chromium + Live Next.js + Live Backend)** | `e2e/01-browser-playwright-e2e.test.ts` | **3** | **3** | **0** | **0** | Boots Next.js `127.0.0.1` dev server (`NEXT_PUBLIC_API_URL` pointed to ephemeral Express) + headless Chrome/Edge via `puppeteer-core` (`34,750ms`). Verifies `/` real browser auth/feed/safe-zones/stats, interactive `/report` submit (`POST /api/v1/reports 201`) -> PostgreSQL persistence -> `/reports/[id]` dossier (`6,077.09ms`), and zero uncaught errors/5xx across `/feed`, `/routes`, `/safe-zones`, `/alerts`, `/profile`, `/health`, `/dev-test`, `/admin` (`16,179.98ms`). |
| **5. Defect Regression Suite (Asserts Expected Fixed State)** | `regression/01-confirmed-frontend-defects.test.ts` | **11** | **11** | **0** | **0** | Every test encodes the target fixed behavior for `FRONTEND-001` through `FRONTEND-011`. All `11/11` PASS (`74.96ms`). |

---

## Section E — Confirmed Defect Reports & 12-Part Coding Agent Fix Handoffs (`FRONTEND-001` – `FRONTEND-011`)

Every confirmed finding below contains all 12 Handoff elements required by `dontADDgit/frontend_api_test.md`.

---

### Issue 1: `FRONTEND-001` — Un-Mutexed Concurrent `401 -> POST /auth/refresh` Token Rotation Race
1. **Unique Issue ID:** `FRONTEND-001` | **Title:** Concurrent `401` responses trigger parallel `POST /api/v1/auth/refresh` requests colliding with single-use refresh tokens | **Category:** Authentication / Concurrency | **Severity:** High | **Priority:** **P1** | **Module:** Central HTTP Client | **Endpoint:** `POST /api/v1/auth/refresh` (`EP-008`), all authenticated GET/POST endpoints (`EP-010`, `EP-041`).
2. **Exact Source Code Location:** `apps/web/lib/api.ts:86-110` inside `apiFetch<T>()`.
3. **Issue Description:** When multiple API calls fire in parallel on page mount (e.g., `/users/me` and `/stats` after access-token expiration) and both return `401`, each `apiFetch` call independently invokes `fetch("${API_BASE_URL}/auth/refresh", { method: "POST", credentials: "include" })`. Because the backend implements strict single-use rotating refresh tokens (`BACKEND-002`), the first refresh consumes the token while the second arrives with the superseded token, triggering reuse detection, revoking the user's entire refresh token family, and failing the session.
4. **Reproduction Instructions:**
   - **Env/Role:** Any authenticated user (`USER`, `VERIFIED_RESPONDER`, `ADMIN`) with expired `access_token` cookie and valid `refresh_token` cookie.
   - **Steps:** Run `npm --prefix apps/web run test:web:regression` or invoke `await Promise.all([apiFetch("/users/me"), apiFetch("/stats")])` when both return `401`.
   - **Expected Calls:** `POST /api/v1/auth/refresh` called **1** time; both retrying calls succeed.
   - **Actual Calls (`results.json`):** `POST /api/v1/auth/refresh` called **2** times (`2 !== 1`).
5. **Expected vs Actual Behavior:** Expected: Second and subsequent `401` callers await the shared in-flight refresh Promise and retry using the newly issued cookie. Actual: Every concurrent `401` executes its own `/auth/refresh` fetch.
6. **Root Cause Analysis:** Confirmed in `apps/web/lib/api.ts:86-110`: module scope lacks a singleton `let refreshInFlightPromise: Promise<boolean> | null = null` mutex.
7. **Recommended Fix:** Introduce a module-scoped single-flight Promise lock around the refresh call (`refreshInFlightPromise`), clearing it in `finally`. If `refreshPromise` resolves `true`, all waiting callers retry once with `{ ...options, skipAuthRefresh: true }`. Do NOT modify backend single-use rotation security.
8. **Regression Test Requirements:** `[FRONTEND-001]` in `apps/web/tests/regression/01-confirmed-frontend-defects.test.ts:40-70`; also check `apps/web/tests/api/01-mocked-api-and-resilience.test.ts` (update the existing unfixed-documentation test if needed after fix).
9. **Acceptance Criteria:** `[FRONTEND-001]` regression test passes (`1 === 1`); live multi-request expiry recovery keeps user authenticated without session revocation.
10. **Fix Verification Status:** `FIXED AND VERIFIED` (`apps/web/lib/api.ts`; `[FRONTEND-001]` PASS, `api/01` PASS).
11. **Cross-Module / Cross-API Impact:** Impacts all parallel page-load calls (`/`, `/feed`, `/admin`, `/alerts`) whenever 15m access JWT expires. Frontend owns fix exclusively.
12. **Coding Agent Summary:** Add single-flight Promise lock to `lib/api.ts` refresh block (`P1`).

---

### Issue 2: `FRONTEND-002` — `POST /api/v1/auth/login` `401` Triggers Unintended Silent `/auth/refresh`
1. **Unique Issue ID:** `FRONTEND-002` | **Title:** Wrong admin login password (`401`) triggers silent `/auth/refresh` retry | **Category:** Authentication / Error Handling | **Severity:** High | **Priority:** **P1** | **Module:** Central HTTP Client & Admin Login | **Endpoint:** `POST /api/v1/auth/login` (`EP-007`), `POST /api/v1/auth/refresh` (`EP-008`).
2. **Exact Source Code Location:** `apps/web/lib/api.ts:86-91` (`!endpoint.includes("/auth/refresh") && !endpoint.includes("/auth/device")`).
3. **Issue Description:** When an admin enters a wrong password on `/admin`, `POST /api/v1/auth/login` returns `401 Invalid credentials`. Because `/auth/login` is omitted from the exclusion condition on line 87, `apiFetch` silently invokes `POST /api/v1/auth/refresh` (which can succeed if an anonymous device refresh cookie exists!) and re-posts the wrong credentials a second time.
4. **Reproduction Instructions:** Execute `[FRONTEND-002]` in `apps/web/tests/regression/01-confirmed-frontend-defects.test.ts:72-94` (POST `/auth/login` returning `401`). Expected `/auth/refresh` calls: `0`; Actual (`results.json`): `1 !== 0`.
5. **Expected vs Actual Behavior:** Expected: `401` on `/auth/login` throws `ApiError(401, "Invalid credentials")` immediately with zero refresh attempts. Actual: Calls `/auth/refresh` once before re-attempting `/auth/login`.
6. **Root Cause Analysis:** Confirmed omission in `apps/web/lib/api.ts:87`.
7. **Recommended Fix:** Exclude `endpoint.includes("/auth/login")` (and `/auth/logout`) from silent refresh in `apps/web/lib/api.ts:87` (or pass `skipAuthRefresh: true` in `loginAdminWithPassword` and guard centrally in `api.ts`).
8. **Regression Test Requirements:** `[FRONTEND-002]` in `apps/web/tests/regression/01-confirmed-frontend-defects.test.ts:72-94` and `tests/api/01-mocked-api-and-resilience.test.ts`.
9. **Acceptance Criteria:** `[FRONTEND-002]` passes (`0 === 0` refresh calls); invalid password error renders immediately on `/admin`.
10. **Fix Verification Status:** `FIXED AND VERIFIED` (`apps/web/lib/api.ts`; `[FRONTEND-002]` PASS, `api/01` PASS).
11. **Cross-Module / Cross-API Impact:** Prevents double failed-login attempts against backend IP rate limiter on `/auth/login`. Frontend owns fix.
12. **Coding Agent Summary:** Add `/auth/login` (and `/auth/logout`) to silent-refresh exclusion in `lib/api.ts` (`P1`).

---

### Issue 3: `FRONTEND-003` — Rejected Non-Admin Session Leaves `HttpOnly` Cookies Active
1. **Unique Issue ID:** `FRONTEND-003` | **Title:** `loginAdminWithPassword` sets `HttpOnly` cookies via `/auth/login` then rejects non-`ADMIN` without calling `/auth/logout` | **Category:** Authorization & Session Hygiene | **Severity:** High | **Priority:** **P1** | **Module:** Auth Store (`/admin` login) | **Endpoint:** `POST /api/v1/auth/login` (`EP-007`), `POST /api/v1/auth/logout` (`EP-009`).
2. **Exact Source Code Location:** `apps/web/store/useAuthStore.ts:90-115` (`loginAdminWithPassword`).
3. **Issue Description:** `loginAdminWithPassword` posts credentials to `/auth/login` (which instructs the browser to store valid `HttpOnly` `access_token` & `refresh_token` cookies for a `USER` or `VERIFIED_RESPONDER` account), fetches `/users/me`, sees `profile.role !== "ADMIN"`, clears only Zustand's JS state, and throws `"This account does not have administrator privileges."` without revoking the freshly minted `HttpOnly` server session cookies.
4. **Reproduction Instructions:** Sign in on `/admin` via `loginAdminWithPassword('cit@example.com', 'password123')` where `role === 'USER'`. Run `[FRONTEND-003]` in `regression/01`: expected `POST /api/v1/auth/logout` calls: `1`; Actual (`results.json`): `0 !== 1`.
5. **Expected vs Actual Behavior:** Expected: Revoke cookies via `POST /api/v1/auth/logout` (with `skipAuthRefresh: true`) and clear `socketToken` before throwing privilege error. Actual: Non-admin cookies remain persisted in the browser across subsequent navigations.
6. **Root Cause Analysis:** Confirmed missing `apiFetch("/auth/logout", { method: "POST" })` in the non-admin rejection branch of `apps/web/store/useAuthStore.ts:100-104`.
7. **Recommended Fix:** Inside `if (profile.role !== "ADMIN")` (before throwing), `setSocketToken(null)`, reset store user state, and `await apiFetch("/auth/logout", { method: "POST" }).catch(() => {})`.
8. **Regression Test Requirements:** `[FRONTEND-003]` in `regression/01` + `tests/api/02-stores-and-sockets-mocked.test.ts` + live verification in `workflows/01`.
9. **Acceptance Criteria:** `[FRONTEND-003]` passes (`1 === 1`); subsequent `GET /api/v1/users/me` returns `401` after rejected login.
10. **Fix Verification Status:** `FIXED AND VERIFIED` (`apps/web/store/useAuthStore.ts`; `[FRONTEND-003]` PASS, `api/02` PASS).
11. **Cross-Module / Cross-API Impact:** Prevents silent privilege confusion if a responder logs into `/admin`, gets rejected visually, then returns to `/` still carrying responder credentials instead of their device session. Frontend owns fix.
12. **Coding Agent Summary:** Call `/auth/logout` when `loginAdminWithPassword` rejects `profile.role !== "ADMIN"` (`P1`).

---

### Issue 4: `FRONTEND-004` — Unconditional `POST /auth/device` Overwrites Authenticated Sessions & Mints DB Users on Logout
1. **Unique Issue ID:** `FRONTEND-004` | **Title:** `initAuth` blindly calls `POST /auth/device` without checking existing `/users/me` session, downgrading Admins and creating orphan device rows on `logout` | **Category:** Authentication & State Synchronization | **Severity:** High | **Priority:** **P1** | **Module:** Auth Store & Page Bootstrap | **Endpoint:** `POST /api/v1/auth/device` (`EP-006`), `GET /api/v1/users/me` (`EP-010`), `POST /api/v1/auth/logout` (`EP-009`).
2. **Exact Source Code Location:** `apps/web/store/useAuthStore.ts:45-88` (`initAuth`) & `:126-139` (`logout`).
3. **Issue Description:** Almost every page (`/`, `/feed`, `/report`, `/routes`, `/safe-zones`, `/alerts`, `/profile`) calls `initAuth()` in `useEffect`. `initAuth()` unconditionally reads `localStorage.bd_safety_device_id` and executes `POST /auth/device`, overwriting the browser's active `ADMIN` or `VERIFIED_RESPONDER` `HttpOnly` cookie session back to the anonymous `USER` device account whenever the admin navigates away from `/admin`! Furthermore, `logout()` (`:138`) immediately calls `get().initAuth()`, minting a brand-new anonymous `User` row in PostgreSQL right after signing out.
4. **Reproduction Instructions:** Authenticate as `ADMIN`, navigate to `/` or `/feed`, or run `[FRONTEND-004]` in `regression/01`. Expected `POST /auth/device` calls when `/users/me` returns 200 `ADMIN`: `0`; Actual (`results.json`): `1 !== 0`.
5. **Expected vs Actual Behavior:** Expected: `initAuth()` checks `GET /users/me` first (or inspects current valid session unless explicit device switch is requested); if `200`, hydrate `user` without calling `POST /auth/device`. Only invoke `POST /auth/device` when `/users/me` is `401`/unauthenticated (and reconsider auto-creating on logout unless explicitly resetting citizen device identity).
6. **Root Cause Analysis:** Confirmed in `apps/web/store/useAuthStore.ts:55-80,138`. Note: `app/profile/page.tsx:134-142` (`handleSwitchIdentity`) already calls `POST /auth/device` explicitly with `{ anonymousId: anonId }` directly before calling `initAuth()`, so checking `/users/me` first in `initAuth` preserves identity switching too!
7. **Recommended Fix:** In `initAuth()`: first attempt `GET /users/me` (with `skipAuthRefresh` disabled so refresh cookies recover expired JWTs cleanly). Only if unauthenticated (`401`), fall back to `POST /auth/device`. In `logout()`, clear `localStorage` and cookies without automatically minting a new anonymous DB row (or provide separate `resetAnonymousIdentity()` for `/profile`).
8. **Regression Test Requirements:** `[FRONTEND-004]` in `regression/01`, `authentication/01`, and `workflows/01` live session preservation across `initAuth()`.
9. **Acceptance Criteria:** Active `ADMIN` / `VERIFIED_RESPONDER` sessions survive navigating `/admin` -> `/` -> `/safe-zones` -> `/admin`; `[FRONTEND-004]` passes.
10. **Fix Verification Status:** `FIXED AND VERIFIED` (`apps/web/store/useAuthStore.ts`, `apps/web/app/profile/page.tsx`; `[FRONTEND-004]` PASS, `auth/01` PASS, `workflows/01` PASS).
11. **Cross-Module / Cross-API Impact:** Enables `/safe-zones` Admin create/delete (`EP-021`, `EP-022`), `/reports/[id]` Admin purge (`EP-037`), and Responder resolution (`EP-016`) to actually retain elevated role across client navigation! Currently navigating from `/admin` to `/safe-zones` downgrades the Admin via `initAuth()`!
12. **Coding Agent Summary:** Check `/users/me` before calling `POST /auth/device` inside `initAuth()` (`P1`).

---

### Issue 5: `FRONTEND-005` — Unawaited Auth Race Before Socket.IO Connection on `/alerts`
1. **Unique Issue ID:** `FRONTEND-005` | **Title:** `alerts/page.tsx` invokes `getSocket()` before `await initAuth()` resolves, preventing private `user:<id>` `GEOFENCE_ALERT` room attachment | **Category:** Real-Time WebSocket & Concurrency | **Severity:** High | **Priority:** **P1** | **Module:** Geofence Alerts Page | **Endpoint:** `WS /socket.io` (`EP-047`), `POST /api/v1/auth/device` (`EP-006`).
2. **Exact Source Code Location:** `apps/web/app/alerts/page.tsx:207-232`.
3. **Issue Description:** Inside `useEffect`, `bootstrap()` awaits `initAuth()` asynchronously, while `const socket = getSocket()` executes synchronously on line 215 immediately after `bootstrap();` is launched. On a fresh load of `/alerts`, `currentSocketToken` is still `null` when `getSocket()` creates the singleton Socket.IO client, so Express logs `[Socket.IO] Guest read-only client connected` without joining `user:${userId}`, silently dropping real-time `GEOFENCE_ALERT` pushes.
4. **Reproduction Instructions:** Visit `/alerts` on a fresh browser context or run `[FRONTEND-005]` in `regression/01`. Expected: `getSocket()` invoked after `await initAuth()`; Actual (`results.json`): `true !== false`.
5. **Expected vs Actual Behavior:** Expected: Wait for `await initAuth()` inside `bootstrap()`, update `socketToken`, then instantiate/bind `getSocket()` (and ensure `lib/socket.ts` reconnects with new token if upgrading from guest to authenticated user).
6. **Root Cause Analysis:** Confirmed async ordering bug in `apps/web/app/alerts/page.tsx:207-232`.
7. **Recommended Fix:** Track mounted/cancelled flag in `useEffect`, move `getSocket()` + `socket.on("GEOFENCE_ALERT", ...)` AFTER `await initAuth()`, clean up in `return () => { cancelled = true; boundSocket?.off(...); }`. Also enhance `setSocketToken()` in `lib/socket.ts` to refresh auth & reconnect if an existing guest socket upgrades to an authenticated token.
8. **Regression Test Requirements:** `[FRONTEND-005]` in `regression/01` + live Socket.IO `GEOFENCE_ALERT` reception test on `/alerts`.
9. **Acceptance Criteria:** `[FRONTEND-005]` passes; Socket.IO handshake on cold `/alerts` connects as `Authenticated client`.
10. **Fix Verification Status:** `FIXED AND VERIFIED` (`app/alerts/page.tsx:207-244`, `lib/socket.ts:13-36`; `[FRONTEND-005]` PASS, `workflows/01` `3/3` PASS, `e2e/01` `3/3` PASS).
11. **Cross-Module / Cross-API Impact:** Same `setSocketToken` upgrade improvement helps `/feed` & `/reports/[id]` transition smoothly when `initAuth()` finishes after socket init. Frontend owns fix.
12. **Coding Agent Summary:** Attach `getSocket()` after `await initAuth()` completes and support token upgrade reconnect in `lib/socket.ts` (`P1`).

---

### Issue 6: `FRONTEND-011` — StrictMode / Concurrent `initAuth()` Fires Duplicate `POST /auth/device` Calls (`201` + `400` Race)
*(Listed right after P1 issues due to P1 severity!)*
1. **Unique Issue ID:** `FRONTEND-011` | **Title:** Missing single-flight lock on `useAuthStore.initAuth()` duplicates `POST /auth/device` on every mount | **Category:** Concurrency & Race Conditions | **Severity:** High | **Priority:** **P1** | **Module:** Auth Store (`initAuth`) | **Endpoint:** `POST /api/v1/auth/device` (`EP-006`).
2. **Exact Source Code Location:** `apps/web/store/useAuthStore.ts:45-88`.
3. **Issue Description:** React 18 StrictMode double-invokes `useEffect` in development, and multiple sibling components mounting concurrently can call `initAuth()` simultaneously. Because `initAuth()` has no shared `inFlightInitPromise` guard (and checks `if (get().user)` only after async work or `isLoading` is unused for gating), TWO parallel `POST /api/v1/auth/device` requests fire on EVERY single route navigation (observed live in Chromium E2E Express logs: `POST /api/v1/auth/device 200` twice back-to-back on every page, and on fresh DB boot `201` followed by `400` in earlier trace logs when two simultaneous inserts raced!).
4. **Reproduction Instructions:** Invoke `await Promise.all([useAuthStore.getState().initAuth(), useAuthStore.getState().initAuth()])` via `[FRONTEND-011]` in `regression/01` OR load `/` in Next.js dev mode and inspect Express request logs. Expected `/auth/device` calls: `1`; Actual (`results.json`): `2 !== 1`.
5. **Expected vs Actual Behavior:** Expected: Concurrent `initAuth()` callers share the exact same in-flight Promise and execute 1 backend bootstrap sequence. Actual: N concurrent callers fire N parallel `POST /auth/device` + `GET /users/me` pairs.
6. **Root Cause Analysis:** Confirmed missing module-scoped promise deduplication (`initAuthPromise`) in `apps/web/store/useAuthStore.ts:45-88`.
7. **Recommended Fix:** Cache the active Promise (`let activeInitPromise: Promise<AuthUser | null> | null = null`) outside Zustand store state, returning it while pending and clearing it in `finally`. Coordinate with `FRONTEND-004` (`GET /users/me` check first).
8. **Regression Test Requirements:** `[FRONTEND-011]` in `regression/01` + check Chromium E2E Express logs for single auth request per cold load.
9. **Acceptance Criteria:** `[FRONTEND-011]` passes (`1 === 1`); zero duplicate `/auth/device` requests on mount.
10. **Fix Verification Status:** `FIXED AND VERIFIED` (`apps/web/store/useAuthStore.ts`; `[FRONTEND-011]` PASS, `e2e/01` verified single auth request per navigation).
11. **Cross-Module / Cross-API Impact:** Halves initial auth database writes & eliminates spurious 400/unique constraint collisions on first visit. Frontend owns fix.
12. **Coding Agent Summary:** Deduplicate `useAuthStore.initAuth()` behind a module-scoped single-flight Promise (`P1`).

---

### Issue 7: `FRONTEND-006` — Fake Web Push Subscription Fallback (`https://push.safetymap.bd/device/...`)
1. **Unique Issue ID:** `FRONTEND-006` | **Title:** `alerts/page.tsx` fabricates dummy push endpoint/keys on `PushManager` unavailability and displays false success | **Category:** Form & Browser API Integrity | **Severity:** Medium | **Priority:** **P2** | **Module:** Alerts Page & Service Worker | **Endpoint:** `POST /api/v1/alerts/subscribe` (`EP-027`).
2. **Exact Source Code Location:** `apps/web/app/alerts/page.tsx:468-516` (`handleSubscribePush`) & `apps/web/public/sw.js:1-68`.
3. **Issue Description:** When `reg.pushManager.getSubscription()` returns `null` (because `pushManager.subscribe({ applicationServerKey })` is never even called!) or throws, `handleSubscribePush` populates `{ endpoint: "https://push.safetymap.bd/device/...", keys: { p256dh: "standard-browser-client", auth: "session-verified-auth" } }`, posts it to `/api/v1/alerts/subscribe`, and shows `"Browser Web Push alert registration successful!"`.
4. **Reproduction Instructions:** Click "Enable Push Alerts" in headless/non-subscribed browser or run `[FRONTEND-006]` in `regression/01`.
5. **Expected vs Actual Behavior:** Expected: Call `reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` using configured VAPID public key, and if unavailable/failed, show an honest error toast without sending fake credentials to PostgreSQL. Actual: Stores unusable synthetic URL in `PushSubscription` table.
6. **Root Cause Analysis:** Confirmed hardcoded synthetic fallback in `apps/web/app/alerts/page.tsx:495-503` + missing `push` handler in `apps/web/public/sw.js`.
7. **Recommended Fix:** Remove synthetic fallback (`https://push.safetymap.bd/...`), implement `pushManager.subscribe` if `NEXT_PUBLIC_VAPID_PUBLIC_KEY` exists else show informative unsupported/unavailable error, and add `self.addEventListener("push", ...)` to `public/sw.js`.
8. **Regression Test Requirements:** `[FRONTEND-006]` in `regression/01`.
9. **Acceptance Criteria:** Synthetic URL removed; failed push registration surfaces honest UI error without calling `POST /api/v1/alerts/subscribe`.
10. **Fix Verification Status:** `FIXED AND VERIFIED` (`app/alerts/page.tsx:457-553`, `public/sw.js:70-124`; `[FRONTEND-006]` PASS, `forms/01` `5/5` PASS, `workflows/01` `3/3` PASS, `e2e/01` `3/3` PASS).
11. **Cross-Module / Cross-API Impact:** Prevents dead/unreachable push subscription rows in backend PostgreSQL (`PushSubscription`).
12. **Coding Agent Summary:** Remove fabricated Web Push fallback in `app/alerts/page.tsx` and wire real VAPID + SW `push` listener (`P2`).

---

### Issue 8: `FRONTEND-007` — `ReportIncidentModal` Whitespace Bypass (`": "`) & Missing `1000`-Char Cap
1. **Unique Issue ID:** `FRONTEND-007` | **Title:** `ReportIncidentModal` submits `": "` on whitespace inputs and exceeds backend `1000`-char description limit | **Category:** Form Validation & Contract Parity | **Severity:** Medium | **Priority:** **P2** | **Module:** Map Quick Report Modal | **Endpoint:** `POST /api/v1/reports` (`EP-013`).
2. **Exact Source Code Location:** `apps/web/components/incidents/ReportIncidentModal.tsx:258-277` (`handleSubmit`).
3. **Issue Description:** Even with HTML `required`, users entering spaces `"   "` bypass native HTML checks; line 265 composes `${title.trim()}${...}: ${description.trim()}` yielding `": "`. Conversely, if `title` + `locationName` + `description` exceed `1000` characters combined, backend Zod rejects with HTTP `400` cleanly avoidable client-side.
4. **Reproduction Instructions:** Run `forms/01` test `"reproduces ReportIncidentModal whitespace formatting..."` and `[FRONTEND-007]` in `regression/01`.
5. **Expected vs Actual Behavior:** Expected: Trim & validate `!title.trim() || !description.trim()` before submitting, and cap `fullDescription.length <= 1000`. Actual: Posts `": "` or oversized strings.
6. **Root Cause Analysis:** Confirmed missing trimmed length validation in `ReportIncidentModal.tsx:258-266`.
7. **Recommended Fix:** Check `if (!title.trim() || !description.trim())` returning clear localized validation error, and enforce `fullDescription.length <= 1000` (with character counter or truncation error).
8. **Regression Test Requirements:** `[FRONTEND-007]` in `regression/01` + `forms/01`.
9. **Acceptance Criteria:** `[FRONTEND-007]` passes; blank/oversized submissions blocked cleanly before HTTP call.
10. **Fix Verification Status:** `FIXED AND VERIFIED` (`apps/web/components/incidents/ReportIncidentModal.tsx`; `[FRONTEND-007]` PASS, `forms/01` PASS).
11. **Cross-Module / Cross-API Impact:** Prevents garbage `": "` incident descriptions appearing on the live public map. Frontend owns fix.
12. **Coding Agent Summary:** Add trimmed non-empty & `<= 1000`-char composed guard in `ReportIncidentModal.tsx` (`P2`).

---

### Issue 9: `FRONTEND-008` — `/safe-zones` Redundant `GET` Re-Fetch Loop & Unvalidated `NaN` Coordinates
1. **Unique Issue ID:** `FRONTEND-008` | **Title:** `safe-zones/page.tsx` re-fetches on `selectedZone` state change (3x observed live) and sends `NaN`/`null` on empty create fields | **Category:** State Sync & Form Validation | **Severity:** Medium | **Priority:** **P2** | **Module:** Safe Zones Directory & Admin Create Modal | **Endpoint:** `GET /api/v1/safe-zones` (`EP-020`), `POST /api/v1/safe-zones` (`EP-021`).
2. **Exact Source Code Location:** `apps/web/app/safe-zones/page.tsx:150-175` (`fetchSafeZones` dependency array) & `:245-260` (`handleCreateZone`).
3. **Issue Description:** Including `selectedZone` in `fetchSafeZones` `useCallback` dependencies causes `setSelectedZone(data[0])` inside `fetchSafeZones` to re-create `fetchSafeZones`, triggering `useEffect([fetchSafeZones])` repeatedly (observed live as `3x GET /api/v1/safe-zones` in Chromium E2E logs). Additionally, `handleCreateZone` calls `parseFloat(lat)`/`parseFloat(lng)` with zero `Number.isFinite`, coordinate-range, or `name.trim().length >= 2` validation, serializing `NaN` to `null` in `JSON.stringify`.
4. **Reproduction Instructions:** Load `/safe-zones` in Chromium E2E (observe 3 `GET /api/v1/safe-zones` calls in Express logs) and run `[FRONTEND-008]` in `regression/01`.
5. **Expected vs Actual Behavior:** Expected: `fetchSafeZones` fetches once per filter change (using ref or functional updater `setSelectedZone(prev => prev || data[0])`); `handleCreateZone` validates `name.trim().length >= 2` and `Number.isFinite(lat/lng)` within Bangladesh bounds before `POST`. Actual: Triple GET + sends `null` coords.
6. **Root Cause Analysis:** Confirmed `selectedZone` dependency cycle in `apps/web/app/safe-zones/page.tsx:167-169` and unvalidated `parseFloat` in `:245-253`.
7. **Recommended Fix:** Replace `!selectedZone` check inside `fetchSafeZones` with functional state updater `setSelectedZone((prev) => prev ?? (data?.[0] || null))` and remove `selectedZone` from `useCallback` deps; add `name.trim().length >= 2` and `Number.isFinite` coordinate validation before `POST /safe-zones`.
8. **Regression Test Requirements:** `[FRONTEND-008]` in `regression/01` + `forms/01` + Chromium E2E network count check.
9. **Acceptance Criteria:** `[FRONTEND-008]` passes; single `GET /api/v1/safe-zones` per filter update.
10. **Fix Verification Status:** `FIXED AND VERIFIED` (`apps/web/app/safe-zones/page.tsx`; `[FRONTEND-008]` PASS, `e2e/01` PASS).
11. **Cross-Module / Cross-API Impact:** Also reduces unnecessary PostGIS `ST_Distance` queries on Render/Postgres. Frontend owns fix.
12. **Coding Agent Summary:** Fix `selectedZone` `useCallback` dep loop and validate `POST /safe-zones` inputs in `app/safe-zones/page.tsx` (`P2`).

---

### Issue 10: `FRONTEND-009` — Silent Admin Dashboard Fetch Failures & Unvalidated Moderation Inputs
1. **Unique Issue ID:** `FRONTEND-009` | **Title:** `admin/page.tsx` hides API load errors (`console.warn` only) and omits `<3`-char reason / UUID pre-flight checks | **Category:** Error Handling & Admin Validation | **Severity:** Medium | **Priority:** **P2** | **Module:** Admin Command Center | **Endpoints:** `EP-032`, `EP-034`, `EP-035`, `EP-036`, `EP-037`, `EP-038`, `EP-039`.
2. **Exact Source Code Location:** `apps/web/app/admin/page.tsx:122-147` (`fetchAdminData`), `:155-194` (`executePurge`/`executeReject`), `:270-290` (`handleUserModeration`).
3. **Issue Description:** When `fetchAdminData` catches `401`/`500`/`502` errors, it only executes `console.warn`—leaving the admin operator staring at blank verification/log tables with no alert or retry indicator. Moreover, purge/reject/ban inputs pass `<3`-char reasons and malformed `banUserId` directly to strict backend Zod validation (`min(3)`, `uuid()`).
4. **Reproduction Instructions:** Run `[FRONTEND-009]` in `regression/01` & `forms/01` moderation boundary test.
5. **Expected vs Actual Behavior:** Expected: Surface API failure via `showToast(..., "error")` / error banner inside `fetchAdminData`, and validate `reason.trim().length >= 3` + UUID regex on `banUserId` before firing moderation `POST`s. Actual: Swallows dashboard error silently and issues avoidable `400` requests.
6. **Root Cause Analysis:** Confirmed missing `showToast`/error banner inside `fetchAdminData` `catch` block (`admin/page.tsx:143`) and missing `.trim().length < 3` / UUID checks.
7. **Recommended Fix:** Add `showToast(err?.message || "Failed to load admin telemetry", "error")` (and error banner state) inside `fetchAdminData` catch, and validate `reason.trim().length >= 3` + UUID format prior to moderation calls.
8. **Regression Test Requirements:** `[FRONTEND-009]` in `regression/01` + `forms/01`.
9. **Acceptance Criteria:** `[FRONTEND-009]` passes; `/admin` errors visibly alert operator and invalid moderation inputs fail fast client-side.
10. **Fix Verification Status:** `FIXED AND VERIFIED` (`apps/web/app/admin/page.tsx`; `[FRONTEND-009]` PASS).
11. **Cross-Module / Cross-API Impact:** Also check `app/reports/[id]/page.tsx` purge handler uses consistent `>= 3`-char prompt validation.
12. **Coding Agent Summary:** Surface `fetchAdminData` failures in UI and add pre-flight `>=3`-char reason & UUID checks in `app/admin/page.tsx` (`P2`).

---

### Issue 11: `FRONTEND-010` — Missing Default `apiFetch` Request Timeout & `/report` Coordinate/Quick-Prompt Edge Bugs
1. **Unique Issue ID:** `FRONTEND-010` | **Title:** `apiFetch` has no default `AbortController` timeout; `/report` snaps empty coordinates to Dhaka Banani and quick prompts bypass `maxLength=500` | **Category:** Network Resilience & Form Input Handling | **Severity:** Medium | **Priority:** **P2** | **Module:** Core API Client & Incident Form | **Endpoints:** All client `apiFetch` calls; `POST /api/v1/reports` (`EP-013`).
2. **Exact Source Code Location:** `apps/web/lib/api.ts:68-80`; `apps/web/app/report/page.tsx:951-959,1149,1161`.
3. **Issue Description:** `apiFetch` passes `options.signal` directly to `fetch` with no default timeout, risking indefinitely hung loading states during Render cold starts or stalled TCP connections. Separately, in `app/report/page.tsx`, clearing manual lat/lng inputs triggers `parseFloat(e.target.value) || 23.7925` (`:1149,1161`) silently snapping the user's cursor back to Banani (`23.7925, 90.4078`), and clicking quick-prompt chips (`:952-954`) mutates `description` state past the textarea's `maxLength={500}`.
4. **Reproduction Instructions:** Run `[FRONTEND-010]` in `regression/01`; clear lat input on `/report` or click multiple quick-prompt buttons until `description.length > 500`.
5. **Expected vs Actual Behavior:** Expected: `apiFetch` creates a default `AbortController` timeout (e.g., `25_000ms`, overridable via `options.timeoutMs` and linked to external `options.signal`); `/report` stores string draft inputs or guards `Number.isFinite` cleanly and caps quick-prompt appends at `500` chars. Actual: Indefinite fetch wait without caller signal; silent Banani snap + >500 prompt overflow.
6. **Root Cause Analysis:** Confirmed absence of timeout controller in `apps/web/lib/api.ts` and direct numeric fallback / uncapped string concatenation in `apps/web/app/report/page.tsx`.
7. **Recommended Fix:** Add `timeoutMs` option defaulting to `25000` (`65000` for cold-start health if needed) using `AbortController` in `lib/api.ts`, and guard `app/report/page.tsx` quick prompts (`slice(0, 500)`) + input string state.
8. **Regression Test Requirements:** `[FRONTEND-010]` in `regression/01` + `api/01` AbortController timeout test.
9. **Acceptance Criteria:** `[FRONTEND-010]` passes; stalled requests abort cleanly with readable error toast instead of hanging spinners.
10. **Fix Verification Status:** `FIXED AND VERIFIED` (`apps/web/lib/api.ts`, `apps/web/app/report/page.tsx`; `[FRONTEND-010]` PASS, `api/01` PASS, `e2e/01` PASS).
11. **Cross-Module / Cross-API Impact:** Improves UX resilience across every interactive page during Render free-tier cold starts. Frontend owns fix.
12. **Coding Agent Summary:** Add default `AbortController` timeout to `lib/api.ts` and fix quick-prompt/coord input guards in `app/report/page.tsx` (`P2`).

---

### Prioritized Coding Agent Execution Queue (Resolved Status)

1. **Critical Production Blockers (P0):** None (`0` crashes or completely broken endpoints; build `exit 0`; core citizen/responder/admin happy paths work live).
2. **High-Priority Auth, Security & Concurrency Issues (P1 — FIXED AND VERIFIED):**
   - `FRONTEND-001` (`lib/api.ts` — single-flight `/auth/refresh` mutex) — **FIXED & VERIFIED**
   - `FRONTEND-011` (`store/useAuthStore.ts` — single-flight `initAuth` deduplication) — **FIXED & VERIFIED**
   - `FRONTEND-004` (`store/useAuthStore.ts` & `app/profile/page.tsx` — check `/users/me` before `POST /auth/device` & clean logout / `resetAnonymousIdentity`) — **FIXED & VERIFIED**
   - `FRONTEND-003` (`store/useAuthStore.ts` — call `POST /auth/logout` on rejected non-admin login) — **FIXED & VERIFIED**
   - `FRONTEND-002` (`lib/api.ts` — skip silent refresh on `/auth/login` & `/auth/logout` 401) — **FIXED & VERIFIED**
   - `FRONTEND-005` (`app/alerts/page.tsx` & `lib/socket.ts` — await `initAuth()` before `getSocket()` + token upgrade reconnect) — **FIXED & VERIFIED**
3. **Medium-Priority Reliability, Validation & Resilience Issues (P2 — FIXED AND VERIFIED):**
   - `FRONTEND-006` (`app/alerts/page.tsx` & `public/sw.js` — remove synthetic push fallback, implement real VAPID/SW `push`) — **FIXED & VERIFIED**
   - `FRONTEND-007` (`components/incidents/ReportIncidentModal.tsx` — trimmed required fields & `<=1000` cap) — **FIXED & VERIFIED**
   - `FRONTEND-008` (`app/safe-zones/page.tsx` — fix `selectedZone` fetch loop & validate coordinates/name) — **FIXED & VERIFIED**
   - `FRONTEND-009` (`app/admin/page.tsx` — UI error alerts + `>=3`-char reason / UUID checks) — **FIXED & VERIFIED**
   - `FRONTEND-010` (`lib/api.ts` & `app/report/page.tsx` — default `AbortController` timeout + `/report` input guards) — **FIXED & VERIFIED**
4. **Low-Priority Polish (FIXED AND VERIFIED):**
   - Normalized trailing slashes and `/api/v1` in `app/health/page.tsx` directly before probing `/health` & `/health/db` (matching `/api/health/route.ts`).

---

## Sections F–I — Security, UI State, Performance & Coverage Gap Summary

- **Section F (Authentication & Security):** `HttpOnly` JWT cookies (`credentials: "include"`), timing-safe SHA-256 `CRON_SECRET` validation on `/api/cron/news-crawl`, strict RBAC UI hiding verified on `/safe-zones`, `/admin`, and `/reports/[id]`, and PII minimization on `/reports/[id]/updates` all passed cleanly. Fix `FRONTEND-001`..`004` to eliminate token rotation race and non-admin cookie lingering.
- **Section G (UI States & UX):** Loading spinners, empty banners, optimistic voting + API rollback, and error states pass across citizen feeds, route planner, profile KYC, and interactive `/report` submission; `/admin` initial load failures and `/alerts` push failures currently misreport state (`FRONTEND-006`, `FRONTEND-009`).
- **Section H (Performance & Environment Matrix):** Tested against Node.js `v20+`, Next.js `14.2.3`, PostgreSQL + PostGIS, Headless Chrome/Edge (`puppeteer-core`). Zero uncaught `pageerror`s and zero HTTP `5xx` responses across all 10 routes in Chromium E2E (`34.75s` standalone E2E / `69.53s` full `--profile=report`), with single-flight `initAuth()` & single-mount `/safe-zones` fetch eliminating duplicate route transition requests.
- **Section I (Coverage Gaps & Exclusions):**
  - `EP-030` (`/media/mock-upload`), `EP-040` (`/admin/news/crawl`), `EP-043`/`EP-045`/`EP-046` (Vercel Cron RSS news crawl) were validated via Zod contract schemas & local HTTP mocks rather than triggering live Google News / Daily Star RSS scraping against production sites.
  - External third-party geocoders Photon (`EXT-001`) and Nominatim (`EXT-002`) were inspected via code review; external third-party uptime was not asserted in CI.

---

## Sections J–K — Reusable Testing Framework & Re-Run Guide

### Framework & Generated Artifact Locations
- **Runner & Utilities (`apps/web/tests/framework/`):** `runner.ts`, `config.ts`, `domEnv.ts`, `fetchMock.ts`, `contractSchemas.ts`, `coverageRegistry.ts`, `liveHarness.ts`, `browserHelper.ts`
- **Fixtures & Docs:** `apps/web/tests/fixtures/mockData.ts`, [`apps/web/tests/README.md`](../../tests/README.md)
- **Test Suites (`apps/web/tests/`):**
  - `unit/01-lib-utilities.test.ts`
  - `api/01-mocked-api-and-resilience.test.ts`, `api/02-stores-and-sockets-mocked.test.ts`, `api/03-next-route-handlers.test.ts`
  - `contracts/01-backend-contract-alignment.test.ts`
  - `authentication/01-auth-session-lifecycle.test.ts`, `authorization/01-rbac-guard-matrix.test.ts`
  - `forms/01-forms-media-geofence-validation.test.ts`, `components/01-ui-rendering-and-props.test.ts`
  - `workflows/01-live-backend-integration.test.ts` *(Live Express + PostGIS + Socket.IO)*
  - `e2e/01-browser-playwright-e2e.test.ts` *(Real Chromium + Next.js Dev + Live API)*
  - `regression/01-confirmed-frontend-defects.test.ts` *(Defect Reproduction Gate)*
- **Machine-Readable Reports (`apps/web/tests/reports/`):** `results.json`, `coverage-summary.json`, `junit.xml`, `report.html`

### Commands to Run Suites

```bash
# TypeScript verification
npm --prefix apps/web run typecheck

# Individual test profiles
npm --prefix apps/web run test:web:unit         # Pure helpers & @repo/shared
npm --prefix apps/web run test:web:mocked       # Unit + mocked API + Zustand + Route Handlers
npm --prefix apps/web run test:web:contracts    # 47-endpoint contract schema parity
npm --prefix apps/web run test:web:auth         # Auth lifecycle + RBAC matrix
npm --prefix apps/web run test:web:forms        # Validation, media & geofence constraints
npm --prefix apps/web run test:web:components   # SSR component rendering snapshots
npm --prefix apps/web run test:web:live         # Live Express + PostgreSQL/PostGIS + Socket.IO
npm --prefix apps/web run test:web:e2e          # Real Chromium + Next.js + Live Backend
npm --prefix apps/web run test:web:regression   # 11 defect regression cases (all 11/11 PASS)

# CI verification profile (all non-browser verification suites + live workflows)
npm --prefix apps/web run test:web:ci

# Full master audit report (runs all 54 tests and regenerates results.json/junit.xml/report.html)
npm --prefix apps/web run test:web:report
```

### Troubleshooting & Environment Requirements
- **Live & E2E Requirements:** Local/Docker PostgreSQL + PostGIS reachable via `apps/api/.env` (`DATABASE_URL`), Node.js `>= 20`, and local Google Chrome or Microsoft Edge for `test:web:e2e` (auto-discovered in `tests/framework/config.ts`, overrideable with `CHROME_PATH`). Offline CI can disable live/browser layers with `RUN_LIVE_BACKEND_TESTS=false` and `RUN_BROWSER_E2E_TESTS=false`.
- **Verification Status:** `npm --prefix apps/web run test:web:regression` passes `11/11` (`0 FAIL`) and `npm --prefix apps/web run test:web:report` passes `54/54` (`0 FAIL`, `0 SKIPPED`) with `0` DB orphans.
