# DangerZoneBD Backend API Endpoint Inventory & Traceability Matrix

**Audit Baseline Date**: 2026-11-12  
**Express API Root**: `apps/api/src/app.ts` (`PORT=5000`, versioned prefix `/api/v1`)  
**Next.js App Router Proxies**: `apps/web/app/api/**`  
**Contract Baseline**: `apps/api/docs/endpoints.md` (43 Express HTTP routes + 3 Next.js App Router proxy routes + 1 Socket.IO Gateway)  
**Repository Discovery Verdict**: **46 HTTP endpoints + 1 Socket.IO gateway = 47 inventoried interfaces**. Zero undocumented, orphaned, dead, GraphQL, gRPC, or SSE routes were discovered.

---

## 1. Discovery Classification Summary

| Classification | Count | Endpoint IDs | Notes |
| :--- | :---: | :--- | :--- |
| `IMPLEMENTED AND DOCUMENTED` | 46 | `EP-001`–`EP-011`, `EP-013`–`EP-047` | All 46 primary HTTP/WebSocket interfaces verified passing; all `BACKEND-001`..`BACKEND-014` defects are `FIXED AND VERIFIED` (minor doc note: `endpoints.md:275` still lists `accessToken` in the `/auth/login` JSON example whereas runtime keeps both `accessToken` and `refreshToken` in `HttpOnly` cookies). |
| `DUPLICATE OR CONFLICTING ROUTE` | 1 | `EP-012` (`POST /api/v1/users/verify/:id/approve`) legacy alias of `EP-033` (`POST /api/v1/admin/verifications/:id/approve`) | Both approve a `UserVerification` record; `EP-012` now enforces UUID validation (`validateRequest`), returns `404` on missing verification (`BACKEND-007`), and is kept as a documented legacy alias (`BACKEND-010`). |
| `CONTRACT DRIFT` | 0 | — | All 17 previously drifting runtime contracts (`BACKEND-001`..`BACKEND-014`) are `FIXED AND VERIFIED` (see `endpoints.md:275` doc note on `EP-007`). |
| `IMPLEMENTED BUT UNDOCUMENTED` | 0 | — | All 46 HTTP endpoints + Socket.IO gateway are listed in `endpoints.md`. |
| `DOCUMENTED BUT MISSING` | 0 | — | All documented routes exist in `apps/api/src/` or `apps/web/app/api/`. |
| `DEPRECATED OR DEAD` | 0 | — | No unmounted routers or dead route handlers found. |

*(Execution Tally across all 47 inventoried interfaces: **47/47 executed** — **47 `EXECUTED — PASS`**, **0 `EXECUTED — DEFECT CONFIRMED`**; full post-fix suite verified **68/68** test cases passing across **16** test files including `regression/01` and `regression/02`, with `BACKEND-001`..`BACKEND-014` all `FIXED AND VERIFIED`.)*

---

## 2. Master Endpoint Inventory (All 24 Attributes per Endpoint)

### 2.1 System, Health & Next.js Proxy Endpoints

#### `EP-001` — `GET /`
1. **Endpoint ID**: `EP-001`
2. **Category / Domain Group**: System & Health
3. **HTTP Method**: `GET`
4. **Full Path**: `/`
5. **Source Definition Location**: `apps/api/src/app.ts:44-53` (inline handler)
6. **Summary / Business Purpose**: Returns API service identity, status, version, and endpoint index.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-009` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md` (`{ success: true, data }` envelope)
9. **Auth Requirement**: Public (`None`)
10. **Required Roles / Permissions**: None
11. **Resource Ownership Rules**: N/A
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: Standard HTTP headers
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`
17. **Success Response Shape**: `{ success: true, data: { name: 'BD Safety Map API', status: 'online', version: '1.0.0', endpoints: { ... } } }`
18. **Error Response Shapes**: Standard Express 500 handler only if unexpected runtime throw
19. **Side Effects**: None (stateless)
20. **Rate Limits / Security Controls**: `helmet()` security headers, `cors()`
21. **Risk Level**: `LOW`
22. **Edge Cases & Special Constraints**: Unknown subpaths return JSON `404` handler without leaking stack traces or env vars.
23. **Test Cases Mapped**: `apps/api/tests/api/01-health-system-proxy.test.ts` (`EP-001 GET / returns service metadata and security headers`)
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-009` resolved)

#### `EP-002` — `GET /health`
1. **Endpoint ID**: `EP-002`
2. **Category / Domain Group**: System & Health
3. **HTTP Method**: `GET`
4. **Full Path**: `/health`
5. **Source Definition Location**: `apps/api/src/app.ts:56`, `apps/api/src/routes/health.ts:7`, `healthCheck()`
6. **Summary / Business Purpose**: Root HTTP server liveness probe for load balancers (Render).
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-009` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: Public
10. **Required Roles / Permissions**: None
11. **Resource Ownership Rules**: N/A
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: None
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`
17. **Success Response Shape**: `{ success: true, message: 'API is running', data: { status: 'UP', message: 'API is running' } }`
18. **Error Response Shapes**: Standard global error envelope on unhandled exception
19. **Side Effects**: None
20. **Rate Limits / Security Controls**: `helmet()`, `cors()`
21. **Risk Level**: `LOW`
22. **Edge Cases & Special Constraints**: Responds cleanly without touching DB.
23. **Test Cases Mapped**: `apps/api/tests/api/01-health-system-proxy.test.ts` (`EP-002 GET /health returns live UP liveness payload`), `performance/01`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-009` resolved)

#### `EP-003` — `GET /health/db`
1. **Endpoint ID**: `EP-003`
2. **Category / Domain Group**: System & Health
3. **HTTP Method**: `GET`
4. **Full Path**: `/health/db`
5. **Source Definition Location**: `apps/api/src/app.ts:56`, `apps/api/src/routes/health.ts:15`
6. **Summary / Business Purpose**: Verifies active PostgreSQL/PostGIS database connectivity (`SELECT 1`).
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-009` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: Public
10. **Required Roles / Permissions**: None
11. **Resource Ownership Rules**: N/A
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: None
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `503`
17. **Success Response Shape**: `{ success: true, message: 'Database connection successful', data: { status: 'UP', database: 'connected', message: 'Database connection successful' } }`
18. **Error Response Shapes**: `503` -> `{ success: false, error: { code: 'DB_ERROR', message: 'Database connection failed' } }`
19. **Side Effects**: Executes read-only `SELECT 1`
20. **Rate Limits / Security Controls**: `helmet()`, `cors()`; sanitizes DB error details (`DB_ERROR` without connection string leakage)
21. **Risk Level**: `MEDIUM`
22. **Edge Cases & Special Constraints**: Must never leak `DATABASE_URL` or pg driver stack traces on `503`.
23. **Test Cases Mapped**: `apps/api/tests/api/01-health-system-proxy.test.ts` (`EP-003 GET /health/db confirms live PostgreSQL/PostGIS connectivity`)
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-009` resolved)

#### `EP-004` — `GET /api/v1/health`
1. **Endpoint ID**: `EP-004`
2. **Category / Domain Group**: System & Health
3. **HTTP Method**: `GET`
4. **Full Path**: `/api/v1/health`
5. **Source Definition Location**: `apps/api/src/app.ts:57`, `apps/api/src/routes/health.ts:7`
6. **Summary / Business Purpose**: Versioned mirror of server liveness probe.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-009` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: Public
10. **Required Roles / Permissions**: None
11. **Resource Ownership Rules**: N/A
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: None
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`
17. **Success Response Shape**: `{ success: true, message: 'API is running', data: { status: 'UP', message: 'API is running' } }`
18. **Error Response Shapes**: Standard global error envelope
19. **Side Effects**: None
20. **Rate Limits / Security Controls**: `helmet()`, `cors()`
21. **Risk Level**: `LOW`
22. **Edge Cases & Special Constraints**: Parity with `GET /health`.
23. **Test Cases Mapped**: `apps/api/tests/api/01-health-system-proxy.test.ts` (`EP-004 & EP-005 Versioned /api/v1/health and /api/v1/health/db match root probes`)
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-009` resolved)

#### `EP-005` — `GET /api/v1/health/db`
1. **Endpoint ID**: `EP-005`
2. **Category / Domain Group**: System & Health
3. **HTTP Method**: `GET`
4. **Full Path**: `/api/v1/health/db`
5. **Source Definition Location**: `apps/api/src/app.ts:57`, `apps/api/src/routes/health.ts:15`
6. **Summary / Business Purpose**: Versioned mirror of database readiness probe.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-009` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: Public
10. **Required Roles / Permissions**: None
11. **Resource Ownership Rules**: N/A
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: None
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `503`
17. **Success Response Shape**: `{ success: true, message: 'Database connection successful', data: { status: 'UP', database: 'connected', message: 'Database connection successful' } }`
18. **Error Response Shapes**: `503` -> `{ success: false, error: { code: 'DB_ERROR', message: 'Database connection failed' } }`
19. **Side Effects**: Executes `SELECT 1`
20. **Rate Limits / Security Controls**: `helmet()`, `cors()`
21. **Risk Level**: `MEDIUM`
22. **Edge Cases & Special Constraints**: Parity with `GET /health/db`.
23. **Test Cases Mapped**: `apps/api/tests/api/01-health-system-proxy.test.ts` (`EP-004 & EP-005 Versioned /api/v1/health and /api/v1/health/db match root probes`)
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-009` resolved)

---

### 2.2 Authentication Endpoints (`/api/v1/auth`)

#### `EP-006` — `POST /api/v1/auth/device`
1. **Endpoint ID**: `EP-006`
2. **Category / Domain Group**: Authentication
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/auth/device`
5. **Source Definition Location**: `apps/api/src/routes/auth.ts:24`, `authController.ts:6-27`, `authService.ts:12-65`
6. **Summary / Business Purpose**: Auto-registers or signs in an anonymous `USER` device session by `anonymousId`.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-001` & `BACKEND-008` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: Public
10. **Required Roles / Permissions**: None (`USER` only; blocks `ADMIN`, `VERIFIED_RESPONDER`, and password-backed accounts)
11. **Resource Ownership Rules**: Creates or resumes `User` matching `anonymousId`
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Content-Type: application/json`
15. **Request Body Schema**: `deviceLoginSchema` (`routes/auth.ts`): `{ anonymousId: string (min 1), email?: string (email) }` (`.strict()`)
16. **Response Status Codes**: `201` (new device user), `200` (existing device user), `400`, `403`, `429`
17. **Success Response Shape**: `{ success: true, data: { user: { id, role }, socketToken } }` + sets `HttpOnly` `accessToken` & `refreshToken` cookies
18. **Error Response Shapes**: `400` validation failed / unknown body property; `403` account banned / privileged / password-protected (clears cookies); `429` rate limit exceeded
19. **Side Effects**: Inserts `User` (if new `anonymousId`) and `RefreshToken`; sets auth cookies
20. **Rate Limits / Security Controls**: `authDeviceRateLimiter` (20 req / 15 min per IP); `.strict()` rejects extra keys (`400`); blocks `ADMIN`/`VERIFIED_RESPONDER`/`passwordHash != null` with `403`; clears cookies if banned
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: Returns `201` on initial creation and `200` on repeat sign-in (`BACKEND-008` resolved).
23. **Test Cases Mapped**: `apps/api/tests/authentication/01-auth-lifecycle.test.ts`, `apps/api/tests/api/02-auth-users.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-001`, `BACKEND-008` resolved)

#### `EP-007` — `POST /api/v1/auth/login`
1. **Endpoint ID**: `EP-007`
2. **Category / Domain Group**: Authentication
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/auth/login`
5. **Source Definition Location**: `apps/api/src/routes/auth.ts`, `authController.ts`, `authService.ts`
6. **Summary / Business Purpose**: Authenticates `ADMIN` and password-protected accounts via email and bcrypt password.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-001`, `BACKEND-002`, `BACKEND-003` — `FIXED AND VERIFIED`)*
8. **Documentation Match Status**: Cookie-only hardening active (`accessToken` & `refreshToken` kept in `HttpOnly` cookies only; minor doc drift remains at `apps/api/docs/endpoints.md:275` which still shows `accessToken` in JSON example)
9. **Auth Requirement**: Public
10. **Required Roles / Permissions**: Account with non-null `passwordHash` and `isBanned === false`
11. **Resource Ownership Rules**: Matches `User.email`
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Content-Type: application/json`
15. **Request Body Schema**: `passwordLoginSchema` (`routes/auth.ts`): `{ email: string (email), password: string (min 6) }` (`.strict()`)
16. **Response Status Codes**: `200`, `400`, `401`, `429`
17. **Success Response Shape**: `{ success: true, data: { user: { id, email, role, isVerified, trustScore }, socketToken } }` + `HttpOnly` cookies (`accessToken`, `refreshToken`)
18. **Error Response Shapes**: `400` validation error; `401` invalid credentials or banned user; `429` `RATE_LIMIT_EXCEEDED`
19. **Side Effects**: Inserts `RefreshToken` row; sets `accessToken` & `refreshToken` cookies
20. **Rate Limits / Security Controls**: `authLoginRateLimiter` (10 req / 15 min per `req.ip`, proxy-safe), fail-closed >= 32-char JWT secrets (`BACKEND-003`)
21. **Risk Level**: `CRITICAL`
22. **Edge Cases & Special Constraints**: Uniform `401` message for unknown email vs bad password; `accessToken` and `refreshToken` are omitted from JSON body and delivered strictly as `HttpOnly` cookies (`BACKEND-002`).
23. **Test Cases Mapped**: `apps/api/tests/authentication/01-auth-lifecycle.test.ts`, `apps/api/tests/security/01-owasp-security-checks.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`, `apps/api/tests/regression/02-post-fix-edge-cases-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-001`, `BACKEND-002`, `BACKEND-003` — `FIXED AND VERIFIED`)

