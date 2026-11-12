# DangerZoneBD Backend API Audit & Security Verification Report

**Audit Date**: 2026-11-12  
**Target Scope**: `apps/api` (Express + Prisma + PostgreSQL/PostGIS + Socket.IO) & `apps/web/app/api` proxies  
**Master Specification**: [`dontADDgit/api_test_backend.md`](file:///g:/programming/project-cse-3104/jim-collaborator/dontADDgit/api_test_backend.md)  
**Contract Baseline**: [`apps/api/docs/endpoints.md`](file:///g:/programming/project-cse-3104/jim-collaborator/apps/api/docs/endpoints.md)  
**Synchronized Inventory**: [`apps/api/docs/testing/API_Endpoint_Inventory.md`](file:///g:/programming/project-cse-3104/jim-collaborator/apps/api/docs/testing/API_Endpoint_Inventory.md)  
**Machine-Readable Findings**: [`apps/api/docs/testing/API_Findings.json`](file:///g:/programming/project-cse-3104/jim-collaborator/apps/api/docs/testing/API_Findings.json)

---

## A. Executive Summary & Production-Readiness Verdict

**Verdict: NO-GO FOR PRODUCTION RELEASE** *(Conditional release after resolving High-severity blockers `BACKEND-001`, `BACKEND-002`, `BACKEND-003`, `BACKEND-004`, `BACKEND-011`, and `BACKEND-013`)*

An exhaustive automated audit was executed against all **47 discovered backend interfaces** (**43 Express HTTP routes**, **3 Next.js App Router API proxies**, and **1 Socket.IO real-time gateway**) with **zero modifications to backend application code, database schemas, or `.env` configuration**.

### Headline Execution Summary
- **Canonical Full Run**: `npm --prefix apps/api run test:api:report`
- **Execution Window (UTC)**: `2026-11-12T11:38:24.687Z` → `2026-11-12T11:42:38.458Z` (**253,768.36 ms / ~253.77s**)
- **Total Suites Executed**: **15** test files | **62** test cases | **48 PASSED** | **14 FAILED** | **0 SKIPPED**
- **Verification Suites (`tests/api`, `authentication`, `authorization`, `validation`, `security`, `database`, `workflows`, `performance`)**: **48 / 48 PASS (100%)**
- **Defect Regression Suite (`tests/regression/01-confirmed-defects-regression.test.ts`)**: **14 / 14 FAILED as expected (100% deterministic reproduction of `BACKEND-001` .. `BACKEND-014`)**
- **TypeScript Static Verification**: `npm --prefix apps/api run typecheck` → **exit code 0**
- **Database Cleanup Verification**: `ORPHAN_USERS: 0`, `ORPHAN_REPORTS: 0`, `ORPHAN_SAFE_ZONES: 0`

### Confirmed Defect Distribution
| Severity | Priority | Count | Issue IDs |
| :--- | :---: | :---: | :--- |
| **Critical** | `P0` | **0** | *(No RCE, SQLi, or authentication bypass identified)* |
| **High** | `P1` | **6** | `BACKEND-001`, `BACKEND-002`, `BACKEND-003`, `BACKEND-004`, `BACKEND-011`, `BACKEND-013` |
| **Medium** | `P2` | **5** | `BACKEND-005`, `BACKEND-006`, `BACKEND-007`, `BACKEND-012`, `BACKEND-014` |
| **Low** | `P3` | **3** | `BACKEND-008`, `BACKEND-009`, `BACKEND-010` |
| **Total Confirmed** | — | **14** | All 14 reproduced cleanly in automated regression tests |

---

## B. Scope & Complete Test Execution Matrix

Every test module in [`apps/api/tests/`](file:///g:/programming/project-cse-3104/jim-collaborator/apps/api/tests/README.md) executed against an ephemeral in-process Express + Socket.IO server bound to `127.0.0.1:0` and backed by the active PostgreSQL/PostGIS database with strict ID-tracked cleanup.

| Suite File | Category | Cases | Passed | Failed | Skipped | Duration (s) | Role in Audit |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `api/01-health-system-proxy.test.ts` | System & Proxies | 8 | 8 | 0 | 0 | 1.233 | `EP-001`–`EP-005`, `EP-044`–`EP-046`, HTTP 400/404 sanity |
| `api/02-auth-users.test.ts` | Auth & Users | 5 | 5 | 0 | 0 | 12.259 | `EP-006`–`EP-012` functional lifecycle & `.strict()` |
| `api/03-reports-votes-updates.test.ts` | Reports & Votes | 4 | 4 | 0 | 0 | 21.404 | `EP-013`–`EP-019` GPS drift, bounds, resolve, votes, updates |
| `api/04-safe-zones-routing.test.ts` | Safe Zones & Routing | 2 | 2 | 0 | 0 | 6.257 | `EP-020`–`EP-023` spatial queries, admin CRUD, BD safe-path |
| `api/05-alerts-media.test.ts` | Alerts & Media | 4 | 4 | 0 | 0 | 17.937 | `EP-024`–`EP-031` alert zones, push sub, presigned, confirm, mock, webhook |
| `api/06-admin-stats-cron.test.ts` | Admin, Stats & Cron | 3 | 3 | 0 | 0 | 19.286 | `EP-032`–`EP-043` KYC moderation, ban/unban, purge, logs, trends, stats, cron |
| `api/07-sockets-realtime.test.ts` | Real-Time Sockets | 2 | 2 | 0 | 0 | 9.940 | `EP-047` guest/auth handshakes, live broadcasts & targeted `GEOFENCE_ALERT` |
| `authentication/01-auth-lifecycle.test.ts` | Authentication | 3 | 3 | 0 | 0 | 5.787 | Unauth 401s, expired/wrong-secret/`alg=none`/`socketToken` rejections, cookies, ban lockout |
| `authorization/01-rbac-ownership-matrix.test.ts` | Authorization | 3 | 3 | 0 | 0 | 19.693 | Vertical RBAC (`USER`/`VERIFIED_RESPONDER` vs `ADMIN`) & horizontal BOLA/IDOR |
| `validation/01-schema-strictness-boundaries.test.ts` | Validation | 3 | 3 | 0 | 0 | 14.481 | `.strict()` checks, geofence 25 km² & 5-zone cap, GPS/MIME/5MB limits |
| `security/01-owasp-security-checks.test.ts` | OWASP Security | 4 | 4 | 0 | 0 | 11.881 | SSRF/traversal block, magic-byte polyglot check, login 429, parameterized SQLi/XSS |
| `database/01-integrity-transactions-concurrency.test.ts` | DB & Concurrency | 3 | 3 | 0 | 0 | 17.301 | Concurrent vote uniqueness, 5-downvote atomic purge, atomic token revocation |
| `workflows/01-e2e-state-transitions.test.ts` | E2E Workflows | 2 | 2 | 0 | 0 | 13.336 | Onboarding → KYC → role upgrade → cooldown waiver → resolve; hazard detour → resolve |
| `performance/01-fuzzing-and-load-baseline.test.ts` | Fuzz & Performance | 2 | 2 | 0 | 0 | 29.472 | 30 deterministic fuzz mutations (zero 500s) + concurrency P50/P90/P95/P99 & RPS |
| `regression/01-confirmed-defects-regression.test.ts` | Defect Regression | 14 | 0 | **14** | 0 | 22.838 | Fixed-behavior assertions reproducing `BACKEND-001`..`BACKEND-014` |

*(Per-test JUnit XML record stored at [`apps/api/tests/reports/junit.xml`](file:///g:/programming/project-cse-3104/jim-collaborator/apps/api/tests/reports/junit.xml).)*

---

## C. Environment Safety & Test Data Isolation Verification

- **Server Isolation**: Tests import `{ app }` from [`apps/api/src/app.ts`](file:///g:/programming/project-cse-3104/jim-collaborator/apps/api/src/app.ts) via [`apps/api/tests/framework/server.ts`](file:///g:/programming/project-cse-3104/jim-collaborator/apps/api/tests/framework/server.ts), binding dynamically on `127.0.0.1:0` and cleanly shutting down Socket.IO and HTTP connections via `io.close()` + `closeAllConnections()`.
- **Pre-Existing Data Preservation**: No destructive `TRUNCATE` or blanket `DELETE` statements are used. All created `User`, `Report`, `UserAlertZone`, `SafeZone`, `UserVerification`, `ModerationLog`, `ReportMedia`, and `NewsArticle` records are registered in `TestDataTracker` (`apps/api/tests/framework/dbTracker.ts`) and removed in FK-safe order inside `after()` hooks even on test failure.
- **Secret Handling**: Zero `.env` secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, `CRON_SECRET`, `STORAGE_WEBHOOK_SECRET`) are printed or committed; synthetic per-test values are injected temporarily inside `try/finally` blocks when testing `CRON_SECRET` / `STORAGE_WEBHOOK_SECRET` fail-closed/positive paths.
- **Post-Run Orphan Query Result**:
  ```json
  { "ORPHAN_USERS": 0, "ORPHAN_REPORTS": 0, "ORPHAN_SAFE_ZONES": 0 }
  ```

---

## D. Endpoint Discovery & Coverage Summary

- **Discovery Cross-Check**: `endpoints.md` lists **43 Express endpoints + 3 Next.js App Router proxies + 1 Socket.IO gateway = 47 interfaces**. Repository inspection found **0 undocumented routes**, **0 documented-but-missing routes**, **0 dead/commented handlers**, and **1 duplicate route pair** (`EP-012` `POST /api/v1/users/verify/:id/approve` vs `EP-033` `POST /api/v1/admin/verifications/:id/approve`).
- **Execution Coverage**: **47 / 47 (100%)** executed across functional, auth, authorization, validation, security, concurrency, workflow, and regression suites:
  - **25** interfaces verified **`EXECUTED — PASS`** (zero open confirmed defects on their contract assertions).
  - **22** interfaces flagged **`EXECUTED — DEFECT CONFIRMED`** across findings `BACKEND-001` .. `BACKEND-014`.
- Full 24-attribute contract cards and traceability rows live in [`apps/api/docs/testing/API_Endpoint_Inventory.md`](file:///g:/programming/project-cse-3104/jim-collaborator/apps/api/docs/testing/API_Endpoint_Inventory.md).

---

## E. Authentication, Authorization & Session Security Assessment

### Controls Verified Working (`PASS`)
- Protected routes reject missing, malformed, expired, wrong-secret, `alg=none`, and `socketToken`-scoped tokens with `401`.
- Auth cookies are issued with `HttpOnly` and `SameSite=Lax` flags (`authentication/01-auth-lifecycle.test.ts`).
- `POST /api/v1/admin/users/:id/ban` atomically sets `isBanned = true` and revokes **all** active `RefreshToken` rows in PostgreSQL, blocking subsequent REST calls (`403`), `/auth/refresh` (`401`), and Socket.IO handshakes (`connect_error`) immediately.
- Vertical RBAC cleanly blocks `USER` and `VERIFIED_RESPONDER` from every `/api/v1/admin/*` route, `POST/DELETE /api/v1/safe-zones`, and `POST /api/v1/users/verify/:id/approve` with `403`.
- Horizontal BOLA/IDOR checks block cross-user report resolution, cross-user alert-zone deletion, and cross-user media presign/confirm/mock-upload (`403`).
- `POST /api/v1/cron/news-crawl`, `GET /api/v1/cron/news-crawl`, `POST /api/v1/media/webhook`, and Next.js `/api/cron/news-crawl` enforce **fail-closed `401`** when shared secrets are unset or mismatched.

### Confirmed Security Gaps
- **`BACKEND-001` (`High`)**: Pre-auth cron rate limiter allows unauthenticated DoS against `CRON_SECRET` endpoints; `rateLimiter.ts` trusts spoofable `X-Forwarded-For` headers and leaks an un-`.unref()`'d interval timer; mutating endpoints (`/auth/device`, `/auth/refresh`, `/reports/:id/vote`, `/reports/:id/updates`, `/users/verify`, `/routes/safe-path`) lack rate limiters.
- **`BACKEND-002` (`High`)**: `/auth/login` echoes `accessToken` + `refreshToken` in JSON body alongside `HttpOnly` cookies; `/auth/refresh` does not rotate/invalidate consumed refresh tokens; `/auth/logout` rejects expired access tokens via `requireAuth` (`401`) instead of revoking the presented refresh cookie.
- **`BACKEND-003` (`High`)**: `env.ts:12-13` carries hardcoded JWT secret defaults and runtime `.env` configures short keys (< 32 chars).
- **`BACKEND-011` (`High`)**: `POST /api/v1/reports` and `POST /api/v1/reports/:id/vote` leak reporter `userId` UUID PII in JSON responses.
- **`BACKEND-013` (`High`)**: `POST /api/v1/admin/users/:id/ban` lacks peer-`ADMIN` and self-ban protection guards.

---

## F. Input Validation, Media & PostGIS Boundary Assessment

### Controls Verified Working (`PASS`)
- `.strict()` rejects mass-assignment/unexpected keys cleanly across `/auth/device`, `/safe-zones`, `/routes/safe-path`, `/alerts/zones`, `/alerts/subscribe`, `/admin/*`, and `/media/*`.
- Media security controls pass: `multipart/form-data` returns `415`, magic-byte validation (`FFD8FF`, `89504E470D0A1A0A`, `RIFF....WEBP`) blocks HTML/polyglots on `/media/mock-upload`, and SSRF/path-traversal URL checks (`169.254.169.254`, untrusted hosts, `..`) block `/media/confirm` with `400`.
- Alert zone 5-zone cap, unclosed-ring check, and PostGIS `ST_Area <= 25 km²` limits enforce `400`.

### Confirmed Validation & Boundary Defects
- **`BACKEND-004` (`High`)**: `POST /api/v1/reports` accepts `description: ""` and unbounded oversized strings (`1500+` chars).
- **`BACKEND-005` (`Medium`)**: `POST /api/v1/reports/:id/updates` validates length before trimming, saving `"   "` as empty string `content: ""` (`201`).
- **`BACKEND-006` (`Medium`)**: `GET /api/v1/safe-zones?lat=abc&lng=def` returns `200 []` instead of `400`.
- **`BACKEND-012` (`Medium`)**: `GET /api/v1/reports` accepts inverted bounding boxes (`minLng > maxLng`) with `200`.
- **`BACKEND-014` (`Medium`)**: `POST /api/v1/alerts/zones` omits PostGIS `ST_IsValid`, persisting self-intersecting bowtie polygons.
- **`BACKEND-007` (`Medium`)**, **`BACKEND-008` (`Low`)**, **`BACKEND-009` (`Low`)**: Missing-UUID `400` instead of `404` on 3 routes; unconditional `201` on existing `/auth/device` sign-in; type/envelope drift (`distanceMeters` serialized as string, silent `limit` clamping, raw `{ received: true }` & root/health envelopes).

---

## G. Database Integrity, Transactions & Concurrency

- Concurrent identical vote requests (`Promise.all`) against `POST /api/v1/reports/:id/vote` were verified atomic under the PostgreSQL unique `(userId, reportId)` constraint — no double-counting occurred.
- Trust Engine auto-purge threshold was verified end-to-end: 5 distinct citizen downvotes atomically transition `Report.status` to `PURGED` (causing `GET /reports/:id` to return `404`), write a `Report` update, and decrement the author's `trustScore` (`voteService.ts:79-82`).
- Ban revocation transaction atomically invalidates all `RefreshToken` rows for the banned user (`database/01-integrity-transactions-concurrency.test.ts`).
- Remaining audit-integrity defect: **`BACKEND-010` (`Low`)** — `rejectVerification` logs `ModerationLog.action = 'VERIFY_USER'` identically to approval.

---

## H. Multi-Step Business Workflows & Socket.IO Gateway

- **Workflow 1 (`PASS`)**: Device onboarding → `POST /users/verify` → Admin approval (`POST /admin/verifications/:id/approve`) → role upgrade `USER` → `VERIFIED_RESPONDER` → 15-minute cooldown exemption verified on consecutive `POST /reports` calls → third-party `PATCH /reports/:id/resolve` (`200`).
- **Workflow 2 (`PASS`)**: `HIGH` hazard report creation → `POST /routes/safe-path` computes hazard detour (`HIGH_SAFETY`, bypassed hazard count ≥ 1) → `PATCH /reports/:id/resolve` → re-running `safe-path` drops the resolved hazard (`CLEAR`).
- **Socket.IO (`PASS`)**: Verified guest `live_reports` room isolation, `socketToken` handshake validation, rejection of tampered/non-string/banned tokens, real-time sanitized `NEW_REPORT`, `REPORT_VOTED`, `NEW_REPORT_UPDATE`, `REPORT_RESOLVED`, `REPORT_PURGED` broadcasts, and private `user:<id>` delivery of `GEOFENCE_ALERT`.

---

## I. Deterministic Fuzzing & Bounded Concurrency Performance Baseline

1. **Deterministic Fuzzing (`performance/01-fuzzing-and-load-baseline.test.ts`)**:
   - **30** seeded mutating probes across query bounds, safe-zones, safe-path, auth, reports, updates, and alert zones produced **zero unhandled `500` crashes** and **zero stack-trace or secret leaks**.
2. **Bounded Concurrency Benchmark (`concurrency: 8`, `requests: 40` per endpoint)** from [`apps/api/tests/reports/perf-metrics.json`](file:///g:/programming/project-cse-3104/jim-collaborator/apps/api/tests/reports/perf-metrics.json):

| Endpoint | Requests (OK / Err) | Min (ms) | P50 (ms) | P90 (ms) | P95 (ms) | P99 (ms) | Max (ms) | RPS |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `GET /health` | 40 / 0 | 6.06 | 9.83 | 14.1 | 14.81 | 16.6 | 16.6 | 724.33 |
| `GET /api/v1/stats` | 40 / 0 | 554.49 | 573.34 | 884.51 | 889.35 | 923.35 | 923.35 | 12.4 |
| `GET /api/v1/reports (Dhaka bounds)` | 40 / 0 | 463.05 | 476.02 | 507.89 | 512.98 | 639.34 | 639.34 | 15.97 |
| `GET /api/v1/safe-zones (Dhaka bounds)` | 40 / 0 | 293.77 | 313.01 | 322.67 | 325.81 | 329.89 | 329.89 | 25.56 |
| `POST /api/v1/routes/safe-path` | 40 / 0 | 390.29 | 407.68 | 419.38 | 421.39 | 426.6 | 426.6 | 19.62 |

**Observations**: Zero request errors occurred under 8-way concurrency (`0 / 200` failures). Latency on DB/PostGIS endpoints (`~313ms`–`573ms` P50) reflects round-trip distance to the remote hosted PostgreSQL/Supabase instance rather than in-process CPU saturation (`GET /health` sustains `724.33 rps` at `9.83ms` P50).

---

## J. Reusable Testing Framework, Commands & CI Integration

### Key Deliverables & Paths
- Framework Core: `apps/api/tests/framework/{config.ts,server.ts,dbTracker.ts,apiClient.ts,authHelpers.ts,assertions.ts,fixtures.ts,runner.ts}`
- Generated Reports: `apps/api/tests/reports/{results.json,junit.xml,perf-metrics.json,coverage-summary.json,report.html}`
- Suite Scripts in [`apps/api/package.json`](file:///g:/programming/project-cse-3104/jim-collaborator/apps/api/package.json):
  - `npm --prefix apps/api run test:api` — Execute verification suite (48 cases across 14 modules)
  - `npm --prefix apps/api run test:api:functional` / `:auth` / `:authorization` / `:validation` / `:security` / `:database` / `:workflows` / `:performance` — Individual category execution
  - `npm --prefix apps/api run test:api:regression` — Execute the 14 defect reproducers (`BACKEND-001`..`BACKEND-014`)
  - `npm --prefix apps/api run test:api:report` — Full run (62 cases) writing `results.json`, `junit.xml`, `coverage-summary.json`, `perf-metrics.json`, `report.html`
  - `npm --prefix apps/api run test:api:ci` — Deterministic CI gate
- CI Workflow: [`.github/workflows/api-tests.yml`](file:///g:/programming/project-cse-3104/jim-collaborator/.github/workflows/api-tests.yml)
- Usage & Troubleshooting: [`apps/api/tests/README.md`](file:///g:/programming/project-cse-3104/jim-collaborator/apps/api/tests/README.md)

---

## K. Actionable Bug Reporting & Coding Agent Fix Handoff

Every confirmed defect below includes all 11 per-issue handoff sections mandated by `dontADDgit/api_test_backend.md`, followed by Section 12 (**Final Coding Agent Handoff Summary**).

---

### Finding `BACKEND-001` — Spoofable IP Rate Limiter, Pre-Auth Cron DoS Ordering, Un-`.unref()`'d Interval, and Missing Route Limiters

1. **Unique Issue Identification**: `BACKEND-001` | Category: Security / Rate Limiting & Availability | Severity: **High** | Priority: **P1** | Module: `rateLimiter.ts`, `cron.ts`, `auth.ts`, `reports.ts`, `users.ts`, `routing.ts` | Affected Endpoints: `GET /api/v1/cron/news-crawl` (`EP-042`), `POST /api/v1/cron/news-crawl` (`EP-043`), `POST /api/v1/auth/login` (`EP-007`), plus unprotected mutating routes (`EP-006`, `EP-008`, `EP-011`, `EP-017`, `EP-018`, `EP-023`)
2. **Exact Source Code Location**:
   - `apps/api/src/middleware/rateLimiter.ts` (`lines 10-18`: `setInterval` cleanup timer without `.unref()`; `lines 34-37`: `clientIp` reads `(req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()`)
   - `apps/api/src/routes/cron.ts` (`lines 35-37`: mounts `cronNewsCrawlRateLimiter` **before** `verifyCronSecret`)
   - `apps/api/src/routes/auth.ts` (`lines 24, 26`), `apps/api/src/routes/reports.ts`, `apps/api/src/routes/users.ts`, `apps/api/src/routes/routing.ts`
3. **Issue Description**:
   - **Pre-auth rate limiting**: Unauthenticated attackers can exhaust the 2 requests / 10 minutes IP quota on `/api/v1/cron/news-crawl` before secret verification runs, denying service to legitimate cron triggers sharing an egress/proxy IP.
   - **Header spoofing**: Directly trusting raw `X-Forwarded-For` allows brute-forcers targeting `POST /api/v1/auth/login` or `POST /api/v1/reports` to rotate spoofed `X-Forwarded-For` values on every request and bypass per-IP rate limits completely.
   - **Event loop leak**: The cleanup `setInterval` omits `.unref()`, keeping test/CLI Node processes alive unless forced to exit.
   - **Unprotected mutators**: `/auth/device`, `/auth/refresh`, `/reports/:id/vote`, `/reports/:id/updates`, `/users/verify`, and `/routes/safe-path` have no route rate limiting.
4. **Reproduction Instructions**:
   - **Preconditions**: Test server running; `process.env.CRON_SECRET` set to a valid 32-char test secret (`try/finally`).
   - **Request**: Send 3 unauthenticated `GET /api/v1/cron/news-crawl` requests with `x-forwarded-for: 198.51.100.201` (no `x-cron-secret`), then send a 4th `GET /api/v1/cron/news-crawl` with the same `x-forwarded-for` and valid `x-cron-secret`.
   - **Expected vs Actual Result**: Expected HTTP `200` on the authenticated 4th request; Actual HTTP `429 RATE_LIMIT_EXCEEDED` (`429 !== 200`).
5. **Expected vs Actual Behavior**:
   - **Expected**: Authentication runs first (`401`) without draining the authenticated scheduler's quota; rate limit keys derive from validated peer IP (`req.ip` with explicit Express `trust proxy`), cleanup timers call `.unref()`, and mutating/expensive routes apply rate limits.
   - **Actual**: Pre-auth IP bucket hits `429` after unauthenticated traffic; `X-Forwarded-For` overrides IP key unconditionally.
6. **Root Cause Analysis**: Middleware ordering in `cron.ts:36-37` places `cronNewsCrawlRateLimiter` ahead of `verifyCronSecret`, and `rateLimiter.ts:34-37` reads the raw request header directly instead of relying on Express proxy trust semantics.
7. **Recommended Fix**:
   - Swap middleware order in `apps/api/src/routes/cron.ts:36-37` to `(verifyCronSecret, cronNewsCrawlRateLimiter, handleNewsCrawl)`.
   - Configure Express `trust proxy` explicitly for deployment hops and derive `clientIp` from `req.ip || req.socket.remoteAddress || 'unknown'`.
   - Call `.unref()` on cleanup timer in `rateLimiter.ts:10-18`.
   - Attach calibrated rate limiters to `/auth/device`, `/auth/refresh`, `/reports/:id/vote`, `/reports/:id/updates`, `/users/verify`, and `/routes/safe-path`.
8. **Regression Test Requirements**:
   - File: `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
   - Case: `[BACKEND-001] Unauthenticated calls to /api/v1/cron/news-crawl must NOT exhaust authenticated cron rate-limit quota on same IP`
   - Also rerun: `security/01-owasp-security-checks.test.ts` (login 429 check).
9. **Acceptance Criteria**: Unauthenticated `/cron/news-crawl` probes always return `401` and never cause a subsequent valid cron invocation to fail with `429`; spoofed headers do not reset login rate limits.
10. **Fix Verification Status**: **CONFIRMED** (`429 !== 200` reproduced).
11. **Cross-Module / Cross-API Impact**: Spans shared `rateLimiter.ts` across auth, reports, cron, users, alerts, and routing. Owned solely by the Express API layer.

---

### Finding `BACKEND-002` — Token Exposure in `/auth/login` JSON, Non-Rotating Refresh Tokens, and Broken Expired-Access `/auth/logout`

1. **Unique Issue Identification**: `BACKEND-002` | Category: Authentication & Session Lifecycle | Severity: **High** | Priority: **P1** | Module: Auth Controller, Service & Routes | Affected Endpoints: `POST /api/v1/auth/login` (`EP-007`), `POST /api/v1/auth/refresh` (`EP-008`), `POST /api/v1/auth/logout` (`EP-009`)
2. **Exact Source Code Location**:
   - `apps/api/src/controllers/authController.ts:45-60` (`loginHandler` returns `accessToken` and `refreshToken` in JSON)
   - `apps/api/src/services/authService.ts:83-98` (`refreshSession` validates refresh token without revoking/rotating it)
   - `apps/api/src/routes/auth.ts:27` (`router.post('/logout', requireAuth, ...)` prevents logout when `accessToken` is expired)
3. **Issue Description**:
   - Returning `refreshToken` in response JSON alongside `HttpOnly` cookies weakens XSS isolation.
   - `POST /api/v1/auth/refresh` keeps the same `RefreshToken` row active (`isRevoked = false`) across unlimited reuse calls, preventing stolen-token detection.
   - Because `/auth/logout` uses `requireAuth`, a user whose 15-minute `accessToken` has expired cannot log out or revoke their 7-day `refreshToken` cookie server-side without refreshing first.
4. **Reproduction Instructions**:
   - Log in as a password-backed `ADMIN` via `POST /api/v1/auth/login` (`email`, `password`). Inspect `res.body.data` (exposes `refreshToken`).
   - Call `POST /api/v1/auth/refresh` once with `Cookie: refreshToken=<T>`. Then replay the exact same `Cookie: refreshToken=<T>` on a second `POST /api/v1/auth/refresh`.
   - Call `POST /api/v1/auth/logout` with an expired `accessToken` and valid `refreshToken`.
   - **Expected vs Actual Result**: Expected refresh replay `401` and expired-access logout `200`; Actual replay returned `200 !== 401` and expired-access logout fails `401`.
5. **Expected vs Actual Behavior**:
   - **Expected**: Single-use refresh token rotation revoking old token on refresh; `refreshToken` stored strictly in `HttpOnly` cookie; `/logout` always clears cookies and revokes any presented `refreshToken`.
   - **Actual**: Static reusable refresh tokens exposed in login JSON; expired `accessToken` blocks logout revocation.
6. **Root Cause Analysis**: Token serialization in `authController.ts:45-60`, missing transactional rotation in `authService.ts:83-98`, and `requireAuth` placement on `routes/auth.ts:27`.
7. **Recommended Fix**:
   - Omit raw `refreshToken` (and `accessToken` if frontend relies purely on `HttpOnly` cookies — verify Next.js frontend auth client usage before removing JSON `accessToken`!) from `/auth/login` JSON response.
   - Implement transactional single-use refresh token rotation (`isRevoked = true` on consumed token + issue new `RefreshToken` cookie; revoke token family on reuse).
   - Allow `/auth/logout` to verify/decode `req.cookies.refreshToken` directly (clearing both auth cookies idempotently) without requiring an unexpired `accessToken`.
8. **Regression Test Requirements**:
   - File: `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
   - Case: `[BACKEND-002] /auth/login should not leak refreshToken in JSON, /auth/refresh must rotate refreshToken, and /auth/logout must work with expired accessToken`
   - Also rerun: `api/02-auth-users.test.ts`, `authentication/01-auth-lifecycle.test.ts`, `database/01-integrity-transactions-concurrency.test.ts`.
9. **Acceptance Criteria**: `refreshToken` omitted from `/auth/login` JSON; replayed `refreshToken` returns `401`; `/auth/logout` with expired `accessToken` returns `200`, revokes DB row, and clears cookies.
10. **Fix Verification Status**: **CONFIRMED** (`200 !== 401` on refresh replay reproduced).
11. **Cross-Module / Cross-API Impact**: Verify frontend auth/session client (`apps/web`) does not rely on `res.body.data.refreshToken` in browser storage before removing it from JSON.

---

### Finding `BACKEND-003` — Hardcoded Fallback JWT Secrets & Sub-32-Char Secrets in Runtime `.env`

1. **Unique Issue Identification**: `BACKEND-003` | Category: Configuration & Cryptographic Security | Severity: **High** | Priority: **P1** | Module: Config (`env.ts` & `.env`) | Affected Endpoints: `POST /api/v1/auth/device` (`EP-006`), `POST /api/v1/auth/login` (`EP-007`), `POST /api/v1/auth/refresh` (`EP-008`), `WS /socket.io` (`EP-047`)
2. **Exact Source Code Location**:
   - `apps/api/src/config/env.ts:12` (`JWT_SECRET` hardcoded fallback string `'super-secret-access-key-replace-in-prod'`)
   - `apps/api/src/config/env.ts:13` (`JWT_REFRESH_SECRET` hardcoded fallback string `'super-secret-refresh-key-replace-in-prod'`)
   - `apps/api/.env` (`JWT_SECRET` length `20`, `JWT_REFRESH_SECRET` length `24` — values redacted)
3. **Issue Description**: Missing environment secrets silently fall back to public source-code constants, allowing attackers to forge valid `ADMIN` JWTs if misconfigured, while active `.env` signing keys fall below the 32-character / 256-bit HS256 minimum recommendation.
4. **Reproduction Instructions**:
   - Parse `apps/api/.env` via `dotenv` and assert length `>= 32`; inspect `apps/api/src/config/env.ts:12-13`.
   - **Expected vs Actual Result**: Expected length `>= 32` with no fallback literals; Actual `JWT_SECRET` length `20` and `JWT_REFRESH_SECRET` length `24`.
5. **Expected vs Actual Behavior**: Fail-closed startup validation requiring `>= 32` char cryptographically random secrets with zero fallback strings.
6. **Root Cause Analysis**: Default `|| 'super-secret-...'` expressions in `env.ts:12-13` instead of strict startup schema validation.
7. **Recommended Fix**: Validate `JWT_SECRET` and `JWT_REFRESH_SECRET` at startup with `z.string().min(32)` and no hardcoded fallback; rotate `.env` keys to `>= 32` random characters.
8. **Regression Test Requirements**:
   - File: `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
   - Case: `[BACKEND-003] JWT_SECRET and JWT_REFRESH_SECRET in .env must be >= 32 characters without hardcoded fallbacks`
9. **Acceptance Criteria**: Both secrets in `.env` are `>= 32` chars; removing them causes immediate startup failure rather than silent fallback.
10. **Fix Verification Status**: **CONFIRMED** (`JWT_SECRET length is 20; minimum 32 chars required`).
11. **Cross-Module / Cross-API Impact**: Impacts all JWT issuance/verification (`utils/jwt.ts`, `requireAuth.ts`, `socketManager.ts`); rotating secrets invalidates existing issued JWTs.

---

### Finding `BACKEND-004` — `POST /api/v1/reports` Accepts Empty `""` and Unbounded `description` Payloads

1. **Unique Issue Identification**: `BACKEND-004` | Category: Input Validation & Resource Exhaustion | Severity: **High** | Priority: **P1** | Module: Reports Validation | Affected Endpoint: `POST /api/v1/reports` (`EP-013`)
2. **Exact Source Code Location**:
   - `apps/api/src/routes/reports.ts:34` (`description: z.string().optional()`)
   - `apps/api/src/services/reportService.ts:142`
3. **Issue Description**: `description` omits `.trim()`, `.min(1)`, and `.max(1000)`, enabling blank empty descriptions and multi-megabyte payload storage/Socket.IO broadcasts when provided.
4. **Reproduction Instructions**:
   - Authenticate as active user (`VERIFIED_RESPONDER` or `USER`) and send `POST /api/v1/reports` with `{ category: "THEFT", severity: "LOW", latitude: 23.75, longitude: 90.38, description: "" }` (or `'A'.repeat(1500)`).
   - **Expected vs Actual Result**: Expected `400 Bad Request`; Actual `201 Created` (`201 !== 400`).
5. **Expected vs Actual Behavior**: When `description` is supplied (not `undefined`), trimmed length must be `1..1000`; otherwise `400`.
6. **Root Cause Analysis**: Unconstrained `z.string().optional()` schema at `reports.ts:34`.
7. **Recommended Fix**: Update `reports.ts:34` to `description: z.string().trim().min(1).max(1000).optional()`. *(Verify whether frontend ever intentionally submits `description: ""` — if so, convert empty strings to `undefined` on frontend or allow explicit `undefined` omission.)*
8. **Regression Test Requirements**:
   - File: `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
   - Case: `[BACKEND-004] POST /api/v1/reports must reject empty string "" and >1000-char description with 400`
9. **Acceptance Criteria**: `""` and `1500`-char strings return `400`; omitted `description` continues returning `201`.
10. **Fix Verification Status**: **CONFIRMED** (`201 !== 400` reproduced).
11. **Cross-Module / Cross-API Impact**: `NEW_REPORT` Socket.IO event payload size, geofence alert email/push previews, and Postgres row storage.

---

### Finding `BACKEND-005` — `POST /api/v1/reports/:id/updates` Persists Whitespace-Only Content as Empty String

1. **Unique Issue Identification**: `BACKEND-005` | Category: Input Validation | Severity: **Medium** | Priority: **P2** | Module: Report Updates Validation | Affected Endpoint: `POST /api/v1/reports/:id/updates` (`EP-018`)
2. **Exact Source Code Location**:
   - `apps/api/src/routes/reports.ts:82` (`content: z.string().min(2).max(500)`)
   - `apps/api/src/services/reportUpdateService.ts:37` (trims `content` after Zod already passed)
3. **Issue Description**: `"   "` passes `min(2)` prior to trimming and gets persisted + broadcast via Socket.IO as `content: ""`.
4. **Reproduction Instructions**: Send `POST /api/v1/reports/<VALID_REPORT_UUID>/updates` with `{ "content": "   " }`. Expected `400`; Actual `201 Created` (`201 !== 400`).
5. **Expected vs Actual Behavior**: Whitespace-only strings must fail Zod validation with `400 Bad Request`.
6. **Root Cause Analysis**: Missing `.trim()` on `addUpdateSchema.body.content` in `reports.ts:82`.
7. **Recommended Fix**: Change `reports.ts:82` to `content: z.string().trim().min(2).max(500)`.
8. **Regression Test Requirements**:
   - File: `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
   - Case: `[BACKEND-005] POST /api/v1/reports/:id/updates must reject whitespace-only content with 400`
9. **Acceptance Criteria**: `{ content: "   " }` returns `400` with zero rows inserted.
10. **Fix Verification Status**: **CONFIRMED** (`201 !== 400` reproduced).
11. **Cross-Module / Cross-API Impact**: Prevents blank `NEW_REPORT_UPDATE` broadcasts on Socket.IO.

---

### Finding `BACKEND-006` — `GET /api/v1/safe-zones` Silently Coerces Non-Numeric Spatial Params to `200 []`

1. **Unique Issue Identification**: `BACKEND-006` | Category: Input Validation | Severity: **Medium** | Priority: **P2** | Module: Safe Zones Validation | Affected Endpoint: `GET /api/v1/safe-zones` (`EP-020`)
2. **Exact Source Code Location**:
   - `apps/api/src/routes/safeZones.ts:17-23` (`safeZoneQuerySchema`)
   - `apps/api/src/controllers/safeZoneController.ts:8-48` (`getSafeZonesHandler`)
3. **Issue Description**: Passing `?lat=abc&lng=def` bypasses validation and triggers downstream `NaN` comparisons returning `200 []` instead of `400`.
4. **Reproduction Instructions**: Send unauthenticated `GET /api/v1/safe-zones?lat=abc&lng=def`. Expected `400`; Actual `200 OK` (`200 !== 400`).
5. **Expected vs Actual Behavior**: Non-numeric or out-of-range coordinates (`lat` outside `-90..90`, `lng` outside `-180..180`, negative/NaN `radius`) must fail `400`.
6. **Root Cause Analysis**: Unvalidated optional strings in `safeZoneQuerySchema` (`safeZones.ts:17-23`).
7. **Recommended Fix**: Validate numeric parsing + geographic bounds cleanly in `safeZoneQuerySchema`.
8. **Regression Test Requirements**:
   - File: `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
   - Case: `[BACKEND-006] GET /api/v1/safe-zones must return 400 for non-numeric spatial parameters (?lat=abc&lng=def)`
9. **Acceptance Criteria**: Invalid spatial query strings return `400` without executing PostGIS queries.
10. **Fix Verification Status**: **CONFIRMED** (`200 !== 400` reproduced).
11. **Cross-Module / Cross-API Impact**: Safe-zone map queries only (`apps/api/src/routes/safeZones.ts`).

---

### Finding `BACKEND-007` — Missing Resource UUIDs Return `400` Instead of `404` Across Three Endpoints

1. **Unique Issue Identification**: `BACKEND-007` | Category: HTTP & REST Error Semantics | Severity: **Medium** | Priority: **P2** | Module: Vote, Alert Zone & User Verification Handlers | Affected Endpoints: `POST /api/v1/reports/:id/vote` (`EP-017`), `DELETE /api/v1/alerts/zones/:id` (`EP-026`), `POST /api/v1/users/verify/:id/approve` (`EP-012`)
2. **Exact Source Code Location**:
   - `apps/api/src/services/voteService.ts:18-26` + `apps/api/src/controllers/voteController.ts:15`
   - `apps/api/src/services/alertZoneService.ts:139-141` + `apps/api/src/controllers/alertController.ts:41`
   - `apps/api/src/controllers/userController.ts:36-38` (`res.status(400)` hardcoded)
3. **Issue Description**: Valid UUIDs pointing to non-existent records return `400 Bad Request` rather than `404 Not Found` because services omit `.statusCode = 404` or controllers overwrite `error.statusCode`.
4. **Reproduction Instructions**: Authenticated `POST /api/v1/reports/00000000-0000-4000-8000-000000000000/vote` `{ voteType: 1 }` (and same UUID on `DELETE /api/v1/alerts/zones/:id` and Admin `POST /api/v1/users/verify/:id/approve`). Expected `404`; Actual `400` (`400 !== 404`).
5. **Expected vs Actual Behavior**: Non-existent UUID resources must return `404 Not Found`; invalid UUID syntax still returns `400`.
6. **Root Cause Analysis**: Missing `statusCode = 404` error metadata in service throws and hardcoded `400` in `userController.ts:36-38`.
7. **Recommended Fix**: Attach `statusCode = 404` on not-found `Error` objects in `voteService.ts` and `alertZoneService.ts`, and honor `error.statusCode || 400` in `voteController.ts`, `alertController.ts`, and `userController.ts`.
8. **Regression Test Requirements**:
   - File: `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
   - Case: `[BACKEND-007] Missing resource IDs on /reports/:id/vote, /alerts/zones/:id, and /users/verify/:id/approve must return 404 (not 400)`
9. **Acceptance Criteria**: All three endpoints return `404` for non-existent UUIDs while keeping existing validation/conflict responses intact.
10. **Fix Verification Status**: **CONFIRMED** (`400 !== 404` reproduced).
11. **Cross-Module / Cross-API Impact**: Ensure frontend callers checking `!res.ok` or `status === 404` handle `404` cleanly.

---

### Finding `BACKEND-008` — `POST /api/v1/auth/device` Unconditionally Returns `201 Created` on Existing Device Re-Login

1. **Unique Issue Identification**: `BACKEND-008` | Category: HTTP & REST Semantics | Severity: **Low** | Priority: **P3** | Module: Auth Controller & Route | Affected Endpoint: `POST /api/v1/auth/device` (`EP-006`)
2. **Exact Source Code Location**:
   - `apps/api/src/controllers/authController.ts:16` (unconditional `201`)
   - `apps/api/src/routes/auth.ts:12` (`anonymousId: z.string().min(1)`)
3. **Issue Description**: Signing back in with an existing `anonymousId` creates no new `User` resource yet still returns `201 Created` instead of `200 OK`.
4. **Reproduction Instructions**: Send `POST /api/v1/auth/device` `{ anonymousId: "regress-dev-<id>" }` twice. Expected `201` then `200`; Actual second call returned `201` (`201 !== 200`).
5. **Expected vs Actual Behavior**: `201` for first-time registration, `200` for subsequent sign-ins. *(Also review `min(1)` vs `min(3)` policy on `anonymousId`.)*
6. **Root Cause Analysis**: Hardcoded status `201` in `authController.ts:16` (`authService` does not surface whether the user was created vs found).
7. **Recommended Fix**: Return `{ ...session, isNewUser }` from `authService` and pass `isNewUser ? 201 : 200` in `authController.ts:16`.
8. **Regression Test Requirements**:
   - File: `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
   - Case: `[BACKEND-008] Repeat sign-in on POST /api/v1/auth/device for existing anonymousId should return 200 OK instead of 201 Created`
9. **Acceptance Criteria**: Initial device creation returns `201`; repeat device sign-in returns `200`.
10. **Fix Verification Status**: **CONFIRMED** (`201 !== 200` reproduced).
11. **Cross-Module / Cross-API Impact**: Verify any client/docs (`endpoints.md`) expecting `201` vs `200|201`.

---

### Finding `BACKEND-009` — API Contract, Type & Response Envelope Inconsistencies

1. **Unique Issue Identification**: `BACKEND-009` | Category: API Contract & Serialization Consistency | Severity: **Low** | Priority: **P3** | Module: Safe Zones, Admin, Media Webhook, Root/Health | Affected Endpoints: `EP-001`–`EP-005`, `EP-020`, `EP-031`, `EP-038`, `EP-039`
2. **Exact Source Code Location**:
   - `apps/api/src/services/safeZoneService.ts:207` (`ROUND(...::numeric, 1) as "distanceMeters"` serializes as `string`)
   - `apps/api/src/services/adminService.ts:178-179` (`getModerationLogs` silently clamps `limit`)
   - `apps/api/src/controllers/mediaController.ts:199` (`handleStorageWebhook` returns raw `{ received: true }`)
   - `apps/api/src/app.ts:48` (`GET /`) and `apps/api/src/routes/health.ts:8-22` (omit `{ success, data }`)
   - `apps/api/src/routes/admin.ts` (`/analytics/trends` ignores query parameters)
3. **Issue Description**: Mixed JSON types (`distanceMeters` returned as string), silent clamping instead of `400` on `limit=101`, and inconsistent response envelopes across endpoints.
4. **Reproduction Instructions**:
   - `GET /api/v1/safe-zones?lat=23.75&lng=90.38&radius=5000` → inspect `typeof data[0].distanceMeters` (`'string' !== 'number'`).
   - Admin `GET /api/v1/admin/logs?limit=101` → returns `200` clamped to `100` instead of `400`.
   - Valid `POST /api/v1/media/webhook` → omits `success: true`.
5. **Expected vs Actual Behavior**: Numeric `distanceMeters` (`number`), explicit `400` on invalid `/admin/logs` query limits, uniform `{ success, data }` envelope where contract permits.
6. **Root Cause Analysis**: Postgres `numeric` type serialization in Prisma `$queryRaw`, clamping fallback expressions, and ad-hoc controller JSON responses.
7. **Recommended Fix**: Cast `distanceMeters` to `DOUBLE PRECISION` (`float8`) in `safeZoneService.ts:207`, validate `logsQuerySchema` bounds with Zod, and coordinate standardizing `/media/webhook` / `/health` envelopes with consumers (`apps/web/app/api/health/route.ts`!).
8. **Regression Test Requirements**:
   - File: `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
   - Case: `[BACKEND-009] API contract consistency: /media/webhook uses {success,data}, /admin/logs rejects limit>100, and /safe-zones distanceMeters is a number`
9. **Acceptance Criteria**: `typeof distanceMeters === 'number'`, `/admin/logs?limit=101` returns `400`, `/media/webhook` returns `{ success: true, data }`.
10. **Fix Verification Status**: **CONFIRMED** (`'string' !== 'number'` reproduced).
11. **Cross-Module / Cross-API Impact**: Changing `/health` shape requires updating `apps/web/app/api/health/route.ts` if it checks fields beyond HTTP status.

---

### Finding `BACKEND-010` — KYC Rejection Reuses `VERIFY_USER` Audit Action & Duplicate `/users/verify/:id/approve` Route

1. **Unique Issue Identification**: `BACKEND-010` | Category: Audit Integrity & Route Maintainability | Severity: **Low** | Priority: **P3** | Module: User Verification & Admin Routes | Affected Endpoints: `POST /api/v1/admin/verifications/:id/reject` (`EP-034`), `POST /api/v1/users/verify/:id/approve` (`EP-012`)
2. **Exact Source Code Location**:
   - `apps/api/src/services/userService.ts:207-214` (`rejectVerification` logs `action: 'VERIFY_USER'`)
   - `apps/api/src/routes/users.ts:43` (`POST /verify/:id/approve` duplicates `apps/api/src/routes/admin.ts:55` without UUID validation middleware and with `{ userId, role }` payload)
3. **Issue Description**: Filtering moderation audit logs by `action=VERIFY_USER` mixes approved and rejected KYC decisions together, and duplicate approve routes drift in validation and response schema.
4. **Reproduction Instructions**: Submit KYC verification via `POST /api/v1/users/verify`, reject via Admin `POST /api/v1/admin/verifications/:id/reject`, and query `ModerationLog`. Actual `log.action === 'VERIFY_USER'`.
5. **Expected vs Actual Behavior**: Rejections record a distinct rejection `ModerationAction` enum (e.g., `REJECT_VERIFICATION`); single canonical validated approve route.
6. **Root Cause Analysis**: Reuse of `VERIFY_USER` enum in `rejectVerification` plus unretired legacy route on `routes/users.ts:43`.
7. **Recommended Fix**: Add `REJECT_VERIFICATION` to `ModerationAction` via additive Prisma migration for `rejectVerification`, add UUID validation to `/users/verify/:id/approve` or deprecate in favor of `/admin/verifications/:id/approve`.
8. **Regression Test Requirements**:
   - File: `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
   - Case: `[BACKEND-010] Admin verification rejection must record a distinct rejection ModerationLog.action instead of VERIFY_USER`
9. **Acceptance Criteria**: Rejection writes non-`VERIFY_USER` `ModerationAction`; `GET /api/v1/admin/logs` cleanly filters approvals vs rejections.
10. **Fix Verification Status**: **CONFIRMED** (`log?.action === 'VERIFY_USER'` reproduced).
11. **Cross-Module / Cross-API Impact**: Requires coordinated update to `ModerationAction` Zod enum (`routes/admin.ts`) and admin audit log UI filter dropdowns if present.

---

### Finding `BACKEND-011` — `POST /api/v1/reports` & `POST /api/v1/reports/:id/vote` Leak Reporter `userId` PII

1. **Unique Issue Identification**: `BACKEND-011` | Category: Privacy & Excessive Data Exposure (OWASP API3:2023) | Severity: **High** | Priority: **P1** | Module: Reports & Votes Services | Affected Endpoints: `POST /api/v1/reports` (`EP-013`), `POST /api/v1/reports/:id/vote` (`EP-017`)
2. **Exact Source Code Location**:
   - `apps/api/src/services/reportService.ts:182-187` (`createReport` returns `{ ...report, latitude: fuzzed.latitude, longitude: fuzzed.longitude, fuzzedRadiusMeters }`, including `report.userId`)
   - `apps/api/src/services/voteService.ts:105` (`castVote` returns raw `result` from `prisma.report.update`) + `apps/api/src/controllers/voteController.ts:13`
3. **Issue Description**: DangerZoneBD explicitly advertises anonymous safety reporting (`GET /reports`, `GET /reports/:id`, and `socketManager.ts` strip `userId`). However, **any authenticated voter** calling `POST /api/v1/reports/:id/vote` receives the target report's full Prisma object containing the original reporter's **`userId` UUID**, letting users cross-correlate reports by the same anonymous author and de-anonymize reporters.
4. **Reproduction Instructions**:
   - User A creates a report (`POST /api/v1/reports`). User B casts a vote (`POST /api/v1/reports/<id>/vote` `{ voteType: 1 }`).
   - **Expected vs Actual Result**: Expected `'userId' in data === false` on both responses; Actual `'userId' in created === true` (`true !== false`).
5. **Expected vs Actual Behavior**: Neither `POST /reports` nor `POST /reports/:id/vote` exposes raw `userId` database foreign key PII.
6. **Root Cause Analysis**: Raw Prisma `Report` model serialization in `reportService.ts:182-187` and `voteService.ts:105` instead of shared `sanitizeReportOutput` projection.
7. **Recommended Fix**: Pass returned `Report` payloads in both `createReport` and `castVote` through the existing `sanitizeReportOutput` helper (removing `userId` and exposing `isOwner` only when appropriate).
8. **Regression Test Requirements**:
   - File: `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
   - Case: `[BACKEND-011] POST /api/v1/reports and POST /api/v1/reports/:id/vote must NOT expose reporter userId PII in response JSON`
   - Also rerun: `api/03-reports-votes-updates.test.ts`, `database/01-integrity-transactions-concurrency.test.ts`, `api/07-sockets-realtime.test.ts`.
9. **Acceptance Criteria**: `'userId'` key is completely absent from both `POST /api/v1/reports` and `POST /api/v1/reports/:id/vote` response `data` objects.
10. **Fix Verification Status**: **CONFIRMED** (`true !== false` reproduced).
11. **Cross-Module / Cross-API Impact**: Verify frontend store update handlers after create/vote do not read `report.userId` (they already rely on `isOwner` elsewhere).

---

### Finding `BACKEND-012` — `GET /api/v1/reports` Accepts Inverted Bounding Boxes (`minLng > maxLng` / `minLat > maxLat`)

1. **Unique Issue Identification**: `BACKEND-012` | Category: Input Validation / Spatial Query Contract | Severity: **Medium** | Priority: **P2** | Module: Reports Validation | Affected Endpoint: `GET /api/v1/reports` (`EP-014`)
2. **Exact Source Code Location**:
   - `apps/api/src/routes/reports.ts:53-63` (`boundsSchema`)
3. **Issue Description**: `boundsSchema` validates each coordinate only with `!isNaN(parseFloat(val))`. Inverted boxes (`minLng=90.5&maxLng=90.3`) and malformed suffixes (`"90.3abc"`) silently return `200 OK` instead of `400 Bad Request`.
4. **Reproduction Instructions**: Send `GET /api/v1/reports?minLng=90.5&minLat=23.7&maxLng=90.3&maxLat=23.8`. Expected `400`; Actual `200` (`200 !== 400`).
5. **Expected vs Actual Behavior**: Inverted bounds (`minLng >= maxLng` or `minLat >= maxLat`), out-of-range lat/lng, and non-numeric strings fail with `400`.
6. **Root Cause Analysis**: Absence of `Number(val)` strict finite parsing, geographic range checks, and `.refine(min < max)` on `boundsSchema`.
7. **Recommended Fix**: Replace `!isNaN(parseFloat(val))` in `reports.ts:53-63` with strict finite number validation in `-90..90` / `-180..180` plus `.refine((q) => minLng < maxLng && minLat < maxLat)`.
8. **Regression Test Requirements**:
   - File: `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
   - Case: `[BACKEND-012] GET /api/v1/reports must reject inverted bounds (minLng >= maxLng or minLat >= maxLat) with 400`
9. **Acceptance Criteria**: Inverted bounding boxes return `400 Bad Request`; valid map viewports return `200`.
10. **Fix Verification Status**: **CONFIRMED** (`200 !== 400` reproduced).
11. **Cross-Module / Cross-API Impact**: Viewport map queries in `apps/web` must continue sending properly ordered `minLng < maxLng`, `minLat < maxLat`.

---

### Finding `BACKEND-013` — `POST /api/v1/admin/users/:id/ban` Permits Banning Peer `ADMIN`s & Self-Banning

1. **Unique Issue Identification**: `BACKEND-013` | Category: Broken Function Level Authorization & Availability | Severity: **High** | Priority: **P1** | Module: Admin Moderation Service | Affected Endpoint: `POST /api/v1/admin/users/:id/ban` (`EP-035`)
2. **Exact Source Code Location**:
   - `apps/api/src/services/adminService.ts:28-73` (`banUser`)
3. **Issue Description**: `banUser` checks only whether `targetUser` exists (`404`) and is not yet banned (`400`). One `ADMIN` can suspend all peer `ADMIN` accounts or self-ban the final active administrator account, locking out platform moderation.
4. **Reproduction Instructions**: Authenticate as `admin1`, call `POST /api/v1/admin/users/<admin2.id>/ban` `{ reason: "Regression check: peer admin ban safeguard" }`. Expected `403 Forbidden`; Actual `200 OK` (`200 !== 403`).
5. **Expected vs Actual Behavior**: Banning self or any user with `role === 'ADMIN'` must return `403 Forbidden` without mutating `User.isBanned` or revoking tokens.
6. **Root Cause Analysis**: Missing authorization guards (`targetUser.id === adminId` and `targetUser.role === 'ADMIN'`) in `adminService.ts:28-73`.
7. **Recommended Fix**: Add `403` guard checks in `banUser` rejecting `targetUser.id === adminId` and `targetUser.role === 'ADMIN'`.
8. **Regression Test Requirements**:
   - File: `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
   - Case: `[BACKEND-013] POST /api/v1/admin/users/:id/ban must forbid self-banning and peer-ADMIN suspension (403)`
   - Also rerun: `authorization/01-rbac-ownership-matrix.test.ts`, `database/01-integrity-transactions-concurrency.test.ts`.
9. **Acceptance Criteria**: Both peer-`ADMIN` ban and self-ban return `403`; banning `USER` or `VERIFIED_RESPONDER` continues returning `200`.
10. **Fix Verification Status**: **CONFIRMED** (`200 !== 403` reproduced).
11. **Cross-Module / Cross-API Impact**: Protects admin auth availability and prevents accidental admin `RefreshToken` mass revocation.

---

### Finding `BACKEND-014` — `POST /api/v1/alerts/zones` Persists Topologically Invalid Self-Intersecting Bowtie Polygons

1. **Unique Issue Identification**: `BACKEND-014` | Category: Spatial Data Integrity (PostGIS) | Severity: **Medium** | Priority: **P2** | Module: Alert Zone Service | Affected Endpoint: `POST /api/v1/alerts/zones` (`EP-024`)
2. **Exact Source Code Location**:
   - `apps/api/src/services/alertZoneService.ts:49-100` (`createAlertZone`)
3. **Issue Description**: `createAlertZone` validates coordinate closure, 5-zone cap, and `ST_Area <= 25 km²`, but never checks PostGIS `ST_IsValid(...)`. A self-intersecting bowtie figure-eight polygon is accepted and persisted, which can cause incorrect geofence containment evaluation (`ST_Intersects` / `ST_DWithin`).
4. **Reproduction Instructions**: Authenticated `POST /api/v1/alerts/zones` with a 5-vertex closed self-intersecting bowtie polygon (`BOWTIE_SELF_INTERSECTING_POLYGON`). Expected `400 Bad Request`; Actual `201 Created` (`201 !== 400`).
5. **Expected vs Actual Behavior**: Invalid/self-intersecting geometries fail with `400 Bad Request` before persistence.
6. **Root Cause Analysis**: Omission of `ST_IsValid(ST_GeomFromText(..., 4326))` check inside `createAlertZone`.
7. **Recommended Fix**: Validate `ST_IsValid(ST_GeomFromText(wkt, 4326))` in PostgreSQL inside `createAlertZone` (and reject false with `400`) before `INSERT INTO "UserAlertZone"`.
8. **Regression Test Requirements**:
   - File: `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
   - Case: `[BACKEND-014] POST /api/v1/alerts/zones must reject topologically invalid self-intersecting polygons (ST_IsValid) with 400`
   - Also rerun: `validation/01-schema-strictness-boundaries.test.ts`, `workflows/01-e2e-state-transitions.test.ts`.
9. **Acceptance Criteria**: Bowtie self-intersecting polygons return `400` with zero rows created; valid simple polygons still return `201`.
10. **Fix Verification Status**: **CONFIRMED** (`201 !== 400` reproduced).
11. **Cross-Module / Cross-API Impact**: Preserves reliable PostGIS `ST_DWithin` / `ST_Intersects` matching in geofence alert broadcasts.

---

### 12. Final Coding Agent Handoff Summary (Prioritized Execution Plan)

1. **Critical Production Blockers (`P0`)**:
   - **None** (`0` confirmed Critical/RCE/SQLi blockers).
2. **High-Priority Security, PII & Functional Issues (`P1`) — Fix Before Production Deploy**:
   - **`BACKEND-011`** (PII Leak — `reportService.ts:182-187`, `voteService.ts:105`): Strip `userId` from `POST /reports` & `POST /reports/:id/vote`.
   - **`BACKEND-001`** (Rate Limiting & Pre-Auth Cron DoS — `cron.ts:35-37`, `rateLimiter.ts:10-37`, `auth.ts`, `reports.ts`, `users.ts`, `routing.ts`): Run `verifyCronSecret` before `cronNewsCrawlRateLimiter`, stop trusting spoofable `X-Forwarded-For`, call `.unref()`, add missing route limiters.
   - **`BACKEND-002`** (Auth Session Lifecycle — `authController.ts:45-60`, `authService.ts:83-98`, `routes/auth.ts:27`): Rotate refresh tokens, omit `refreshToken` from JSON body, allow `/logout` with expired access tokens.
   - **`BACKEND-003`** (Weak/Fallback JWT Secrets — `env.ts:12-13`, `.env`): Remove fallback strings, enforce `>= 32`-char keys at boot & rotate `.env`.
   - **`BACKEND-013`** (Admin Self/Peer Ban — `adminService.ts:28-73`): Guard `banUser` with `403` against `targetUser.id === adminId` and `targetUser.role === 'ADMIN'`.
   - **`BACKEND-004`** (Unbounded Report Description — `routes/reports.ts:34`): Add `.trim().min(1).max(1000)` to `description`.
3. **Medium-Priority Reliability & Business-Logic Issues (`P2`)**:
   - **`BACKEND-014`** (`alertZoneService.ts:49-100`): Add PostGIS `ST_IsValid` check for geofence polygons.
   - **`BACKEND-012`** (`routes/reports.ts:53-63`): Enforce `minLng < maxLng`, `minLat < maxLat`, and finite number range checks in `boundsSchema`.
   - **`BACKEND-005`** (`routes/reports.ts:82`): Add `.trim()` to `addUpdateSchema.body.content`.
   - **`BACKEND-006`** (`routes/safeZones.ts:17-23`): Enforce strict numeric/range parsing in `safeZoneQuerySchema`.
   - **`BACKEND-007`** (`voteService.ts:18-26`, `alertZoneService.ts:139-141`, `userController.ts:36-38`): Preserve HTTP `404` on missing UUID records.
4. **Low-Priority Improvements (`P3`)**:
   - **`BACKEND-008`** (`authController.ts:16`): Return `200` on existing device sign-in vs `201` on creation.
   - **`BACKEND-009`** (`safeZoneService.ts:207`, `adminService.ts:178-179`, `mediaController.ts:199`, `app.ts:48`, `health.ts:8-22`): Fix string `distanceMeters`, reject `limit > 100`, align response envelopes carefully with consumers.
   - **`BACKEND-010`** (`userService.ts:207-214`, `routes/users.ts:43`): Use distinct `ModerationAction` enum for KYC rejections & unify duplicate verify-approve route.

**Post-Fix Verification Gate**: Once the coding agent applies fixes for `BACKEND-001`..`BACKEND-014`, run `npm --prefix apps/api run test:api:report` — all **62 / 62** test cases (48 verification + 14 regression cases) must pass with **0 failures** and `ORPHAN_USERS = 0`.

---

## Post-Fix Verification & Regression Testing Results

*(Historical Note: Sections A–K / 1–12 above are preserved verbatim as the pre-fix baseline audit record showing the initial `48 PASS / 14 FAIL` run. This section records the post-fix verification, expanded regression testing, and final audit synchronization completed on `2026-11-12` after remediation commits `2b82253..e2611b4`.)*

### A. Post-Fix Verification Execution Summary

| Verification Gate | Command / Check | Observed Result |
| :--- | :--- | :--- |
| TypeScript Build Integrity | `npm --prefix apps/api run typecheck` (`tsc --noEmit`) | **PASS** (`Exit Code 0`, zero errors) |
| Full API Verification & Regression Suite | `npm --prefix apps/api run test:api:report` | **PASS** — **68 / 68 Passed**, **0 Failed**, **0 Skipped** across **16 test files** (`283,950.69 ms`, `2026-11-12T14:23:00.502Z` → `2026-11-12T14:27:44.454Z`) |
| Verification Suites (`api`, `authentication`, `authorization`, `validation`, `security`, `database`, `workflows`, `performance`) | Executed within `test:api:report` (`14` files) | **48 / 48 PASS** |
| Original Confirmed Defects Regression Suite | `apps/api/tests/regression/01-confirmed-defects-regression.test.ts` | **14 / 14 PASS** (`BACKEND-001`..`BACKEND-014`) |
| Expanded Edge-Case & Boundary Regression Suite (New) | `apps/api/tests/regression/02-post-fix-edge-cases-regression.test.ts` | **6 / 6 PASS** (validates `.unref()`, all new limiters, `accessToken` omission, fail-closed `env.ts` boot, `min=1/max=1000` & whitespace boundaries, spatial regex/ranges, `/health*` + `/` envelopes, strict `/admin/*` params, legacy approve UUID + `REJECT_VERIFICATION` filter) |
| Endpoint Execution Coverage | `apps/api/docs/testing/API_Endpoint_Inventory.md` | **47 / 47** interfaces executed (`EXECUTED — PASS`) |
| PostgreSQL Orphan Record Isolation Check | Post-run Prisma count (`apitest-*`, `[APITEST]`) | `ORPHAN_USERS = 0`, `ORPHAN_REPORTS = 0`, `ORPHAN_SAFE_ZONES = 0`, `ORPHAN_ALERT_ZONES = 0`, `ORPHAN_REFRESH_TOKENS = 0`, `ORPHAN_MOD_LOGS = 0` |

#### Post-Fix Performance Baseline (`apps/api/tests/reports/perf-metrics.json`, `concurrency = 8`, `40` requests/endpoint)

| Endpoint | Success / Error | Min (ms) | P50 (ms) | P95 (ms) | P99 (ms) | RPS |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `GET /health` | 40 / 0 | 9.41 | 13.00 | 31.01 | 31.32 | 478.71 |
| `GET /api/v1/stats` | 40 / 0 | 550.59 | 588.39 | 932.43 | 933.31 | 12.18 |
| `GET /api/v1/reports` (Dhaka bounds) | 40 / 0 | 493.57 | 504.95 | 518.05 | 685.44 | 14.74 |
| `GET /api/v1/safe-zones` (Dhaka bounds) | 40 / 0 | 312.27 | 322.51 | 330.66 | 331.89 | 24.70 |
| `POST /api/v1/routes/safe-path` | 40 / 0 | 400.65 | 417.79 | 427.31 | 429.66 | 19.11 |

---

### B. Finding-by-Finding Post-Fix Verification Matrix (`BACKEND-001`..`BACKEND-014`)

| Finding ID | Severity | Verification Status | Commit | Tests Rerun (PASS) |
| :--- | :---: | :--- | :---: | :--- |
| `BACKEND-001` | High | **`FIXED AND VERIFIED`** | `e4329b1` | `regression/01`, `regression/02`, `security/01`, `api/06` |
| `BACKEND-002` | High | **`FIXED AND VERIFIED`** | `6bf7891` | `regression/01`, `regression/02`, `authentication/01`, `api/02` |
| `BACKEND-003` | High | **`FIXED AND VERIFIED`** | `56852c4` | `regression/01`, `regression/02`, `authentication/01` |
| `BACKEND-004` | High | **`FIXED AND VERIFIED`** | `e9fe89e` | `regression/01`, `regression/02`, `api/03` |
| `BACKEND-005` | Medium | **`FIXED AND VERIFIED`** | `1793d32` | `regression/01`, `regression/02`, `validation/01` |
| `BACKEND-006` | Medium | **`FIXED AND VERIFIED`** | `6c238e0` | `regression/01`, `regression/02`, `api/04` |
| `BACKEND-007` | Medium | **`FIXED AND VERIFIED`** | `d624171` | `regression/01`, `api/02`, `api/03`, `api/05` |
| `BACKEND-008` | Low | **`FIXED AND VERIFIED`** | `ee4ae6e` | `regression/01`, `api/02` |
| `BACKEND-009` | Low | **`FIXED AND VERIFIED`** | `8a8d2c3` | `regression/01`, `regression/02`, `api/01`, `api/04`, `api/05`, `api/06` |
| `BACKEND-010` | Low | **`FIXED AND VERIFIED`** | `e2611b4` | `regression/01`, `regression/02`, `api/02`, `api/06` |
| `BACKEND-011` | High | **`FIXED AND VERIFIED`** | `2b82253` | `regression/01`, `api/03`, `api/07` |
| `BACKEND-012` | Medium | **`FIXED AND VERIFIED`** | `fbd231a` | `regression/01`, `regression/02`, `api/03` |
| `BACKEND-013` | High | **`FIXED AND VERIFIED`** | `f5b684e` | `regression/01`, `authorization/01`, `api/06` |
| `BACKEND-014` | Medium | **`FIXED AND VERIFIED`** | `54569bd` | `regression/01`, `validation/01`, `api/05` |

---

### C. Detailed Per-Finding Verification Breakdown

1. **`BACKEND-001` — Rate Limiting Hardening & Pre-Auth Cron DoS Ordering**
   - **Original Issue Description**: `cronNewsCrawlRateLimiter` executed before `verifyCronSecret` (enabling pre-auth IP DoS against cron), `clientIp` trusted spoofable raw `X-Forwarded-For`, cleanup `setInterval` lacked `.unref()`, and mutating/expensive endpoints (`/auth/device`, `/auth/refresh`, `/reports/:id/vote`, `/reports/:id/updates`, `/users/verify`, `/routes/safe-path`) lacked rate limiters.
   - **Implemented Fix Summary**: Reordered `GET`/`POST /api/v1/cron/news-crawl` so `verifyCronSecret` runs before `cronNewsCrawlRateLimiter`; switched `clientIp` to `req.ip` backed by `app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : 'loopback')`; added `.unref()` to the cleanup interval; added calibrated rate limiters across all 6 unprotected routes (`e4329b1`).
   - **Affected Source Files**: `apps/api/src/middleware/rateLimiter.ts`, `apps/api/src/app.ts`, `apps/api/src/routes/cron.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/routes/reports.ts`, `apps/api/src/routes/users.ts`, `apps/api/src/routes/routing.ts`.
   - **Tests Rerun**: `tests/regression/01-confirmed-defects-regression.test.ts`, `tests/regression/02-post-fix-edge-cases-regression.test.ts`, `tests/security/01-owasp-security-checks.test.ts`, `tests/api/06-admin-stats-cron.test.ts`.
   - **Expected Results**: Unauthenticated `/cron/news-crawl` (`GET` & `POST`) return `401` without consuming cron quota; authenticated call returns `200`; cleanup interval calls `.unref()`; all newly added limiters enforce `429` at threshold; spoofed `X-Forwarded-For` does not reset peer quota.
   - **Actual Results**: All assertions passed (`401` x3 → `200` on GET & POST cron; `.unref()` verified; `429` triggered cleanly on `/auth/device`, `/auth/refresh`, `/reports/:id/vote`, `/reports/:id/updates`, `/users/verify`, `/routes/safe-path`).
   - **Verification Status**: **`FIXED AND VERIFIED`**

2. **`BACKEND-002` — Auth Session Hardening (`/login`, `/refresh`, `/logout`)**
   - **Original Issue Description**: `/auth/login` exposed tokens in JSON alongside cookies, `/auth/refresh` did not rotate/invalidate consumed refresh tokens, and `/auth/logout` failed `401` when called with an expired `accessToken` + valid `refreshToken` cookie.
   - **Implemented Fix Summary**: Removed both `accessToken` and `refreshToken` from `/auth/login` JSON (delivering strictly via `HttpOnly` cookies while keeping `socketToken` in JSON); implemented single-use transactional `RefreshToken` rotation + replay rejection (`401`) on `/auth/refresh`; added signature-verified expired-access handling (`optionalLogoutAuth`) on `/auth/logout` (`6bf7891`).
   - **Affected Source Files**: `apps/api/src/controllers/authController.ts`, `apps/api/src/services/authService.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/middleware/requireAuth.ts`, `apps/api/src/utils/jwt.ts`.
   - **Tests Rerun**: `tests/regression/01-confirmed-defects-regression.test.ts`, `tests/regression/02-post-fix-edge-cases-regression.test.ts`, `tests/authentication/01-auth-lifecycle.test.ts`, `tests/api/02-auth-users.test.ts`.
   - **Expected Results**: Login JSON omits `accessToken` & `refreshToken`; `/auth/refresh` atomically marks prior DB row revoked, rotates cookie, and rejects replay with `401`; expired-access `/auth/logout` returns `200`, revokes DB `RefreshToken`, and clears cookies.
   - **Actual Results**: All expectations passed verbatim in DB and HTTP assertions (minor doc drift note recorded below for `endpoints.md:275`).
   - **Verification Status**: **`FIXED AND VERIFIED`**

3. **`BACKEND-003` — Remove Hardcoded JWT Fallbacks & Enforce `>= 32`-Char Secrets**
   - **Original Issue Description**: `env.ts:12-13` contained hardcoded fallback JWT secrets and `apps/api/.env` used weak 20/24-char secrets.
   - **Implemented Fix Summary**: Removed fallback strings from `env.ts`, enforced Zod `.min(32)` startup fail-closed validation on `JWT_SECRET` and `JWT_REFRESH_SECRET`, and rotated both secrets in `apps/api/.env` to 64 characters (`56852c4`).
   - **Affected Source Files**: `apps/api/src/config/env.ts`, `apps/api/.env`.
   - **Tests Rerun**: `tests/regression/01-confirmed-defects-regression.test.ts`, `tests/regression/02-post-fix-edge-cases-regression.test.ts`, `tests/authentication/01-auth-lifecycle.test.ts`.
   - **Expected Results**: `apps/api/.env` secrets >= 32 chars and loading `env.ts` in an isolated process with empty or `< 32`-char secrets exits non-zero.
   - **Actual Results**: `.env` secret lengths passed and child-process boot checks failed closed for missing and `< 32`-char secrets (`exit !== 0`).
   - **Verification Status**: **`FIXED AND VERIFIED`**

4. **`BACKEND-004` — Bound Optional `description` on `POST /api/v1/reports`**
   - **Original Issue Description**: `reportSchema.body.description` accepted `""`, whitespace-only, and arbitrarily long >1000-char payloads.
   - **Implemented Fix Summary**: Changed schema to `z.string().trim().min(1).max(1000).optional()` (`e9fe89e`).
   - **Affected Source Files**: `apps/api/src/routes/reports.ts`, `apps/api/src/services/reportService.ts`.
   - **Tests Rerun**: `tests/regression/01-confirmed-defects-regression.test.ts`, `tests/regression/02-post-fix-edge-cases-regression.test.ts`, `tests/api/03-reports-votes-updates.test.ts`.
   - **Expected Results**: `""`, `"   "`, and 1001-char descriptions return `400`; 1000-char valid string and omitted `description` (`undefined`) return `201`.
   - **Actual Results**: Verified across all boundary payloads (`400` on `""`/`"   "`/1001 chars; `201` on 1000 chars and omitted).
   - **Verification Status**: **`FIXED AND VERIFIED`**

5. **`BACKEND-005` — Trim `POST /api/v1/reports/:id/updates` Content Before Length Check**
   - **Original Issue Description**: Whitespace `"   "` passed `min(2)` before `.trim()`, creating empty update rows (`201`).
   - **Implemented Fix Summary**: Added `.trim()` before `.min(2).max(500)` on `addUpdateSchema.body.content` (`1793d32`).
   - **Affected Source Files**: `apps/api/src/routes/reports.ts`, `apps/api/src/services/reportUpdateService.ts`.
   - **Tests Rerun**: `tests/regression/01-confirmed-defects-regression.test.ts`, `tests/regression/02-post-fix-edge-cases-regression.test.ts`, `tests/validation/01-schema-strictness-boundaries.test.ts`.
   - **Expected Results**: `"   "` and `" a "` return `400`; valid >=2-char trimmed text returns `201`.
   - **Actual Results**: `"   "` -> `400`, `"  ok  "` -> `201` with trimmed `"ok"`.
   - **Verification Status**: **`FIXED AND VERIFIED`**

6. **`BACKEND-006` — Strict Numeric & Range Validation on `GET /api/v1/safe-zones`**
   - **Original Issue Description**: Non-numeric coordinates (`?lat=abc&lng=def`) coerced to `NaN` and returned `200 []`.
   - **Implemented Fix Summary**: Added strict finite regex `/^-?\d+(?:\.\d+)?$/`, geographic range checks (`lat` in `-90..90`, `lng` in `-180..180`), positive `radius`, and ordered bounding box refinements (`6c238e0`).
   - **Affected Source Files**: `apps/api/src/routes/safeZones.ts`, `apps/api/src/controllers/safeZoneController.ts`.
   - **Tests Rerun**: `tests/regression/01-confirmed-defects-regression.test.ts`, `tests/regression/02-post-fix-edge-cases-regression.test.ts`, `tests/api/04-safe-zones-routing.test.ts`.
   - **Expected Results**: Non-numeric values, trailing garbage (`90.3abc`), out-of-range coordinates (`lat=95`), negative `radius`, partial params, and inverted bounds return `400`.
   - **Actual Results**: Every invalid combination returned `400`; valid radial and bounding queries returned `200`.
   - **Verification Status**: **`FIXED AND VERIFIED`**

7. **`BACKEND-007` — Return `404 Not Found` for Missing Resource UUIDs**
   - **Original Issue Description**: Non-existent UUIDs on `/reports/:id/vote`, `/alerts/zones/:id`, and `/users/verify/:id/approve` returned `400`.
   - **Implemented Fix Summary**: Attached `statusCode = 404` on missing entities in `voteService.ts` and `alertZoneService.ts` and respected `error.statusCode` in `userController.ts` (`d624171`).
   - **Affected Source Files**: `apps/api/src/services/voteService.ts`, `apps/api/src/services/alertZoneService.ts`, `apps/api/src/controllers/userController.ts`.
   - **Tests Rerun**: `tests/regression/01-confirmed-defects-regression.test.ts`, `tests/api/02-auth-users.test.ts`, `tests/api/03-reports-votes-updates.test.ts`, `tests/api/05-alerts-media.test.ts`.
   - **Expected Results**: Valid non-existent UUID returns `404` across all three endpoints.
   - **Actual Results**: Observed `404` across all three endpoints.
   - **Verification Status**: **`FIXED AND VERIFIED`**

8. **`BACKEND-008` — Device Login HTTP Status (`201` Created vs `200` OK)**
   - **Original Issue Description**: Repeat sign-in for an existing `anonymousId` on `POST /api/v1/auth/device` returned `201` instead of `200`.
   - **Implemented Fix Summary**: Propagated `isNewUser` from `authService.ts` so `authController.ts` returns `201` only when creating a new account and `200` on repeat sign-in (`ee4ae6e`).
   - **Affected Source Files**: `apps/api/src/controllers/authController.ts`, `apps/api/src/services/authService.ts`.
   - **Tests Rerun**: `tests/regression/01-confirmed-defects-regression.test.ts`, `tests/api/02-auth-users.test.ts`.
   - **Expected Results**: Initial device creation returns `201`; subsequent login returns `200`.
   - **Actual Results**: Verified `201` on creation followed by `200` on repeat call.
   - **Verification Status**: **`FIXED AND VERIFIED`**

9. **`BACKEND-009` — API Contract, Type & Envelope Consistency**
   - **Original Issue Description**: `distanceMeters` serialized as string, `/admin/logs` silently clamped out-of-range pagination (`limit=101`), and `/`, `/health*`, and `/media/webhook` lacked `{ success, data }` envelopes.
   - **Implemented Fix Summary**: Cast `distanceMeters` to `number`, replaced silent clamping with strict Zod query validation on `/admin/logs` and `/admin/analytics/trends`, and standardized `/`, `/health`, `/health/db`, `/api/v1/health`, `/api/v1/health/db`, and `/media/webhook` to `{ success, data }` envelopes (`8a8d2c3`).
   - **Affected Source Files**: `apps/api/src/services/safeZoneService.ts`, `apps/api/src/services/adminService.ts`, `apps/api/src/controllers/adminController.ts`, `apps/api/src/routes/admin.ts`, `apps/api/src/controllers/mediaController.ts`, `apps/api/src/routes/media.ts`, `apps/api/src/app.ts`, `apps/api/src/routes/health.ts`.
   - **Tests Rerun**: `tests/regression/01-confirmed-defects-regression.test.ts`, `tests/regression/02-post-fix-edge-cases-regression.test.ts`, `tests/api/01-health-system-proxy.test.ts`, `tests/api/04-safe-zones-routing.test.ts`, `tests/api/05-alerts-media.test.ts`, `tests/api/06-admin-stats-cron.test.ts`.
   - **Expected Results**: `typeof distanceMeters === 'number'`, invalid pagination/query params return `400`, and system/health/webhook endpoints emit `{ success: true, data }`.
   - **Actual Results**: All contract checks and Next.js proxy `/api/health` integration passed (`6/6`).
   - **Verification Status**: **`FIXED AND VERIFIED`**

10. **`BACKEND-010` — Distinct KYC Rejection `ModerationAction` & Legacy Route UUID Validation**
    - **Original Issue Description**: `rejectVerification` logged `VERIFY_USER` identically to approvals, and `/users/verify/:id/approve` lacked UUID param validation.
    - **Implemented Fix Summary**: Added `ModerationAction.REJECT_VERIFICATION` in Prisma schema, updated `rejectVerification` & `/admin/logs` filter validation, and added `verifyIdParamSchema` UUID validation on `/users/verify/:id/approve` (`e2611b4`).
    - **Affected Source Files**: `apps/api/prisma/schema.prisma`, `apps/api/src/services/userService.ts`, `apps/api/src/services/adminService.ts`, `apps/api/src/routes/users.ts`.
    - **Tests Rerun**: `tests/regression/01-confirmed-defects-regression.test.ts`, `tests/regression/02-post-fix-edge-cases-regression.test.ts`, `tests/api/02-auth-users.test.ts`, `tests/api/06-admin-stats-cron.test.ts`.
    - **Expected Results**: Rejection records `REJECT_VERIFICATION`, `GET /admin/logs?action=REJECT_VERIFICATION` returns filtered logs (`200`), and invalid UUID on legacy approve route returns `400`.
    - **Actual Results**: Confirmed `REJECT_VERIFICATION` log persistence, filterability, and `400` on invalid UUID.
    - **Verification Status**: **`FIXED AND VERIFIED`**

11. **`BACKEND-011` — Strip Reporter `userId` PII on `POST /reports` & `POST /reports/:id/vote`**
    - **Original Issue Description**: Report creation and voting returned raw Prisma records containing reporter `userId`.
    - **Implemented Fix Summary**: Routed both payloads through `sanitizeReportOutput` to omit `userId` PII (`2b82253`).
    - **Affected Source Files**: `apps/api/src/services/reportService.ts`, `apps/api/src/services/voteService.ts`.
    - **Tests Rerun**: `tests/regression/01-confirmed-defects-regression.test.ts`, `tests/api/03-reports-votes-updates.test.ts`, `tests/api/07-sockets-realtime.test.ts`.
    - **Expected Results**: `'userId' in data === false` on both responses.
    - **Actual Results**: Both payloads confirmed free of `userId` PII.
    - **Verification Status**: **`FIXED AND VERIFIED`**

12. **`BACKEND-012` — Bounding Box Strictness on `GET /api/v1/reports`**
    - **Original Issue Description**: Inverted bounding boxes (`minLng > maxLng` or `minLat > maxLat`) and trailing non-numeric characters succeeded with `200`.
    - **Implemented Fix Summary**: Added `coordQueryParam` regex `/^-?\d+(?:\.\d+)?$/`, range bounds (`-180..180`, `-90..90`), and `minLng < maxLng` / `minLat < maxLat` checks (`fbd231a`).
    - **Affected Source Files**: `apps/api/src/routes/reports.ts`.
    - **Tests Rerun**: `tests/regression/01-confirmed-defects-regression.test.ts`, `tests/regression/02-post-fix-edge-cases-regression.test.ts`, `tests/api/03-reports-votes-updates.test.ts`.
    - **Expected Results**: Inverted boxes, out-of-range coordinates, and `90.3abc` return `400`.
    - **Actual Results**: All invalid bounds variations returned `400`.
    - **Verification Status**: **`FIXED AND VERIFIED`**

13. **`BACKEND-013` — Prevent Admin Self-Ban & Peer-Admin Ban (`403`)**
    - **Original Issue Description**: `POST /api/v1/admin/users/:id/ban` allowed banning self or peer `ADMIN` accounts (`200`).
    - **Implemented Fix Summary**: Added `403` guards in `banUser` for `targetUser.id === adminId` and `targetUser.role === 'ADMIN'` (`f5b684e`).
    - **Affected Source Files**: `apps/api/src/services/adminService.ts`.
    - **Tests Rerun**: `tests/regression/01-confirmed-defects-regression.test.ts`, `tests/authorization/01-rbac-ownership-matrix.test.ts`, `tests/api/06-admin-stats-cron.test.ts`.
    - **Expected Results**: Self-ban and peer-admin ban return `403`; non-admin bans return `200`.
    - **Actual Results**: Verified `403` on peer/self admin bans and `200` on standard users.
    - **Verification Status**: **`FIXED AND VERIFIED`**

14. **`BACKEND-014` — PostGIS `ST_IsValid` Geofence Topology Guard**
    - **Original Issue Description**: `POST /api/v1/alerts/zones` persisted self-intersecting bowtie polygons into `UserAlertZone`.
    - **Implemented Fix Summary**: Added `ST_IsValid(ST_GeomFromText(..., 4326))` check with `ST_IsValidReason` diagnostics before insertion (`54569bd`).
    - **Affected Source Files**: `apps/api/src/services/alertZoneService.ts`.
    - **Tests Rerun**: `tests/regression/01-confirmed-defects-regression.test.ts`, `tests/validation/01-schema-strictness-boundaries.test.ts`, `tests/api/05-alerts-media.test.ts`.
    - **Expected Results**: Self-intersecting polygons fail with `400` and zero rows written.
    - **Actual Results**: Bowtie polygon rejected `400` while valid rings within `25 km^2` succeed `201`.
    - **Verification Status**: **`FIXED AND VERIFIED`**

---

### D. New Regression Findings & Remaining Unresolved Risks

- **New Runtime Regressions Introduced**: **None (`0`)**. All 48 baseline verification tests, all 14 defect regression tests, and all 6 expanded edge-case regression tests pass (`68 / 68`), including WebSockets (`07-sockets-realtime.test.ts`), RBAC/BOLA (`01-rbac-ownership-matrix.test.ts`), database concurrency (`01-integrity-transactions-concurrency.test.ts`), E2E workflows (`01-e2e-state-transitions.test.ts`), fuzzing (`30` seeded mutations with zero `500`s), and concurrent load (`01-fuzzing-and-load-baseline.test.ts`).
- **Remaining Minor Documentation Drift (Non-Blocking)**:
  - `apps/api/docs/endpoints.md:275` still includes `"accessToken": "<jwt-access-token>"` in the `POST /api/v1/auth/login` example response body, whereas runtime (`authController.ts:57-68`) sets both `accessToken` and `refreshToken` strictly in `HttpOnly` cookies (`{ user, socketToken }` JSON only) per `BACKEND-002`. (`apps/api/docs/testing/API_Endpoint_Inventory.md` and `API_Findings.json` have been updated to document this accurately.)
- **Environment & Deployment Configuration Prerequisites (Must Verify Before Production Cutover)**:
  1. `CRON_SECRET` and `STORAGE_WEBHOOK_SECRET` are unset in local `apps/api/.env` and `apps/web/.env*` (endpoints intentionally fail closed with `401` until populated in deployment secrets / Render & Vercel environments).
  2. Root repository `.env` retains legacy short `<32`-char `JWT_SECRET` (20 chars) and `JWT_REFRESH_SECRET` (24 chars); while `apps/api` boots cleanly from `apps/api/.env` (64-char secrets), any process launched with repo-root `.env` will fail closed at startup until rotated or removed.
  3. Local `apps/api/.env` sets `NODE_ENV=production`, activating `trust proxy = 1` and `secure: true` cookie attributes; if running directly behind zero reverse proxies without TLS in staging, set `NODE_ENV=development` (`'loopback'` proxy trust) and reserve `NODE_ENV=production` for proxied HTTPS deployments (Render/Vercel).

---

### E. Updated Overall API Health & Production-Readiness Assessment

- **Updated Overall API Health**: **HEALTHY (`100%` test pass rate — 68 / 68 across 16 suites, 0 TypeScript errors, 0 fuzz crashes, 0 orphan DB records, 47 / 47 interfaces passing)**. All security, authentication/session, spatial validation, RBAC, PII protection, rate-limiting, contract envelope, and audit-logging fixes are verified in place.
- **Updated Production-Readiness Assessment**: **`GO` (Conditional only on deployment secret provisioning)** — All 14 findings (`BACKEND-001`..`BACKEND-014`) carry final verification status **`FIXED AND VERIFIED`**. Before production cutover, ops should configure `CRON_SECRET` and `STORAGE_WEBHOOK_SECRET` in Render/Vercel environment settings and sync `apps/api/docs/endpoints.md:275` with cookie-only `accessToken` delivery.