#### `EP-008` — `POST /api/v1/auth/refresh`
1. **Endpoint ID**: `EP-008`
2. **Category / Domain Group**: Authentication
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/auth/refresh`
5. **Source Definition Location**: `apps/api/src/routes/auth.ts`, `authController.ts`, `authService.ts`
6. **Summary / Business Purpose**: Rotates `refreshToken` and `accessToken` cookies and mints a fresh `socketToken` using the `refreshToken` cookie.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-002`, `BACKEND-003` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `refreshToken` `HttpOnly` cookie (does NOT accept Bearer or body `refreshToken`)
10. **Required Roles / Permissions**: Non-banned existing user
11. **Resource Ownership Rules**: Token bound to `RefreshToken.userId`
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Cookie: refreshToken=<jwt>`
15. **Request Body Schema**: None (body ignored)
16. **Response Status Codes**: `200`, `401`, `429`
17. **Success Response Shape**: `{ success: true, data: { socketToken } }` + rotated `accessToken` and `refreshToken` `HttpOnly` cookies
18. **Error Response Shapes**: `401` if cookie missing, JWT invalid/expired, DB record revoked/replayed/expired, or user missing/banned (clears cookies); `429` rate limit exceeded
19. **Side Effects**: Atomically revokes consumed `RefreshToken` row, inserts rotated `RefreshToken`, updates both cookies
20. **Rate Limits / Security Controls**: `authRefreshRateLimiter` (30 req / 15 min per IP); single-use rotation & replay rejection (`401`)
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: Replaying a rotated/revoked `refreshToken` fails `401` (`BACKEND-002` resolved).
23. **Test Cases Mapped**: `apps/api/tests/authentication/01-auth-lifecycle.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-002`, `BACKEND-003` resolved)

#### `EP-009` — `POST /api/v1/auth/logout`
1. **Endpoint ID**: `EP-009`
2. **Category / Domain Group**: Authentication
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/auth/logout`
5. **Source Definition Location**: `apps/api/src/routes/auth.ts`, `authController.ts`, `authService.ts`
6. **Summary / Business Purpose**: Revokes session refresh token in PostgreSQL and clears auth cookies.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-002` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md` (`optionalLogoutAuth`)
9. **Auth Requirement**: `optionalLogoutAuth` (valid or expired signed `accessToken` or `refreshToken` cookie)
10. **Required Roles / Permissions**: Authenticated or cookie-backed session holder
11. **Resource Ownership Rules**: Revokes `req.cookies.refreshToken` matching token string
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Authorization` / `Cookie: accessToken=...; refreshToken=...`
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `401`
17. **Success Response Shape**: `{ success: true, data: {} }` + clears `accessToken` & `refreshToken` cookies
18. **Error Response Shapes**: `401` only when neither valid/expired session nor refresh cookie is present
19. **Side Effects**: Sets `RefreshToken.isRevoked = true`; `res.clearCookie('accessToken' | 'refreshToken')`
20. **Rate Limits / Security Controls**: Accepts expired signature-verified `accessToken` + `refreshToken` cookie cleanly
21. **Risk Level**: `MEDIUM`
22. **Edge Cases & Special Constraints**: Expired `accessToken` + `refreshToken` logout succeeds `200` and revokes refresh session (`BACKEND-002` resolved).
23. **Test Cases Mapped**: `apps/api/tests/authentication/01-auth-lifecycle.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-002` resolved)

---

### 2.3 Users & Verification Endpoints (`/api/v1/users`)

#### `EP-010` — `GET /api/v1/users/me`
1. **Endpoint ID**: `EP-010`
2. **Category / Domain Group**: Users & Verification
3. **HTTP Method**: `GET`
4. **Full Path**: `/api/v1/users/me`
5. **Source Definition Location**: `apps/api/src/routes/users.ts:41`, `userController.ts:6-13`, `userService.ts:34-66`
6. **Summary / Business Purpose**: Fetches authenticated user profile, trust score, activity counts, and latest verification status.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: Any authenticated active role (`USER`, `VERIFIED_RESPONDER`, `ADMIN`)
11. **Resource Ownership Rules**: Scoped strictly to `req.user.id`
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: Auth token
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `401`, `403`, `404` *(catch hardcoded `404`)*
17. **Success Response Shape**: `{ success: true, data: { id, email, role, isVerified, trustScore, isBanned, createdAt, _count: { reports, votes, alertZones }, verifications: [...] } }`
18. **Error Response Shapes**: `401` unauthenticated; `403` banned; `404` error envelope
19. **Side Effects**: Read-only
20. **Rate Limits / Security Controls**: `requireAuth`; `prisma.user.findUnique` select excludes `passwordHash`, `anonymousId`, `googleId`, `phoneNumber`
21. **Risk Level**: `LOW`
22. **Edge Cases & Special Constraints**: Verified `passwordHash` and `anonymousId` omitted from payload.
23. **Test Cases Mapped**: `apps/api/tests/api/02-auth-users.test.ts`, `authentication/01-auth-lifecycle.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

#### `EP-011` — `POST /api/v1/users/verify`
1. **Endpoint ID**: `EP-011`
2. **Category / Domain Group**: Users & Verification
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/users/verify`
5. **Source Definition Location**: `apps/api/src/routes/users.ts:42`, `userController.ts:15-26`, `userService.ts:68-137`
6. **Summary / Business Purpose**: Submits KYC verification (`PHONE_OTP` or `NID_DOCUMENT`).
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-001` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: Authenticated active user
11. **Resource Ownership Rules**: Creates verification for `req.user.id`
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Content-Type: application/json` + auth
15. **Request Body Schema**: `verifySchema` (`users.ts:12-38`): `{ type: 'PHONE_OTP' | 'NID_DOCUMENT', phoneNumber?: string (BD_MOBILE_REGEX), documentUrl?: string (URL) }` + `.superRefine()` requiring field matching `type`
16. **Response Status Codes**: `201`, `400`, `401`, `403`, `429`
17. **Success Response Shape**: `{ success: true, data: UserVerification }`
18. **Error Response Shapes**: `400` validation / duplicate pending verification / phone already claimed; `401` unauth; `403` banned; `429` rate limit exceeded
19. **Side Effects**: Inserts `UserVerification` (`PENDING`)
20. **Rate Limits / Security Controls**: `userVerifyRateLimiter` (10 req / 15 min per IP); checks phone uniqueness across users
21. **Risk Level**: `MEDIUM`
22. **Edge Cases & Special Constraints**: Duplicate `PENDING` request rejected `400`; `PHONE_OTP` validates Bangladesh mobile format.
23. **Test Cases Mapped**: `apps/api/tests/api/02-auth-users.test.ts`, `apps/api/tests/workflows/01-e2e-state-transitions.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-001` resolved)

#### `EP-012` — `POST /api/v1/users/verify/:id/approve`
1. **Endpoint ID**: `EP-012`
2. **Category / Domain Group**: Users & Verification
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/users/verify/:id/approve`
5. **Source Definition Location**: `apps/api/src/routes/users.ts`, `userController.ts`, `userService.ts`
6. **Summary / Business Purpose**: Legacy compatibility alias for admin approval of a user KYC verification request (`EP-033`).
7. **Discovery Status**: `DUPLICATE OR CONFLICTING ROUTE` *(kept as documented legacy alias of `EP-033`; `BACKEND-007` 404 semantics & `BACKEND-010` UUID validation resolved)*
8. **Documentation Match Status**: Documented in `endpoints.md` as legacy compatibility alias
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: `requireRole(['ADMIN'])`
11. **Resource Ownership Rules**: Admin action across any target verification
12. **Path Parameters & Schema**: `:id` (`verifyIdParamSchema`: UUID via `validateRequest`)
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: Admin auth
15. **Request Body Schema**: None (body optional/ignored)
16. **Response Status Codes**: `200`, `400` (invalid UUID / already processed), `401`, `403`, `404`
17. **Success Response Shape**: `{ success: true, data: { userId, role } }`
18. **Error Response Shapes**: `{ success: false, error: { message } }` (`404` on missing verification, `400` on invalid UUID)
19. **Side Effects**: Transaction updates `UserVerification.status='APPROVED'`, `User.isVerified=true`, promotes `USER` -> `VERIFIED_RESPONDER` (preserves `ADMIN`), optionally sets `User.phoneNumber`, creates `ModerationLog (VERIFY_USER)`
20. **Rate Limits / Security Controls**: Admin RBAC (`403` for `USER`/`VERIFIED_RESPONDER`) + UUID validation
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: Missing UUID returns `404`; invalid UUID format returns `400`; double-approval fails `400`.
23. **Test Cases Mapped**: `apps/api/tests/api/02-auth-users.test.ts`, `apps/api/tests/authorization/01-rbac-ownership-matrix.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-007`, `BACKEND-010` resolved)

---

### 2.4 Crime & Hazard Reports (`/api/v1/reports`)

#### `EP-013` — `POST /api/v1/reports`
1. **Endpoint ID**: `EP-013`
2. **Category / Domain Group**: Crime & Hazard Reports
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/reports`
5. **Source Definition Location**: `apps/api/src/routes/reports.ts`, `reportController.ts`, `reportService.ts`
6. **Summary / Business Purpose**: Submits a new crime/hazard report with PostGIS point persistence, night-time auto-detection, GPS verification, 15m citizen cooldown, Socket.IO broadcast, and async geofence alerts.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-004` & `BACKEND-011` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: Any authenticated active role; cooldown waived for `VERIFIED_RESPONDER` & `ADMIN`
11. **Resource Ownership Rules**: Bound to `req.user.id`
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: Optional `x-device-lat`, `x-device-lng`, `x-device-accuracy`, `x-gps-source: 'hardware' | 'manual'`
15. **Request Body Schema**: `reportSchema` (`reports.ts`): `{ category: ReportCategory enum (17 values), severity: 'LOW'|'MEDIUM'|'HIGH', latitude: number [-90..90], longitude: number [-180..180], description?: string (trim, min 1, max 1000) }`
16. **Response Status Codes**: `201`, `400`, `401`, `403`, `429`
17. **Success Response Shape**: `{ success: true, data: { id, category, severity, ..., latitude (fuzzed), longitude (fuzzed), fuzzedRadiusMeters: 150 } }` (`userId` PII stripped)
18. **Error Response Shapes**: `400` validation (empty/`>1000`-char `description`, GPS >200m, incomplete GPS headers); `401`; `403` banned; `429` IP rate limit or 15m DB cooldown
19. **Side Effects**: Transaction inserts `Report`, updates PostGIS `location`, updates `User.lastReportAt`; emits sanitized `NEW_REPORT`, `STATS_UPDATED`; if `HIGH`, enqueues geofence worker
20. **Rate Limits / Security Controls**: `reportCreationRateLimiter` (5 req / 1 hr per IP) + 15m DB cooldown for `USER`; sanitized projection strips `userId` (`BACKEND-011`)
21. **Risk Level**: `CRITICAL`
22. **Edge Cases & Special Constraints**: Rejects `""`, `"   "`, and `>1000`-char `description` (`400`, `BACKEND-004`); omits reporter `userId` PII (`BACKEND-011`).
23. **Test Cases Mapped**: `apps/api/tests/api/03-reports-votes-updates.test.ts`, `apps/api/tests/validation/01-schema-strictness-boundaries.test.ts`, `apps/api/tests/workflows/01-e2e-state-transitions.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-004`, `BACKEND-011` resolved)

#### `EP-014` — `GET /api/v1/reports`
1. **Endpoint ID**: `EP-014`
2. **Category / Domain Group**: Crime & Hazard Reports
3. **HTTP Method**: `GET`
4. **Full Path**: `/api/v1/reports`
5. **Source Definition Location**: `apps/api/src/routes/reports.ts`, `reportController.ts`, `reportService.ts`
6. **Summary / Business Purpose**: Queries active, non-expired reports inside a PostGIS viewport bounding box with optional category, severity, night, timeframe, and status filters.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-012` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: Public
10. **Required Roles / Permissions**: None
11. **Resource Ownership Rules**: N/A (strips `userId` PII and applies deterministic 150m fuzzing for non-news citizen reports)
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: `boundsSchema` (`reports.ts`): strict finite numeric `minLng`, `minLat`, `maxLng`, `maxLat` (`-180..180` / `-90..90`, `minLng < maxLng`, `minLat < maxLat`); optional `category`, `severity`, `isNightReport ('true'|'false')`, `hours`, `status ('ACTIVE'|'RESOLVED'|'ALL')`
14. **Request Headers Required / Optional**: Standard HTTP
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `400`
17. **Success Response Shape**: `{ success: true, data: ReportSummary[] }`
18. **Error Response Shapes**: `400` validation error on missing/non-numeric/inverted bounds or invalid enum filters
19. **Side Effects**: Read-only PostGIS spatial envelope query
20. **Rate Limits / Security Controls**: Location fuzzing, PII exclusion, strict finite coordinate range & ordering validation
21. **Risk Level**: `MEDIUM`
22. **Edge Cases & Special Constraints**: Inverted bounds (`minLng=90.5&maxLng=90.3`) and trailing garbage strings (`"90.3abc"`) rejected `400` (`BACKEND-012` resolved).
23. **Test Cases Mapped**: `apps/api/tests/api/03-reports-votes-updates.test.ts`, `apps/api/tests/performance/01-fuzzing-and-load-baseline.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-012` resolved)

#### `EP-015` — `GET /api/v1/reports/:id`
1. **Endpoint ID**: `EP-015`
2. **Category / Domain Group**: Crime & Hazard Reports
3. **HTTP Method**: `GET`
4. **Full Path**: `/api/v1/reports/:id`
5. **Source Definition Location**: `apps/api/src/routes/reports.ts:91`, `reportController.ts:68-82`, `reportService.ts:199-253`
6. **Summary / Business Purpose**: Fetches single report detail with blurred media URLs, author trust metadata (`authorVerified`, `authorRole`), fuzzed coordinates, and viewer ownership flag (`isOwner`).
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `optionalAuth` (`requireAuth.ts:81-101`)
10. **Required Roles / Permissions**: Public (authenticated viewers get accurate `isOwner`)
11. **Resource Ownership Rules**: Strips `userId`; exposes `isOwner: Boolean(viewerUserId && viewerUserId === userId)`
12. **Path Parameters & Schema**: `:id` (`reportIdSchema`: UUID)
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: Optional `Authorization` / `Cookie`
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `400`, `404`
17. **Success Response Shape**: `{ success: true, data: { id, ..., media: [{ id, blurredUrl, createdAt }], authorVerified, authorRole, isOwner, fuzzedRadiusMeters } }`
18. **Error Response Shapes**: `400` invalid UUID; `404` missing or `PURGED` report
19. **Side Effects**: Read-only
20. **Rate Limits / Security Controls**: Never exposes `userId` or `originalUrl` in `media`
21. **Risk Level**: `MEDIUM`
22. **Edge Cases & Special Constraints**: `PURGED` report returns `404`; invalid/tampered token in `optionalAuth` silently degrades to guest (`isOwner: false`) rather than rejecting `401`.
23. **Test Cases Mapped**: `apps/api/tests/api/03-reports-votes-updates.test.ts`, `apps/api/tests/security/01-owasp-security-checks.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

#### `EP-016` — `PATCH /api/v1/reports/:id/resolve`
1. **Endpoint ID**: `EP-016`
2. **Category / Domain Group**: Crime & Hazard Reports
3. **HTTP Method**: `PATCH`
4. **Full Path**: `/api/v1/reports/:id/resolve`
5. **Source Definition Location**: `apps/api/src/routes/reports.ts:92`, `reportController.ts:70-82` (`resolveReportHandler`), `reportService.ts:259-316`
6. **Summary / Business Purpose**: Transitions an `ACTIVE` report to `RESOLVED`.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: Original author OR `VERIFIED_RESPONDER` OR `ADMIN`
11. **Resource Ownership Rules**: `report.userId === req.user.id || role in ['ADMIN', 'VERIFIED_RESPONDER']` -> else `403`
12. **Path Parameters & Schema**: `:id` (UUID via `reportIdSchema`)
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: Auth token
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `400`, `401`, `403`, `404`
17. **Success Response Shape**: `{ success: true, data: { ...sanitizedReport, status: 'RESOLVED', fuzzedRadiusMeters, isOwner } }`
18. **Error Response Shapes**: `400` invalid UUID / already `RESOLVED` / `PURGED`; `401`; `403` non-owner `USER` or banned; `404` not found
19. **Side Effects**: Updates `Report.status='RESOLVED'`; emits `REPORT_RESOLVED` & `STATS_UPDATED`
20. **Rate Limits / Security Controls**: Strict ownership/role check (`403`)
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: Non-owner `USER` receives `403`; `VERIFIED_RESPONDER` resolving another user's report succeeds `200`; duplicate resolve returns `400`.
23. **Test Cases Mapped**: `apps/api/tests/authorization/01-rbac-ownership-matrix.test.ts`, `apps/api/tests/workflows/01-e2e-state-transitions.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

#### `EP-017` — `POST /api/v1/reports/:id/vote`
1. **Endpoint ID**: `EP-017`
2. **Category / Domain Group**: Crime & Hazard Reports
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/reports/:id/vote`
5. **Source Definition Location**: `apps/api/src/routes/reports.ts:93`, `voteController.ts:5-18`, `voteService.ts:15-106`
6. **Summary / Business Purpose**: Casts an upvote (`1`) or downvote (`-1`); 5 downvotes atomically trigger `PURGED` and decrement author `trustScore`.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-001`, `BACKEND-007`, `BACKEND-011` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: Any authenticated active user
11. **Resource Ownership Rules**: Unique `(userId, reportId)` vote per user; duplicate/switch votes rejected `400` (`"You have already voted on this report"`)
12. **Path Parameters & Schema**: `:id` (UUID via `reportIdSchema`)
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Content-Type: application/json` + auth
15. **Request Body Schema**: `voteSchema` (`reports.ts`): `{ voteType: 1 | -1 }`
16. **Response Status Codes**: `201`, `400`, `401`, `403`, `404`, `429`
17. **Success Response Shape**: `{ success: true, data: sanitizedReport }` (`userId` PII stripped)
18. **Error Response Shapes**: `{ success: false, error: { message } }` (`404` on missing report, `400` on purged/self-vote/duplicate vote, `429` rate limit exceeded)
19. **Side Effects**: Serializable/atomic `prisma.$transaction`: inserts `Vote`, increments `Report` counters, updates author `trustScore` (auto-purge threshold at 5 downvotes decrements `trustScore` in `voteService.ts`); emits `REPORT_VOTED`, optional `REPORT_PURGED`, & `STATS_UPDATED`
20. **Rate Limits / Security Controls**: `reportVoteRateLimiter` (60 req / 15 min per IP); unique DB constraint `[userId, reportId]`; strips `userId` PII (`BACKEND-011`)
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: Concurrent duplicate same-user votes safely collapsed to one vote; auto-purge threshold at 5 downvotes verified (`PURGED`).
23. **Test Cases Mapped**: `apps/api/tests/database/01-integrity-transactions-concurrency.test.ts`, `apps/api/tests/workflows/01-e2e-state-transitions.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-001`, `BACKEND-007`, `BACKEND-011` resolved)

#### `EP-018` — `POST /api/v1/reports/:id/updates`
1. **Endpoint ID**: `EP-018`
2. **Category / Domain Group**: Crime & Hazard Reports
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/reports/:id/updates`
5. **Source Definition Location**: `apps/api/src/routes/reports.ts`, `reportUpdateController.ts`, `reportUpdateService.ts`
6. **Summary / Business Purpose**: Appends a threaded context update to an `ACTIVE` report and emits `NEW_REPORT_UPDATE`.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-001`, `BACKEND-005` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: Any authenticated active user
11. **Resource Ownership Rules**: Attaches `authorRole` & `isOwner` in return object (`userId` stripped)
12. **Path Parameters & Schema**: `:id` (UUID via `reportIdSchema`)
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Content-Type: application/json` + auth
15. **Request Body Schema**: `addUpdateSchema` (`reports.ts`): `{ content: string (trim, min 2, max 500) }`
16. **Response Status Codes**: `201`, `400`, `401`, `403`, `404`, `429`
17. **Success Response Shape**: `{ success: true, data: { id, reportId, content, createdAt, authorRole, isOwner } }`
18. **Error Response Shapes**: `400` on empty/whitespace/invalid length or `PURGED` report; `401`; `403` banned; `404` report not found; `429` rate limit exceeded
19. **Side Effects**: Inserts `ReportUpdate`; emits `NEW_REPORT_UPDATE`
20. **Rate Limits / Security Controls**: `reportUpdateRateLimiter` (20 req / 15 min per IP); strips `userId` before Socket.IO broadcast
21. **Risk Level**: `MEDIUM`
22. **Edge Cases & Special Constraints**: Whitespace `"   "` rejected `400` (`BACKEND-005` resolved); `PURGED` report rejects `400`.
23. **Test Cases Mapped**: `apps/api/tests/validation/01-schema-strictness-boundaries.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-001`, `BACKEND-005` resolved)

#### `EP-019` — `GET /api/v1/reports/:id/updates`
1. **Endpoint ID**: `EP-019`
2. **Category / Domain Group**: Crime & Hazard Reports
3. **HTTP Method**: `GET`
4. **Full Path**: `/api/v1/reports/:id/updates`
5. **Source Definition Location**: `apps/api/src/routes/reports.ts:97`, `reportUpdateController.ts:21-28`, `reportUpdateService.ts:68-107`
6. **Summary / Business Purpose**: Lists chronological updates on a non-purged report (PII stripped).
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: Public
10. **Required Roles / Permissions**: None
11. **Resource Ownership Rules**: Strips `userId`, returns `authorRole` & `isOwner`
12. **Path Parameters & Schema**: `:id` (UUID via `reportIdSchema`)
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: Standard HTTP
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `400`, `404`
17. **Success Response Shape**: `{ success: true, data: [{ id, reportId, content, createdAt, authorRole, isOwner }] }`
18. **Error Response Shapes**: `400` invalid UUID; `404` report not found or `PURGED`
19. **Side Effects**: Read-only
20. **Rate Limits / Security Controls**: PII redaction (`userId` stripped)
21. **Risk Level**: `LOW`
22. **Edge Cases & Special Constraints**: `PURGED` report returns `404` even if updates previously existed.
23. **Test Cases Mapped**: `apps/api/tests/api/03-reports-votes-updates.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

---

### 2.5 Verified Safe Zones (`/api/v1/safe-zones`)

#### `EP-020` — `GET /api/v1/safe-zones`
1. **Endpoint ID**: `EP-020`
2. **Category / Domain Group**: Verified Safe Zones
3. **HTTP Method**: `GET`
4. **Full Path**: `/api/v1/safe-zones`
5. **Source Definition Location**: `apps/api/src/routes/safeZones.ts:48`, `safeZoneController.ts:8-48`, `safeZoneService.ts:144-215`
6. **Summary / Business Purpose**: Lists verified police boxes, hospitals, and pharmacies by viewport bounding box or radial distance (default Dhaka fallback if no spatial params).
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-006`, `BACKEND-009` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: Public
10. **Required Roles / Permissions**: None
11. **Resource Ownership Rules**: N/A
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: `safeZoneQuerySchema` (`safeZones.ts`): strict finite numeric `lat`, `lng`, `radius`, `minLng`, `minLat`, `maxLng`, `maxLat`, optional `type: 'HOSPITAL'|'POLICE_BOX'|'PHARMACY'`
14. **Request Headers Required / Optional**: Standard HTTP
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `400`
17. **Success Response Shape**: `{ success: true, data: SafeZone[] }` (includes numeric `"distanceMeters": number` in radial mode)
18. **Error Response Shapes**: `400` on invalid `type`, non-numeric/partial/out-of-range spatial params
19. **Side Effects**: Calls `seedDefaultSafeZones()` (lazy idempotent seed of Dhaka havens if `SafeZone` count is 0)
20. **Rate Limits / Security Controls**: PostGIS parameterized `Prisma.sql` queries + strict Zod numeric spatial validation
21. **Risk Level**: `MEDIUM`
22. **Edge Cases & Special Constraints**: `?lat=abc&lng=def` rejected `400` (`BACKEND-006`); `distanceMeters` serialized as `number` (`BACKEND-009`).
23. **Test Cases Mapped**: `apps/api/tests/api/04-safe-zones-routing.test.ts`, `apps/api/tests/validation/01-schema-strictness-boundaries.test.ts`, `apps/api/tests/performance/01-fuzzing-and-load-baseline.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-006`, `BACKEND-009` resolved)

#### `EP-021` — `POST /api/v1/safe-zones`
1. **Endpoint ID**: `EP-021`
2. **Category / Domain Group**: Verified Safe Zones
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/safe-zones`
5. **Source Definition Location**: `apps/api/src/routes/safeZones.ts:49`, `safeZoneController.ts:50-60`, `safeZoneService.ts:220-237`
6. **Summary / Business Purpose**: Creates and persists a new verified safe haven with PostGIS geography point.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: `requireRole(['ADMIN'])`
11. **Resource Ownership Rules**: Admin-managed reference catalog
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Content-Type: application/json` + Admin auth
15. **Request Body Schema**: `createSafeZoneSchema` (`safeZones.ts:28-38`): `{ type: 'HOSPITAL'|'POLICE_BOX'|'PHARMACY', name: string (min 2, max 120), latitude: number [-90..90], longitude: number [-180..180] }` (`.strict()`)
16. **Response Status Codes**: `201`, `400`, `401`, `403`
17. **Success Response Shape**: `{ success: true, data: { id, type, name, latitude, longitude, createdAt } }`
18. **Error Response Shapes**: `400` validation error (including unknown fields due to `.strict()`); `401`; `403` non-admin
19. **Side Effects**: Inserts `SafeZone` row + PostGIS geography point
20. **Rate Limits / Security Controls**: `ADMIN` RBAC + `.strict()` body schema
21. **Risk Level**: `MEDIUM`
22. **Edge Cases & Special Constraints**: Rejects unknown body properties cleanly.
23. **Test Cases Mapped**: `apps/api/tests/api/04-safe-zones-routing.test.ts`, `apps/api/tests/authorization/01-rbac-ownership-matrix.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

#### `EP-022` — `DELETE /api/v1/safe-zones/:id`
1. **Endpoint ID**: `EP-022`
2. **Category / Domain Group**: Verified Safe Zones
3. **HTTP Method**: `DELETE`
4. **Full Path**: `/api/v1/safe-zones/:id`
5. **Source Definition Location**: `apps/api/src/routes/safeZones.ts:50`, `safeZoneController.ts:62-74`, `safeZoneService.ts:242-252`
6. **Summary / Business Purpose**: Deletes a verified safe haven by UUID.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: `requireRole(['ADMIN'])`
11. **Resource Ownership Rules**: Admin-only
12. **Path Parameters & Schema**: `:id` (`safeZoneIdSchema`: UUID)
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: Admin auth
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `400`, `401`, `403`, `404`
17. **Success Response Shape**: `{ success: true, data: { id, deleted: true, name } }`
18. **Error Response Shapes**: `400` invalid UUID; `401`; `403` non-admin; `404` not found
19. **Side Effects**: Deletes `SafeZone` row
20. **Rate Limits / Security Controls**: `ADMIN` RBAC + UUID validation
21. **Risk Level**: `MEDIUM`
22. **Edge Cases & Special Constraints**: Correctly sets `error.statusCode = 404` on missing record.
23. **Test Cases Mapped**: `apps/api/tests/api/04-safe-zones-routing.test.ts`, `apps/api/tests/authorization/01-rbac-ownership-matrix.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

---

### 2.6 Safe-Path Routing (`/api/v1/routes`)

#### `EP-023` — `POST /api/v1/routes/safe-path`
1. **Endpoint ID**: `EP-023`
2. **Category / Domain Group**: Safe-Path Routing
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/routes/safe-path`
5. **Source Definition Location**: `apps/api/src/routes/routing.ts:18`, `routingController.ts:5-19`, `safeRouteService.ts:95-210`
6. **Summary / Business Purpose**: Computes a hazard-avoiding polyline route between two Bangladesh coordinates, detouring around active corridor hazards by severity buffer (`500m`/`250m`/`120m`).
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-001` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: Public
10. **Required Roles / Permissions**: None
11. **Resource Ownership Rules**: N/A (does not expose report author PII)
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Content-Type: application/json`
15. **Request Body Schema**: `safeRouteSchema` (`routing.ts`): `{ startLat: [-90..90], startLng: [-180..180], endLat: [-90..90], endLng: [-180..180] }` (`.strict()`)
16. **Response Status Codes**: `200`, `400`, `429`
17. **Success Response Shape**: `{ success: true, data: { origin, destination, directDistanceMeters, safeDistanceMeters, safetyRating: 'CLEAR'|'HIGH_SAFETY', bypassedHazardsCount, bypassedHazards, waypoints } }`
18. **Error Response Shapes**: `400` schema validation OR outside Bangladesh envelope (`20.3..26.8 N, 87.8..92.9 E`); `429` rate limit exceeded
19. **Side Effects**: Read-only PostGIS spatial corridor query
20. **Rate Limits / Security Controls**: `.strict()` schema + `safeRouteRateLimiter` (120 req / 1 min per IP)
21. **Risk Level**: `MEDIUM`
22. **Edge Cases & Special Constraints**: Flat payload `{ startLat, startLng, endLat, endLng }` (nested `{ start: ... }` fails `400`); outside-BD coords fail `400`; hazard detours verified E2E.
23. **Test Cases Mapped**: `apps/api/tests/api/04-safe-zones-routing.test.ts`, `apps/api/tests/workflows/01-e2e-state-transitions.test.ts`, `apps/api/tests/performance/01-fuzzing-and-load-baseline.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-001` resolved)

---

### 2.7 Geofenced Alerts (`/api/v1/alerts`)

#### `EP-024` — `POST /api/v1/alerts/zones`
1. **Endpoint ID**: `EP-024`
2. **Category / Domain Group**: Geofenced Alerts
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/alerts/zones`
5. **Source Definition Location**: `apps/api/src/routes/alerts.ts`, `alertController.ts`, `alertZoneService.ts`
6. **Summary / Business Purpose**: Creates a closed GeoJSON Polygon alert zone (`<= 25 km²`, max 5 active zones per user) stored in PostGIS `geography(Polygon, 4326)`.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-014` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md` (boundary checks & topological `ST_IsValid`)
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: Any authenticated active user
11. **Resource Ownership Rules**: Owned by `req.user.id`
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Content-Type: application/json` + auth
15. **Request Body Schema**: `createZoneSchema` (`alerts.ts`): `{ name: string (min 2, max 100), coordinates: [number, number][] (min 4 vertices, first == last) }` (`.strict()`)
16. **Response Status Codes**: `201`, `400`, `401`, `403`
17. **Success Response Shape**: `{ success: true, data: { id, userId, name, isActive, createdAt, updatedAt, area } }`
18. **Error Response Shapes**: `400` unclosed or self-intersecting polygon (`ST_IsValid = false`) / >5 zones / >25 km²; `401`; `403` banned
19. **Side Effects**: Inserts `UserAlertZone` via PostGIS `ST_GeomFromText(..., 4326)` after `ST_IsValid` check
20. **Rate Limits / Security Controls**: Area & zone count caps; `.strict()` schema; PostGIS `ST_IsValid` topological validation
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: 5-zone cap, unclosed polygon rejection, 25 km² `ST_Area` cap, and self-intersecting bowtie rejection (`400`, `BACKEND-014`) all verified.
23. **Test Cases Mapped**: `apps/api/tests/api/05-alerts-media.test.ts`, `apps/api/tests/validation/01-schema-strictness-boundaries.test.ts`, `apps/api/tests/workflows/01-e2e-state-transitions.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-014` resolved)

#### `EP-025` — `GET /api/v1/alerts/zones`
1. **Endpoint ID**: `EP-025`
2. **Category / Domain Group**: Geofenced Alerts
3. **HTTP Method**: `GET`
4. **Full Path**: `/api/v1/alerts/zones`
5. **Source Definition Location**: `apps/api/src/routes/alerts.ts:46`, `alertController.ts:21-29`, `alertZoneService.ts:118-130`
6. **Summary / Business Purpose**: Lists active geofenced alert zones belonging to the authenticated user.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: Any authenticated active user
11. **Resource Ownership Rules**: Strict `WHERE "userId" = ${req.user.id}` isolation
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: Auth token
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `401`, `403`
17. **Success Response Shape**: `{ success: true, data: AlertZoneOutput[] }`
18. **Error Response Shapes**: `401`, `403` banned
19. **Side Effects**: Read-only
20. **Rate Limits / Security Controls**: Horizontal ownership isolation
21. **Risk Level**: `MEDIUM`
22. **Edge Cases & Special Constraints**: User A never sees User B's zones.
23. **Test Cases Mapped**: `apps/api/tests/api/05-alerts-media.test.ts`, `apps/api/tests/authorization/01-rbac-ownership-matrix.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

#### `EP-026` — `DELETE /api/v1/alerts/zones/:id`
1. **Endpoint ID**: `EP-026`
2. **Category / Domain Group**: Geofenced Alerts
3. **HTTP Method**: `DELETE`
4. **Full Path**: `/api/v1/alerts/zones/:id`
5. **Source Definition Location**: `apps/api/src/routes/alerts.ts:47`, `alertController.ts:31-43`, `alertZoneService.ts:135-167`
6. **Summary / Business Purpose**: Deletes an alert zone owned by the authenticated user.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-007` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md` (`404` on missing zone)
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: Zone owner (`zone.userId === req.user.id`)
11. **Resource Ownership Rules**: Cross-user delete returns `403` (`alertZoneService.ts`)
12. **Path Parameters & Schema**: `:id` (`deleteZoneSchema`: UUID)
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: Auth token
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `400` (invalid UUID), `401`, `403`, `404`
17. **Success Response Shape**: `{ success: true, data: { message: 'Alert zone deleted successfully' } }`
18. **Error Response Shapes**: `404` missing zone; `400` invalid UUID; `401`; `403` cross-user IDOR attempt or banned
19. **Side Effects**: Deletes `UserAlertZone` row
20. **Rate Limits / Security Controls**: IDOR ownership check (`403`)
21. **Risk Level**: `MEDIUM`
22. **Edge Cases & Special Constraints**: Non-existent UUID returns `404` (`BACKEND-007` resolved).
23. **Test Cases Mapped**: `apps/api/tests/api/05-alerts-media.test.ts`, `apps/api/tests/authorization/01-rbac-ownership-matrix.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-007` resolved)

#### `EP-027` — `POST /api/v1/alerts/subscribe`
1. **Endpoint ID**: `EP-027`
2. **Category / Domain Group**: Geofenced Alerts
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/alerts/subscribe`
5. **Source Definition Location**: `apps/api/src/routes/alerts.ts:48`, `alertController.ts:45-60`, `alertZoneService.ts:172-178`
6. **Summary / Business Purpose**: Registers Web Push subscription endpoint for the authenticated user.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: Any authenticated active user
11. **Resource Ownership Rules**: Scoped to `req.user.id`
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Content-Type: application/json` + auth
15. **Request Body Schema**: `subscribePushSchema` (`alerts.ts:30-42`): `{ endpoint: string (URL), keys?: { p256dh: string, auth: string } }` (`.strict()`)
16. **Response Status Codes**: `200`, `400`, `401`, `403`
17. **Success Response Shape**: `{ success: true, data: { subscribed: true, userId } }`
18. **Error Response Shapes**: `400` invalid endpoint URL / extra body keys; `401`; `403` banned
19. **Side Effects**: Stateless acknowledgment
20. **Rate Limits / Security Controls**: `.strict()` validation
21. **Risk Level**: `LOW`
22. **Edge Cases & Special Constraints**: Rejects unknown keys and malformed `endpoint` URLs.
23. **Test Cases Mapped**: `apps/api/tests/api/05-alerts-media.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

---

### 2.8 Media & Privacy Auto-Blurring (`/api/v1/media`)

#### `EP-028` — `GET /api/v1/media/presigned-url`
1. **Endpoint ID**: `EP-028`
2. **Category / Domain Group**: Media & Privacy Auto-Blurring
3. **HTTP Method**: `GET`
4. **Full Path**: `/api/v1/media/presigned-url`
5. **Source Definition Location**: `apps/api/src/routes/media.ts:104`, `mediaController.ts:50-85`, `storageService.ts:270-318`
6. **Summary / Business Purpose**: Generates an S3 presigned `PUT` URL (or mock fallback descriptor when S3 creds absent) for valid report media.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: Report owner, `VERIFIED_RESPONDER`, or `ADMIN`
11. **Resource Ownership Rules**: Verified via `findAuthorizedReportForMedia` (`report.userId === user.id || privileged`)
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: `presignedUrlSchema` (`media.ts:32-49`): `{ reportId: UUID, fileType: 'image/jpeg'|'image/png'|'image/webp', fileSize: numeric integer string > 0 && <= 5242880 }` (`.strict()`)
14. **Request Headers Required / Optional**: Auth token; `multipart/form-data` blocked (`415`)
15. **Request Body Schema**: None (`GET`)
16. **Response Status Codes**: `200`, `400`, `401`, `403`, `404`, `415`
17. **Success Response Shape**: `{ success: true, data: { uploadUrl, fileKey, publicUrl, expiresInSeconds: 600, isMock } }`
18. **Error Response Shapes**: `400` invalid size/MIME/UUID; `401`; `403` non-owner `USER` / banned; `404` report not found; `415` multipart
19. **Side Effects**: None (URL generation only)
20. **Rate Limits / Security Controls**: `rejectMultipart`, strict MIME allowlist, 5MB limit, ownership check
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: Rejects `fileSize=5242881` (`> 5MB`) & `image/svg+xml` with `400`.
23. **Test Cases Mapped**: `apps/api/tests/api/05-alerts-media.test.ts`, `apps/api/tests/authorization/01-rbac-ownership-matrix.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

#### `EP-029` — `POST /api/v1/media/confirm`
1. **Endpoint ID**: `EP-029`
2. **Category / Domain Group**: Media & Privacy Auto-Blurring
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/media/confirm`
5. **Source Definition Location**: `apps/api/src/routes/media.ts:110`, `mediaController.ts:36-73, 90-149`, `storageService.ts:168-265`
6. **Summary / Business Purpose**: Confirms uploaded report media using `fileKey` or trusted `originalUrl`, creates `ReportMedia`, runs `processPrivacyBlur`, and returns sanitized `{ id, reportId, blurredUrl, createdAt }` omitting `originalUrl`.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: Report owner, `VERIFIED_RESPONDER`, or `ADMIN`
11. **Resource Ownership Rules**: Enforces report ownership + `reports/{reportId}/...` key match
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Content-Type: application/json` + auth (`multipart/*` -> `415`)
15. **Request Body Schema**: `confirmMediaSchema` (`media.ts:51-67`): `{ reportId: UUID, fileKey?: string, originalUrl?: string }` (at least one required, `.strict()`)
16. **Response Status Codes**: `200` *(idempotent)*, `201`, `400`, `401`, `403`, `404`, `415`
17. **Success Response Shape**: `{ success: true, data: { id, reportId, blurredUrl, createdAt } }` (omits `originalUrl`)
18. **Error Response Shapes**: `400` untrusted `originalUrl` (SSRF block), traversal `..`, cross-report `fileKey`, mismatched `fileKey`/`originalUrl`; `403` IDOR; `404`; `415`
19. **Side Effects**: Inserts `ReportMedia` (`blurredUrl` set); strips `originalUrl` in response
20. **Rate Limits / Security Controls**: Anti-SSRF trusted bucket/CDN origin validation (`resolveTrustedReportMedia`)
21. **Risk Level**: `CRITICAL`
22. **Edge Cases & Special Constraints**: Arbitrary URL `https://169.254.169.254/latest/meta-data` or `https://evil.com/a.jpg` rejected `400`; idempotent duplicate confirm returns `200` with existing row.
23. **Test Cases Mapped**: `apps/api/tests/api/05-alerts-media.test.ts`, `apps/api/tests/security/01-owasp-security-checks.test.ts`, `apps/api/tests/authorization/01-rbac-ownership-matrix.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

#### `EP-030` — `POST /api/v1/media/mock-upload`
1. **Endpoint ID**: `EP-030`
2. **Category / Domain Group**: Media & Privacy Auto-Blurring
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/media/mock-upload`
5. **Source Definition Location**: `apps/api/src/routes/media.ts:116`, `mediaController.ts:36-73, 154-185`, `storageService.ts:326-381`
6. **Summary / Business Purpose**: Accepts compressed inline base64 image evidence (`<= 512KB`) when S3 is unconfigured (`isS3Configured() === false`).
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: Report owner, `VERIFIED_RESPONDER`, or `ADMIN`
11. **Resource Ownership Rules**: `findAuthorizedReportForMedia`
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Content-Type: application/json` + auth
15. **Request Body Schema**: `mockUploadSchema` (`media.ts:87-98`): `{ reportId: UUID, imageDataUrl: string }` (`.strict()`)
16. **Response Status Codes**: `201`, `400`, `401`, `403`, `404`, `409` *(if S3 configured)*, `415`
17. **Success Response Shape**: `{ success: true, data: { id, reportId, blurredUrl, createdAt } }` (omits `originalUrl`)
18. **Error Response Shapes**: `400` bad base64 / invalid magic bytes / >512KB / non-image; `401`; `403` IDOR; `404`; `409`; `415`
19. **Side Effects**: Inserts `ReportMedia` with normalized data URI & `blurredUrl`
20. **Rate Limits / Security Controls**: Binary magic-byte inspection (`FFD8FF` JPEG, `89504E470D0A1A0A` PNG, `RIFF....WEBP`) blocking polyglots/HTML/SVG
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: PNG/HTML payload spoofing JPEG MIME type rejected `400`.
23. **Test Cases Mapped**: `apps/api/tests/api/05-alerts-media.test.ts`, `apps/api/tests/security/01-owasp-security-checks.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

#### `EP-031` — `POST /api/v1/media/webhook`
1. **Endpoint ID**: `EP-031`
2. **Category / Domain Group**: Media & Privacy Auto-Blurring
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/media/webhook`
5. **Source Definition Location**: `apps/api/src/routes/media.ts:122`, `verifyWebhookSecret.ts:27-53`, `mediaController.ts:187-205+`
6. **Summary / Business Purpose**: S3/Supabase storage event callback registering newly uploaded report objects if not yet recorded.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-009` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md` (`{ success: true, data: { received: true } }`)
9. **Auth Requirement**: `verifyStorageWebhookSecret` (`x-webhook-secret` header using timing-safe compare; **fail-closed** when `STORAGE_WEBHOOK_SECRET` unset)
10. **Required Roles / Permissions**: Internal storage service callback
11. **Resource Ownership Rules**: Validates `reports/{reportId}/...` key & existing non-purged `Report`
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `x-webhook-secret: <STORAGE_WEBHOOK_SECRET>`, `Content-Type: application/json`
15. **Request Body Schema**: `storageWebhookSchema`: accepts `Records` array (S3 event), `record` object (`type`, `record: { name, bucket_id }`), or direct `key` string
16. **Response Status Codes**: `200`, `400`, `401`, `415`
17. **Success Response Shape**: `{ success: true, data: { received: true } }`
18. **Error Response Shapes**: `401` on unset/missing/wrong `x-webhook-secret`; `400` malformed payload; `415` multipart
19. **Side Effects**: Idempotently inserts `ReportMedia` when key corresponds to active `Report`
20. **Rate Limits / Security Controls**: `timingSafeEqual` fail-closed secret verification; optional `STORAGE_WEBHOOK_BUCKET` enforcement
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: When `STORAGE_WEBHOOK_SECRET=""`, requests fail closed `401`.
23. **Test Cases Mapped**: `apps/api/tests/api/05-alerts-media.test.ts`, `apps/api/tests/security/01-owasp-security-checks.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-009` resolved)

---

### 2.9 Admin Moderation & Analytics (`/api/v1/admin`)

All `/api/v1/admin/*` routes sit behind `router.use(requireAuth, requireRole(['ADMIN']))` (`admin.ts:13`).

#### `EP-032` — `GET /api/v1/admin/verifications`
1. **Endpoint ID**: `EP-032`
2. **Category / Domain Group**: Admin Moderation & Analytics
3. **HTTP Method**: `GET`
4. **Full Path**: `/api/v1/admin/verifications`
5. **Source Definition Location**: `apps/api/src/routes/admin.ts:54`, `adminController.ts:18-24`, `adminService.ts`
6. **Summary / Business Purpose**: Lists `PENDING` KYC verification requests ordered FIFO with applicant summary.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: `ADMIN`
11. **Resource Ownership Rules**: Global moderation queue
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: Admin auth
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `401`, `403`
17. **Success Response Shape**: `{ success: true, data: VerificationItem[] }`
18. **Error Response Shapes**: `401`, `403` (`USER` or `VERIFIED_RESPONDER`)
19. **Side Effects**: Read-only
20. **Rate Limits / Security Controls**: `ADMIN` RBAC; applicant `select` omits `passwordHash`/`anonymousId`
21. **Risk Level**: `MEDIUM`
22. **Edge Cases & Special Constraints**: Verified Responder (`VERIFIED_RESPONDER`) receives `403`.
23. **Test Cases Mapped**: `apps/api/tests/authorization/01-rbac-ownership-matrix.test.ts`, `apps/api/tests/api/06-admin-stats-cron.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

#### `EP-033` — `POST /api/v1/admin/verifications/:id/approve`
1. **Endpoint ID**: `EP-033`
2. **Category / Domain Group**: Admin Moderation & Analytics
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/admin/verifications/:id/approve`
5. **Source Definition Location**: `apps/api/src/routes/admin.ts:55`, `adminController.ts:26-34`, `userService.ts:139-189`
6. **Summary / Business Purpose**: Approves a pending KYC request, sets `isVerified: true`, upgrades `USER` -> `VERIFIED_RESPONDER`, and logs `VERIFY_USER`.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(overlaps functionally with `EP-012`)*
8. **Documentation Match Status**: Returns `updatedUser` directly (includes `anonymousId`, omits `passwordHash`)
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: `ADMIN`
11. **Resource Ownership Rules**: Global admin moderation
12. **Path Parameters & Schema**: `:id` (`approveSchema`: UUID)
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: Admin auth
15. **Request Body Schema**: Optional `{ notes?: string (max 500) }` (`.strict()`)
16. **Response Status Codes**: `200`, `400`, `401`, `403`, `404`
17. **Success Response Shape**: `{ success: true, data: updatedUser }` (`{ id, anonymousId, email, role, isVerified, trustScore, ... }`)
18. **Error Response Shapes**: `400` already processed / invalid UUID / unknown body field; `401`; `403`; `404` not found
19. **Side Effects**: Updates `UserVerification`, `User`, inserts `ModerationLog (VERIFY_USER)`
20. **Rate Limits / Security Controls**: `ADMIN` RBAC + `validateRequest(approveSchema)`
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: Correctly returns `404` on unknown UUID (unlike `EP-012`); preserves `ADMIN` role if applicant was already admin.
23. **Test Cases Mapped**: `apps/api/tests/api/06-admin-stats-cron.test.ts`, `apps/api/tests/workflows/01-e2e-state-transitions.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

#### `EP-034` — `POST /api/v1/admin/verifications/:id/reject`
1. **Endpoint ID**: `EP-034`
2. **Category / Domain Group**: Admin Moderation & Analytics
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/admin/verifications/:id/reject`
5. **Source Definition Location**: `apps/api/src/routes/admin.ts:56`, `adminController.ts:36-44`, `userService.ts:191-218`
6. **Summary / Business Purpose**: Rejects a pending KYC verification with reason string.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-010` resolved — records distinct `REJECT_VERIFICATION` action)*
8. **Documentation Match Status**: Aligned with `endpoints.md` and `ModerationAction.REJECT_VERIFICATION`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: `ADMIN`
11. **Resource Ownership Rules**: Global admin moderation
12. **Path Parameters & Schema**: `:id` (`reasonSchema`: UUID)
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Content-Type: application/json` + Admin auth
15. **Request Body Schema**: `reasonSchema` (`admin.ts`): `{ reason: string (trim, min 3, max 500) }` (`.strict()`)
16. **Response Status Codes**: `200`, `400`, `401`, `403`, `404`
17. **Success Response Shape**: `{ success: true, data: UserVerification (status: 'REJECTED') }`
18. **Error Response Shapes**: `400` bad reason / already processed; `401`; `403`; `404` not found
19. **Side Effects**: Updates `UserVerification.status='REJECTED'`, creates `ModerationLog (REJECT_VERIFICATION)`
20. **Rate Limits / Security Controls**: `ADMIN` RBAC + `.strict()` body
21. **Risk Level**: `MEDIUM`
22. **Edge Cases & Special Constraints**: Missing/short `reason` (`< 3` chars) rejected `400`; double-reject rejected `400`.
23. **Test Cases Mapped**: `apps/api/tests/api/06-admin-stats-cron.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-010` resolved)

#### `EP-035` — `POST /api/v1/admin/users/:id/ban`
1. **Endpoint ID**: `EP-035`
2. **Category / Domain Group**: Admin Moderation & Analytics
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/admin/users/:id/ban`
5. **Source Definition Location**: `apps/api/src/routes/admin.ts`, `adminController.ts`, `adminService.ts`
6. **Summary / Business Purpose**: Suspends a non-admin user (`isBanned = true`), revokes all active `RefreshToken` rows atomically, and writes `BAN_USER` audit log.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-013` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md` (forbids self-ban & peer-`ADMIN` suspension)
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: `ADMIN`
11. **Resource Ownership Rules**: Target must exist, not be self or `ADMIN` (`403`), and not already be banned (`400`)
12. **Path Parameters & Schema**: `:id` (`reasonSchema`: UUID)
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Content-Type: application/json` + Admin auth
15. **Request Body Schema**: `reasonSchema`: `{ reason: string (trim, min 3, max 500) }` (`.strict()`)
16. **Response Status Codes**: `200`, `400`, `401`, `403`, `404`
17. **Success Response Shape**: `{ success: true, data: { user: updatedUser, log } }`
18. **Error Response Shapes**: `400` already banned / invalid reason; `401`; `403` caller non-admin, self-ban, or peer-`ADMIN` target; `404` user not found
19. **Side Effects**: Transaction updates `User.isBanned=true`, `RefreshToken.updateMany({ isRevoked: true })`, inserts `ModerationLog (BAN_USER)`
20. **Rate Limits / Security Controls**: Immediate token & Socket.IO invalidation verified; `targetUser.role === 'ADMIN' || targetUser.id === adminId` guard returns `403` (`BACKEND-013`)
21. **Risk Level**: `CRITICAL`
22. **Edge Cases & Special Constraints**: Peer `ADMIN` ban and self-ban both rejected `403` (`BACKEND-013` resolved).
23. **Test Cases Mapped**: `apps/api/tests/authentication/01-auth-lifecycle.test.ts`, `apps/api/tests/database/01-integrity-transactions-concurrency.test.ts`, `apps/api/tests/workflows/01-e2e-state-transitions.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-013` resolved)

#### `EP-036` — `POST /api/v1/admin/users/:id/unban`
1. **Endpoint ID**: `EP-036`
2. **Category / Domain Group**: Admin Moderation & Analytics
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/admin/users/:id/unban`
5. **Source Definition Location**: `apps/api/src/routes/admin.ts:58`, `adminController.ts:56-64`, `adminService.ts:75-115`
6. **Summary / Business Purpose**: Restores a suspended account (`isBanned = false`) and logs `UNBAN_USER`.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: `ADMIN`
11. **Resource Ownership Rules**: Target user
12. **Path Parameters & Schema**: `:id` (`reasonSchema`: UUID)
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Content-Type: application/json` + Admin auth
15. **Request Body Schema**: `reasonSchema`: `{ reason: string (trim, min 3, max 500) }` (`.strict()`)
16. **Response Status Codes**: `200`, `400`, `401`, `403`, `404`
17. **Success Response Shape**: `{ success: true, data: { user: updatedUser, log } }`
18. **Error Response Shapes**: `400` user not banned / invalid reason; `401`; `403`; `404` user not found
19. **Side Effects**: Transaction updates `User.isBanned=false`, inserts `ModerationLog (UNBAN_USER)`
20. **Rate Limits / Security Controls**: `ADMIN` RBAC + `.strict()` body
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: Unbanning a non-banned user fails `400`; previously revoked refresh tokens remain revoked.
23. **Test Cases Mapped**: `apps/api/tests/api/06-admin-stats-cron.test.ts`, `apps/api/tests/workflows/01-e2e-state-transitions.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

#### `EP-037` — `POST /api/v1/admin/reports/:id/purge`
1. **Endpoint ID**: `EP-037`
2. **Category / Domain Group**: Admin Moderation & Analytics
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/admin/reports/:id/purge`
5. **Source Definition Location**: `apps/api/src/routes/admin.ts:59`, `adminController.ts:66-74`, `adminService.ts:120-169`
6. **Summary / Business Purpose**: Manually purges a report (`status = 'PURGED'`), records `PURGE_REPORT`, broadcasts `REPORT_PURGED` & `STATS_UPDATED`.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: `ADMIN`
11. **Resource Ownership Rules**: Admin moderation across any report
12. **Path Parameters & Schema**: `:id` (`reasonSchema`: UUID)
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `Content-Type: application/json` + Admin auth
15. **Request Body Schema**: `reasonSchema`: `{ reason: string (trim, min 3, max 500) }` (`.strict()`)
16. **Response Status Codes**: `200`, `400`, `401`, `403`, `404`
17. **Success Response Shape**: `{ success: true, data: { report: updatedReport, log } }`
18. **Error Response Shapes**: `400` already purged / bad reason; `401`; `403`; `404` report not found
19. **Side Effects**: Updates `Report.status='PURGED'`, inserts `ModerationLog (PURGE_REPORT)`, emits `REPORT_PURGED` (`ADMIN_PURGED: ...`) & `STATS_UPDATED`
20. **Rate Limits / Security Controls**: `ADMIN` RBAC + `.strict()` body
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: Purged report immediately yields `404` on `GET /reports/:id`.
23. **Test Cases Mapped**: `apps/api/tests/api/06-admin-stats-cron.test.ts`, `apps/api/tests/workflows/01-e2e-state-transitions.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

#### `EP-038` — `GET /api/v1/admin/logs`
1. **Endpoint ID**: `EP-038`
2. **Category / Domain Group**: Admin Moderation & Analytics
3. **HTTP Method**: `GET`
4. **Full Path**: `/api/v1/admin/logs`
5. **Source Definition Location**: `apps/api/src/routes/admin.ts:60`, `adminController.ts:76-85`, `adminService.ts:178-206`
6. **Summary / Business Purpose**: Returns paginated `ModerationLog` audit entries ordered newest-first.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-009` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md` (strict pagination validation)
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: `ADMIN`
11. **Resource Ownership Rules**: Audit log global view
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: `logsQuerySchema` (`admin.ts`): optional positive integer `page >= 1`, integer `limit` (`1..100`), optional `action?: ModerationAction` (`.strict()`)
14. **Request Headers Required / Optional**: Admin auth
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `400`, `401`, `403`
17. **Success Response Shape**: `{ success: true, data: { logs: ModerationLog[], pagination: { total, page, limit, totalPages } } }`
18. **Error Response Shapes**: `400` on invalid/out-of-range `page`/`limit`, invalid `action` enum, or unknown query params; `401`; `403`
19. **Side Effects**: Read-only
20. **Rate Limits / Security Controls**: `ADMIN` RBAC + strict `page`/`limit` bounds (`1..100`)
21. **Risk Level**: `LOW`
22. **Edge Cases & Special Constraints**: `limit=101`, `limit=abc`, `page=0`, and unknown query keys rejected `400` (`BACKEND-009` resolved).
23. **Test Cases Mapped**: `apps/api/tests/api/06-admin-stats-cron.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-009` resolved)

#### `EP-039` — `GET /api/v1/admin/analytics/trends`
1. **Endpoint ID**: `EP-039`
2. **Category / Domain Group**: Admin Moderation & Analytics
3. **HTTP Method**: `GET`
4. **Full Path**: `/api/v1/admin/analytics/trends`
5. **Source Definition Location**: `apps/api/src/routes/admin.ts`, `adminController.ts`
6. **Summary / Business Purpose**: Aggregates 30-day incident timeline, night percentage, and category/severity/status breakdowns.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-009` resolved)*
8. **Documentation Match Status**: Aligned with `endpoints.md` (fixed `30_DAYS`, rejects unexpected query params)
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: `ADMIN`
11. **Resource Ownership Rules**: Global analytics
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: `trendsQuerySchema` (`query: z.object({}).strict()`) — rejects unexpected query params with `400`
14. **Request Headers Required / Optional**: Admin auth
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `400`, `401`, `403`
17. **Success Response Shape**: `{ success: true, data: { timeframe: '30_DAYS', startDate, totalReports, nightReportsCount, nightReportPercentage, breakdown: { byCategory, bySeverity, byStatus }, timeline } }`
18. **Error Response Shapes**: `400` on unexpected query parameters; `401`; `403`
19. **Side Effects**: Read-only aggregation
20. **Rate Limits / Security Controls**: `ADMIN` RBAC + `.strict()` empty query guard
21. **Risk Level**: `LOW`
22. **Edge Cases & Special Constraints**: Sums of `byStatus` equal `totalReports`; arbitrary query params rejected `400` (`BACKEND-009`).
23. **Test Cases Mapped**: `apps/api/tests/api/06-admin-stats-cron.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-009` resolved)

#### `EP-040` — `POST /api/v1/admin/news/crawl`
1. **Endpoint ID**: `EP-040`
2. **Category / Domain Group**: Admin Moderation & Analytics
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/admin/news/crawl`
5. **Source Definition Location**: `apps/api/src/routes/admin.ts:54`, `adminController.ts:98-123`
6. **Summary / Business Purpose**: Manually triggers the RSS news crawler pipeline protected by concurrency mutex.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `requireAuth`
10. **Required Roles / Permissions**: `ADMIN`
11. **Resource Ownership Rules**: Global admin action
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: Admin auth
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `401`, `403`
17. **Success Response Shape**: `{ success: true, data: { status: 'success' | 'in_progress', feedsChecked?, totalIngested?, totalSkipped?, totalVerifiedMatches?, ingested? } }`
18. **Error Response Shapes**: `401`, `403`
19. **Side Effects**: Fetches external RSS feeds, upserts `NewsArticle` + verified `Report` rows, emits `NEW_REPORT`, `REPORT_VERIFIED`, `STATS_UPDATED`
20. **Rate Limits / Security Controls**: `ADMIN` RBAC + mutex (`isCrawling`)
21. **Risk Level**: `MEDIUM`
22. **Edge Cases & Special Constraints**: Concurrency mutex and post-crawl DB cleanup verified cleanly in tests.
23. **Test Cases Mapped**: `apps/api/tests/authorization/01-rbac-ownership-matrix.test.ts`, `apps/api/tests/api/06-admin-stats-cron.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

---

### 2.10 Platform Statistics & Cron Triggers (`/api/v1/stats`, `/api/v1/cron`)

#### `EP-041` — `GET /api/v1/stats`
1. **Endpoint ID**: `EP-041`
2. **Category / Domain Group**: Platform Statistics
3. **HTTP Method**: `GET`
4. **Full Path**: `/api/v1/stats`
5. **Source Definition Location**: `apps/api/src/routes/stats.ts:6`, `statsController.ts:5-14`, `statsService.ts:15-73`
6. **Summary / Business Purpose**: Returns live platform aggregates (`totalReports`, `activeReports`, `resolvedReports`, `criticalThreats`, `totalCitizens`, `verifiedCitizens`, `safeHavens`, `totalVotes`, `lastActiveAt`, `timestamp`).
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: Public
10. **Required Roles / Permissions**: None
11. **Resource Ownership Rules**: N/A
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: Standard HTTP
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`
17. **Success Response Shape**: `{ success: true, data: PlatformStats }`
18. **Error Response Shapes**: Global error envelope
19. **Side Effects**: Read-only parallel Prisma count queries
20. **Rate Limits / Security Controls**: Public read; zero PII fields
21. **Risk Level**: `LOW`
22. **Edge Cases & Special Constraints**: Counts reflect DB mutations accurately across create/resolve flows.
23. **Test Cases Mapped**: `apps/api/tests/api/06-admin-stats-cron.test.ts`, `apps/api/tests/performance/01-fuzzing-and-load-baseline.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

#### `EP-042` — `GET /api/v1/cron/news-crawl`
1. **Endpoint ID**: `EP-042`
2. **Category / Domain Group**: Cron Triggers
3. **HTTP Method**: `GET`
4. **Full Path**: `/api/v1/cron/news-crawl`
5. **Source Definition Location**: `apps/api/src/routes/cron.ts:36`, `verifyWebhookSecret.ts:59-81`, `cron.ts:10-33`
6. **Summary / Business Purpose**: Scheduler `GET` trigger for automated RSS news crawler (Vercel Cron / Render cron compatibility).
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-001` resolved — `verifyCronSecret` executes before `cronNewsCrawlRateLimiter`)*
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `verifyCronSecret` (`x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`, fail-closed `401`)
10. **Required Roles / Permissions**: Internal scheduler secret holder
11. **Resource Ownership Rules**: N/A
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `x-cron-secret` or `Authorization: Bearer <secret>`
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `401`, `429`, `500`
17. **Success Response Shape**: `{ success: true, data: { message, ...crawlerResult, timestamp } }`
18. **Error Response Shapes**: `401` on unset/missing/wrong `CRON_SECRET`; `429` rate limit
19. **Side Effects**: Runs `triggerNewsCrawler()` on valid secret
20. **Rate Limits / Security Controls**: `verifyCronSecret` (`timingSafeEqual` fail-closed) BEFORE `cronNewsCrawlRateLimiter` (2 req / 10 min per IP)
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: Fails closed `401` when `CRON_SECRET` unset; unauthenticated requests cannot exhaust authenticated IP bucket (`BACKEND-001` resolved).
23. **Test Cases Mapped**: `apps/api/tests/api/06-admin-stats-cron.test.ts`, `apps/api/tests/security/01-owasp-security-checks.test.ts`, `apps/api/tests/regression/01-confirmed-defects-regression.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-001` resolved)

#### `EP-043` — `POST /api/v1/cron/news-crawl`
1. **Endpoint ID**: `EP-043`
2. **Category / Domain Group**: Cron Triggers
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/v1/cron/news-crawl`
5. **Source Definition Location**: `apps/api/src/routes/cron.ts`, `verifyWebhookSecret.ts`
6. **Summary / Business Purpose**: Scheduler `POST` trigger mirror for automated RSS news crawler.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED` *(`BACKEND-001` resolved — `verifyCronSecret` executes before `cronNewsCrawlRateLimiter`)*
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `verifyCronSecret` (`fail-closed 401`)
10. **Required Roles / Permissions**: Internal scheduler secret holder
11. **Resource Ownership Rules**: N/A
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `x-cron-secret` or `Authorization: Bearer <secret>`
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `401`, `429`, `500`
17. **Success Response Shape**: `{ success: true, data: { message, ...crawlerResult, timestamp } }`
18. **Error Response Shapes**: `401` fail-closed; `429` rate limit
19. **Side Effects**: Runs `triggerNewsCrawler()`
20. **Rate Limits / Security Controls**: `verifyCronSecret` BEFORE shared `cronNewsCrawlRateLimiter`
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: Shares IP bucket with `EP-042`; rejects spoofed secrets `401`.
23. **Test Cases Mapped**: `apps/api/tests/api/06-admin-stats-cron.test.ts`, `apps/api/tests/security/01-owasp-security-checks.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS` (`BACKEND-001` resolved)

---

### 2.11 Next.js App Router API Proxies (`apps/web/app/api`)

#### `EP-044` — `GET /api/health` (Next.js Route Handler)
1. **Endpoint ID**: `EP-044`
2. **Category / Domain Group**: Next.js Frontend Proxies
3. **HTTP Method**: `GET`
4. **Full Path**: `/api/health` (in `apps/web`)
5. **Source Definition Location**: `apps/web/app/api/health/route.ts:28-79` (`GET`)
6. **Summary / Business Purpose**: Frontend/Vercel health aggregator probing Express `/health` & `/health/db` in parallel with timeout.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: Public
10. **Required Roles / Permissions**: None
11. **Resource Ownership Rules**: N/A
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: Standard HTTP
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `503` *(if upstream API or DB degraded)*
17. **Success Response Shape**: `{ status: 'healthy', timestamp, totalLatencyMs, services: { frontend, backend, database } }` + `Cache-Control: no-store, max-age=0`
18. **Error Response Shapes**: `503` `{ status: 'degraded', timestamp, totalLatencyMs, services: { frontend, backend, database } }`
19. **Side Effects**: Outbound `fetch` calls to `NEXT_PUBLIC_API_URL`
20. **Rate Limits / Security Controls**: `no-store` caching disabled; sanitized error message
21. **Risk Level**: `LOW`
22. **Edge Cases & Special Constraints**: Verified direct Next.js `GET(request)` against live local Express API server (`200 healthy`) and unreachable port (`503 degraded`).
23. **Test Cases Mapped**: `apps/api/tests/api/01-health-system-proxy.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

#### `EP-045` — `GET /api/cron/news-crawl` (Next.js Route Handler)
1. **Endpoint ID**: `EP-045`
2. **Category / Domain Group**: Next.js Frontend Proxies
3. **HTTP Method**: `GET`
4. **Full Path**: `/api/cron/news-crawl` (in `apps/web`)
5. **Source Definition Location**: `apps/web/app/api/cron/news-crawl/route.ts:55-60` (`GET` delegates to `forwardNewsCrawl`)
6. **Summary / Business Purpose**: Vercel Cron proxy forwarding authenticated `GET` cron invocations as `POST /api/v1/cron/news-crawl` to Express backend.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `CRON_SECRET` (`Bearer <secret>` or `x-cron-secret`, fail-closed `401`)
10. **Required Roles / Permissions**: Cron secret holder
11. **Resource Ownership Rules**: N/A
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `authorization: Bearer <CRON_SECRET>` or `x-cron-secret`
15. **Request Body Schema**: None
16. **Response Status Codes**: `200`, `401`, `502`
17. **Success Response Shape**: Relays Express JSON response `{ success: true, data: ... }`
18. **Error Response Shapes**: `401` if `CRON_SECRET` missing or mismatched (`route.ts:20-27, 44-52`); `502` if Express unreachable
19. **Side Effects**: Outbound `POST` to Express `/api/v1/cron/news-crawl`
20. **Rate Limits / Security Controls**: Fail-closed `401` secret guard
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: Never leaks `CRON_SECRET` in error payloads.
23. **Test Cases Mapped**: `apps/api/tests/api/01-health-system-proxy.test.ts`, `apps/api/tests/security/01-owasp-security-checks.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

#### `EP-046` — `POST /api/cron/news-crawl` (Next.js Route Handler)
1. **Endpoint ID**: `EP-046`
2. **Category / Domain Group**: Next.js Frontend Proxies
3. **HTTP Method**: `POST`
4. **Full Path**: `/api/cron/news-crawl` (in `apps/web`)
5. **Source Definition Location**: `apps/web/app/api/cron/news-crawl/route.ts:55-60` (`POST` -> `forwardNewsCrawl`)
6. **Summary / Business Purpose**: Proxy handler accepting `POST` cron invocations and forwarding them to Express.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: `CRON_SECRET` (`Bearer` or `x-cron-secret`, fail-closed `401`)
10. **Required Roles / Permissions**: Cron secret holder
11. **Resource Ownership Rules**: N/A
12. **Path Parameters & Schema**: None
13. **Query Parameters & Schema**: None
14. **Request Headers Required / Optional**: `authorization` / `x-cron-secret`
15. **Request Body Schema**: Optional/unused
16. **Response Status Codes**: `200`, `401`, `502`
17. **Success Response Shape**: Relays Express JSON response
18. **Error Response Shapes**: `401` when `CRON_SECRET` unset or mismatched, `502` upstream down
19. **Side Effects**: Outbound `POST` to Express `/api/v1/cron/news-crawl`
20. **Rate Limits / Security Controls**: Fail-closed `401` secret guard
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: Parity with `GET` proxy.
23. **Test Cases Mapped**: `apps/api/tests/api/01-health-system-proxy.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

---

### 2.12 Real-Time WebSocket Gateway (`Socket.IO`)

#### `EP-047` — `WS /socket.io` (Socket.IO Gateway)
1. **Endpoint ID**: `EP-047`
2. **Category / Domain Group**: Real-Time WebSocket Gateway
3. **HTTP Method**: `WS / Polling` (Socket.IO v4)
4. **Full Path**: `/socket.io`
5. **Source Definition Location**: `apps/api/src/sockets/socketManager.ts:40-225`
6. **Summary / Business Purpose**: Real-time bidirectional gateway pushing `NEW_REPORT`, `REPORT_VOTED`, `REPORT_PURGED`, `REPORT_EXPIRED`, `REPORT_RESOLVED`, `NEW_REPORT_UPDATE`, `REPORT_VERIFIED`, `STATS_UPDATED` to `live_reports` and targeted `GEOFENCE_ALERT` to `user:<userId>`.
7. **Discovery Status**: `IMPLEMENTED AND DOCUMENTED`
8. **Documentation Match Status**: Aligned with `endpoints.md`
9. **Auth Requirement**: Guest read-only allowed when no token supplied; strict `verifyActiveAccessToken(token, { allowSocketToken: true })` via `auth: { token }` or `accessToken` cookie when supplied
10. **Required Roles / Permissions**: Guest -> `live_reports` only; Authenticated active user -> `live_reports` + `user:<userId>`
11. **Resource Ownership Rules**: User-private `GEOFENCE_ALERT` strictly emitted only to `user:<userId>`
12. **Path Parameters & Schema**: Standard Socket.IO handshake params
13. **Query Parameters & Schema**: `EIO`, `transport`
14. **Request Headers Required / Optional**: Optional `Cookie: accessToken=...`
15. **Request Body Schema**: Client events: `join_map_bounds ({ minLng, minLat, maxLng, maxLat })`, `disconnect`
16. **Response Status Codes**: Handshake `connect` or `connect_error`
17. **Success Response Shape**: Emitted event payloads excluding user PII
18. **Error Response Shapes**: `connect_error` (`Invalid token format`, `Forbidden`, `Unauthorized`)
19. **Side Effects**: Joins `live_reports` & `user:<id>` rooms; stores viewport bounds on `socket.data.bounds`
20. **Rate Limits / Security Controls**: Scoped `socketToken` validation, live DB ban check at handshake
21. **Risk Level**: `HIGH`
22. **Edge Cases & Special Constraints**: Invalid/non-string/tampered/banned tokens rejected with `connect_error`; unauthenticated sockets never join `user:*` rooms.
23. **Test Cases Mapped**: `apps/api/tests/api/07-sockets-realtime.test.ts`, `apps/api/tests/authentication/01-auth-lifecycle.test.ts`, `apps/api/tests/workflows/01-e2e-state-transitions.test.ts`
24. **Actual Testing Status**: `EXECUTED — PASS`

---

## 3. Endpoint Coverage & Traceability Table

| ID | Method & Path | Domain | Auth / Role | Request / Response / Security Tested | Mapped Test Module(s) | Linked Finding(s) | Actual Testing Status |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| `EP-001` | `GET /` | System | Public | Yes / Yes / Yes | `api/01-health-system-proxy.test.ts`, `security/01`, `regression/02` | `BACKEND-009` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-002` | `GET /health` | System | Public | Yes / Yes / Yes | `api/01-health-system-proxy.test.ts`, `performance/01`, `regression/02` | `BACKEND-009` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-003` | `GET /health/db` | System | Public | Yes / Yes / Yes | `api/01-health-system-proxy.test.ts`, `regression/02` | `BACKEND-009` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-004` | `GET /api/v1/health` | System | Public | Yes / Yes / Yes | `api/01-health-system-proxy.test.ts`, `regression/02` | `BACKEND-009` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-005` | `GET /api/v1/health/db` | System | Public | Yes / Yes / Yes | `api/01-health-system-proxy.test.ts`, `regression/02` | `BACKEND-009` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-006` | `POST /api/v1/auth/device` | Auth | Public + RL | Yes / Yes / Yes | `api/02`, `authentication/01`, `regression/01`, `regression/02` | `BACKEND-001`, `BACKEND-008` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-007` | `POST /api/v1/auth/login` | Auth | Public + RL | Yes / Yes / Yes | `api/02`, `authentication/01`, `security/01`, `regression/01`, `regression/02` | `BACKEND-001`, `BACKEND-002`, `BACKEND-003` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-008` | `POST /api/v1/auth/refresh` | Auth | `refreshToken` + RL | Yes / Yes / Yes | `authentication/01`, `api/02`, `regression/01`, `regression/02` | `BACKEND-001`, `BACKEND-002`, `BACKEND-003` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-009` | `POST /api/v1/auth/logout` | Auth | `optionalLogoutAuth` | Yes / Yes / Yes | `authentication/01`, `api/02`, `regression/01`, `regression/02` | `BACKEND-002` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-010` | `GET /api/v1/users/me` | Users | `requireAuth` | Yes / Yes / Yes | `api/02-auth-users.test.ts`, `authentication/01` | — | `EXECUTED — PASS` |
| `EP-011` | `POST /api/v1/users/verify` | Users | `requireAuth` + RL | Yes / Yes / Yes | `api/02-auth-users.test.ts`, `workflows/01`, `regression/02` | `BACKEND-001` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-012` | `POST /api/v1/users/verify/:id/approve` | Users | `ADMIN` | Yes / Yes / Yes | `api/02`, `authorization/01`, `regression/01`, `regression/02` | `BACKEND-007`, `BACKEND-010` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-013` | `POST /api/v1/reports` | Reports | `requireAuth` + RL | Yes / Yes / Yes | `api/03`, `validation/01`, `workflows/01`, `regression/01`, `regression/02` | `BACKEND-004`, `BACKEND-011` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-014` | `GET /api/v1/reports` | Reports | Public | Yes / Yes / Yes | `api/03`, `performance/01`, `regression/01`, `regression/02` | `BACKEND-012` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-015` | `GET /api/v1/reports/:id` | Reports | `optionalAuth` | Yes / Yes / Yes | `api/03`, `security/01` | — | `EXECUTED — PASS` |
| `EP-016` | `PATCH /api/v1/reports/:id/resolve` | Reports | Owner / Responder / Admin | Yes / Yes / Yes | `api/03`, `authorization/01`, `workflows/01` | — | `EXECUTED — PASS` |
| `EP-017` | `POST /api/v1/reports/:id/vote` | Reports | `requireAuth` + RL | Yes / Yes / Yes | `api/03`, `database/01`, `workflows/01`, `regression/01`, `regression/02` | `BACKEND-001`, `BACKEND-007`, `BACKEND-011` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-018` | `POST /api/v1/reports/:id/updates` | Reports | `requireAuth` + RL | Yes / Yes / Yes | `api/03`, `validation/01`, `regression/01`, `regression/02` | `BACKEND-001`, `BACKEND-005` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-019` | `GET /api/v1/reports/:id/updates` | Reports | Public | Yes / Yes / Yes | `api/03` | — | `EXECUTED — PASS` |
| `EP-020` | `GET /api/v1/safe-zones` | Safe Zones | Public | Yes / Yes / Yes | `api/04`, `validation/01`, `performance/01`, `regression/01`, `regression/02` | `BACKEND-006`, `BACKEND-009` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-021` | `POST /api/v1/safe-zones` | Safe Zones | `ADMIN` | Yes / Yes / Yes | `api/04`, `authorization/01`, `validation/01` | — | `EXECUTED — PASS` |
| `EP-022` | `DELETE /api/v1/safe-zones/:id` | Safe Zones | `ADMIN` | Yes / Yes / Yes | `api/04`, `authorization/01` | — | `EXECUTED — PASS` |
| `EP-023` | `POST /api/v1/routes/safe-path` | Routing | Public + RL | Yes / Yes / Yes | `api/04`, `validation/01`, `workflows/01`, `performance/01`, `regression/02` | `BACKEND-001` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-024` | `POST /api/v1/alerts/zones` | Alerts | `requireAuth` | Yes / Yes / Yes | `api/05`, `validation/01`, `workflows/01`, `regression/01` | `BACKEND-014` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-025` | `GET /api/v1/alerts/zones` | Alerts | `requireAuth` | Yes / Yes / Yes | `api/05`, `authorization/01` | — | `EXECUTED — PASS` |
| `EP-026` | `DELETE /api/v1/alerts/zones/:id` | Alerts | Owner | Yes / Yes / Yes | `api/05`, `authorization/01`, `regression/01` | `BACKEND-007` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-027` | `POST /api/v1/alerts/subscribe` | Alerts | `requireAuth` | Yes / Yes / Yes | `api/05`, `validation/01` | — | `EXECUTED — PASS` |
| `EP-028` | `GET /api/v1/media/presigned-url` | Media | Owner / Responder / Admin | Yes / Yes / Yes | `api/05`, `authorization/01`, `validation/01` | — | `EXECUTED — PASS` |
| `EP-029` | `POST /api/v1/media/confirm` | Media | Owner / Responder / Admin | Yes / Yes / Yes | `api/05`, `security/01`, `authorization/01` | — | `EXECUTED — PASS` |
| `EP-030` | `POST /api/v1/media/mock-upload` | Media | Owner / Responder / Admin | Yes / Yes / Yes | `api/05`, `security/01`, `validation/01` | — | `EXECUTED — PASS` |
| `EP-031` | `POST /api/v1/media/webhook` | Media | `x-webhook-secret` | Yes / Yes / Yes | `api/05`, `security/01`, `regression/01` | `BACKEND-009` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-032` | `GET /api/v1/admin/verifications` | Admin | `ADMIN` | Yes / Yes / Yes | `api/06`, `authorization/01` | — | `EXECUTED — PASS` |
| `EP-033` | `POST /api/v1/admin/verifications/:id/approve` | Admin | `ADMIN` | Yes / Yes / Yes | `api/06`, `authorization/01`, `workflows/01` | — | `EXECUTED — PASS` |
| `EP-034` | `POST /api/v1/admin/verifications/:id/reject` | Admin | `ADMIN` | Yes / Yes / Yes | `api/06`, `authorization/01`, `regression/01`, `regression/02` | `BACKEND-010` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-035` | `POST /api/v1/admin/users/:id/ban` | Admin | `ADMIN` | Yes / Yes / Yes | `api/06`, `authentication/01`, `database/01`, `workflows/01`, `regression/01` | `BACKEND-013` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-036` | `POST /api/v1/admin/users/:id/unban` | Admin | `ADMIN` | Yes / Yes / Yes | `api/06`, `authorization/01`, `workflows/01` | — | `EXECUTED — PASS` |
| `EP-037` | `POST /api/v1/admin/reports/:id/purge` | Admin | `ADMIN` | Yes / Yes / Yes | `api/06`, `authorization/01`, `workflows/01` | — | `EXECUTED — PASS` |
| `EP-038` | `GET /api/v1/admin/logs` | Admin | `ADMIN` | Yes / Yes / Yes | `api/06`, `authorization/01`, `regression/01`, `regression/02` | `BACKEND-009`, `BACKEND-010` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-039` | `GET /api/v1/admin/analytics/trends` | Admin | `ADMIN` | Yes / Yes / Yes | `api/06`, `authorization/01`, `regression/02` | `BACKEND-009` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-040` | `POST /api/v1/admin/news/crawl` | Admin | `ADMIN` | Yes / Yes / Yes | `authorization/01`, `api/06` | — | `EXECUTED — PASS` |
| `EP-041` | `GET /api/v1/stats` | Stats | Public | Yes / Yes / Yes | `api/06`, `performance/01` | — | `EXECUTED — PASS` |
| `EP-042` | `GET /api/v1/cron/news-crawl` | Cron | `CRON_SECRET` + RL | Yes / Yes / Yes | `api/06`, `security/01`, `regression/01` | `BACKEND-001` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-043` | `POST /api/v1/cron/news-crawl` | Cron | `CRON_SECRET` + RL | Yes / Yes / Yes | `api/06`, `security/01`, `regression/02` | `BACKEND-001` (`FIXED AND VERIFIED`) | `EXECUTED — PASS` |
| `EP-044` | `GET /api/health` (Next.js) | Proxy | Public | Yes / Yes / Yes | `api/01-health-system-proxy.test.ts` | — | `EXECUTED — PASS` |
| `EP-045` | `GET /api/cron/news-crawl` (Next.js) | Proxy | `CRON_SECRET` | Yes / Yes / Yes | `api/01-health-system-proxy.test.ts`, `security/01` | — | `EXECUTED — PASS` |
| `EP-046` | `POST /api/cron/news-crawl` (Next.js) | Proxy | `CRON_SECRET` | Yes / Yes / Yes | `api/01-health-system-proxy.test.ts` | — | `EXECUTED — PASS` |
| `EP-047` | `WS /socket.io` | Real-Time | Guest / `socketToken` | Yes / Yes / Yes | `api/07-sockets-realtime.test.ts`, `authentication/01`, `workflows/01` | — | `EXECUTED — PASS` |
