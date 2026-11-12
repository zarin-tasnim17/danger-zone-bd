# DangerZoneBD Backend API & Socket.IO Reference

Complete reference for the DangerZoneBD Express REST API (`/api/v1`), Socket.IO real-time gateway, and automated background workers.

---

## Table of Contents

1. [Overview, Envelopes & Global Middleware](#1-overview-envelopes--global-middleware)
2. [Authentication, Security & Domain Rules](#2-authentication-security--domain-rules)
3. [REST API Endpoints (43 Express + 3 Next.js Proxy Routes)](#3-rest-api-endpoints)
   - [3.1 System & Health](#31-system--health)
   - [3.2 Authentication (`/api/v1/auth`)](#32-authentication-apiv1auth)
   - [3.3 Users & Verification (`/api/v1/users`)](#33-users--verification-apiv1users)
   - [3.4 Crime & Hazard Reports (`/api/v1/reports`)](#34-crime--hazard-reports-apiv1reports)
   - [3.5 Verified Safe Zones (`/api/v1/safe-zones`)](#35-verified-safe-zones-apiv1safe-zones)
   - [3.6 Safe-Path Routing (`/api/v1/routes`)](#36-safe-path-routing-apiv1routes)
   - [3.7 Geofenced Alerts (`/api/v1/alerts`)](#37-geofenced-alerts-apiv1alerts)
   - [3.8 Media & Privacy Auto-Blurring (`/api/v1/media`)](#38-media--privacy-auto-blurring-apiv1media)
   - [3.9 Admin Moderation & Analytics (`/api/v1/admin`)](#39-admin-moderation--analytics-apiv1admin)
   - [3.10 Platform Statistics (`/api/v1/stats`)](#310-platform-statistics-apiv1stats)
   - [3.11 Cron Triggers (`/api/v1/cron`)](#311-cron-triggers-apiv1cron)
   - [3.12 Next.js App Router API Proxies (`apps/web/app/api`)](#312-nextjs-app-router-api-proxies-appswebappapi)
4. [Real-Time WebSocket Gateway (Socket.IO)](#4-real-time-websocket-gateway-socketio)
5. [Automated Background Workers & Cron Jobs](#5-automated-background-workers--cron-jobs)
6. [Complete Endpoints Summary Table](#6-complete-endpoints-summary-table)

---

## 1. Overview, Envelopes & Global Middleware

| Environment | Base URL | WebSocket URL |
| :--- | :--- | :--- |
| **Local Development** | `http://127.0.0.1:5000/api/v1` | `ws://127.0.0.1:5000` |
| **Production (Render)** | `https://danger-zone-bd.onrender.com/api/v1` | `wss://danger-zone-bd.onrender.com` |
| **Production Frontend (Vercel)** | `https://danger-zone-bd-snowy.vercel.app` | — |

- **Base URL**: `/api/v1` (plus root metadata `GET /`, `/health`, and `/health/db`)
- **Global Express Middleware** (`apps/api/src/app.ts`):
  - `helmet()`
  - `cors({ origin, credentials: true })` driven by `CORS_ORIGIN`
  - `morgan('dev')`
  - `express.json()` and `express.urlencoded({ extended: true })`
  - `cookieParser()`

### Standard Success Envelope

```json
{
  "success": true,
  "data": {}
}
```

### Standard Error Envelope

Standard Express handlers and Zod `validateRequest` return:

```json
{
  "success": false,
  "error": {
    "message": "Human-readable error description"
  }
}
```

*(Specialized error responses also include an `error.code`: `429 RATE_LIMIT_EXCEEDED`, `415 UNSUPPORTED_MEDIA_TYPE` on `/api/v1/media`, and `503 DB_ERROR` on `/health/db`.)*

### Rate Limit Error (`429 Too Many Requests`)

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Too many requests from this IP. Please try again in 420 seconds.",
    "retryAfterSeconds": 420
  }
}
```

---

## 2. Authentication, Security & Domain Rules

### 2.1 Token Architecture

- **`accessToken`** (`15m` expiry, `tokenUse: 'access'`): Issued in an `HttpOnly` cookie and accepted by REST middleware (`requireAuth`, `optionalAuth`) via either `req.cookies.accessToken` or the `Authorization: Bearer <token>` request header.
- **`refreshToken`** (`7d` expiry): Issued in an `HttpOnly` cookie and stored in PostgreSQL (`RefreshToken`) so sessions can be revoked atomically (e.g., on logout or admin ban).
- **`socketToken`** (`15m` expiry, `tokenUse: 'socket'`): Returned in the JSON response body of `POST /api/v1/auth/device`, `POST /api/v1/auth/login`, and `POST /api/v1/auth/refresh` for cross-origin Socket.IO handshakes (`auth: { token: socketToken }`). `socketToken` is accepted by Socket.IO (`allowSocketToken: true`) and rejected on REST API `requireAuth` routes (`tokenUse !== 'access'`).
- **Live Account Validation**: `verifyActiveAccessToken` queries PostgreSQL on every protected request so suspended (`isBanned: true` -> `403`) or deleted (`401`) accounts are rejected immediately.

### 2.2 Cookie Flags

Both `accessToken` and `refreshToken` cookies are set with:

- `httpOnly: true`
- `secure: env.NODE_ENV === 'production'`
- `sameSite: 'lax'`
- `maxAge`: `900000` (15 minutes) for `accessToken`; `604800000` (7 days) for `refreshToken`

### 2.3 Privacy-by-Design & Spatial / Media Handling

- **Exact Coordinates with Privacy Ring Hint (`spatialUtils.getFuzzedCoordinates`)**: Reports preserve exact coordinates rounded to 6 decimal places (`0` positional offset) and return `fuzzedRadiusMeters: 150` as a visual uncertainty/privacy ring radius.
- **PII Stripping**: Public report queries and Socket.IO broadcasts omit `userId`, IP addresses, and device fingerprints. `isOwner` is returned as a boolean only when `GET /api/v1/reports/:id` or `PATCH /api/v1/reports/:id/resolve` matches the authenticated viewer.
- **Media Redaction (`ReportMedia`)**: Public responses from media confirmation, mock upload, and report detail endpoints strip `originalUrl` and expose only `blurredUrl`.

### 2.4 Role-Based Access Control (`RBAC`)

Prisma `Role` enum values enforced by `requireRole([...])`:

| Role | Description |
| :--- | :--- |
| `USER` | Default role for anonymous/device accounts. Subject to the 15-minute cooldown between citizen report submissions. |
| `VERIFIED_RESPONDER` | Citizens promoted after KYC approval (`PHONE_OTP` or `NID_DOCUMENT`). Can attach media and resolve reports; exempt from the 15-minute citizen report cooldown. |
| `ADMIN` | Full moderation, safe-zone management, analytics, news crawler trigger, and verification approval/rejection privileges. KYC approval preserves `ADMIN` role if the account is already `ADMIN`. |

### 2.5 Rate Limiting

| Limiter | Applied To | Limit |
| :--- | :--- | :--- |
| `authLoginRateLimiter` | `POST /api/v1/auth/login` | Max **10** requests per **15 minutes** per IP |
| `authDeviceRateLimiter` | `POST /api/v1/auth/device` | Max **20** requests per **15 minutes** per IP |
| `authRefreshRateLimiter` | `POST /api/v1/auth/refresh` | Max **30** requests per **15 minutes** per IP |
| `reportCreationRateLimiter` | `POST /api/v1/reports` | Max **5** requests per **1 hour** per IP (+ 15-minute DB cooldown for `USER` accounts) |
| `reportVoteRateLimiter` | `POST /api/v1/reports/:id/vote` | Max **60** requests per **15 minutes** per IP |
| `reportUpdateRateLimiter` | `POST /api/v1/reports/:id/updates` | Max **20** requests per **15 minutes** per IP |
| `userVerifyRateLimiter` | `POST /api/v1/users/verify` | Max **10** requests per **15 minutes** per IP |
| `safeRouteRateLimiter` | `POST /api/v1/routes/safe-path` | Max **120** requests per **1 minute** per IP |
| `cronNewsCrawlRateLimiter` | `GET` & `POST /api/v1/cron/news-crawl` | Max **2** requests per **10 minutes** per IP (runs *after* `verifyCronSecret`) |

### 2.6 Shared Domain Enums

- **`ReportCategory`**: `THEFT`, `ROBBERY`, `THEFT_ROBBERY`, `SNATCHING`, `ARMED_ASSAULT`, `SNATCHING_ARMED_ASSAULT`, `EXTORTION`, `YOUTH_GANG_ACTIVITY`, `DRUG_RELATED_CRIME`, `UNLIT_ROAD`, `ROAD_ACCIDENT`, `MUGGING`, `DACOITY`, `THEFT_DACOITY`, `TEEN_GANG`, `TEEN_GANG_ARMED_ASSAULT`, `DRUG_ACTIVITY`
- **`ReportSeverity`**: `LOW`, `MEDIUM`, `HIGH`
- **`ReportStatus`**: `ACTIVE`, `RESOLVED`, `PURGED`
- **`SafeZoneType`**: `HOSPITAL`, `POLICE_BOX`, `PHARMACY`
- **`VerificationType`**: `PHONE_OTP`, `NID_DOCUMENT`
- **`ModerationAction`**: `BAN_USER`, `UNBAN_USER`, `PURGE_REPORT`, `VERIFY_USER`, `REJECT_VERIFICATION`

---

## 3. REST API Endpoints

### 3.1 System & Health

#### `GET /`

- **Auth**: Public
- **Response (`200 OK`)**: Standard `{ success, data }` envelope containing API identity metadata:
  ```json
  {
    "success": true,
    "data": {
      "name": "BD Safety Map API",
      "status": "online",
      "version": "1.0.0",
      "endpoints": {
        "health": "/health",
        "dbHealth": "/health/db",
        "stats": "/api/v1/stats",
        "reports": "/api/v1/reports",
        "safeZones": "/api/v1/safe-zones",
        "safeRouting": "/api/v1/routes/safe-path",
        "auth": "/api/v1/auth",
        "media": "/api/v1/media",
        "alerts": "/api/v1/alerts",
        "admin": "/api/v1/admin",
        "cron": "/api/v1/cron/news-crawl"
      }
    }
  }
  ```

#### `GET /health` & `GET /api/v1/health`

- **Auth**: Public
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "API is running",
    "data": {
      "status": "UP",
      "message": "API is running"
    }
  }
  ```

#### `GET /health/db` & `GET /api/v1/health/db`

- **Auth**: Public
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Database connection successful",
    "data": {
      "status": "UP",
      "database": "connected",
      "message": "Database connection successful"
    }
  }
  ```
- **Error (`503 Service Unavailable`)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "DB_ERROR",
      "message": "Database connection failed"
    }
  }
  ```

---

### 3.2 Authentication (`/api/v1/auth`)

#### `POST /api/v1/auth/device`

Registers or authenticates an anonymous `USER` device session. Protected by `authDeviceRateLimiter` (20 attempts / 15 min per IP). Strictly blocks privileged (`ADMIN` / `VERIFIED_RESPONDER`), password-backed (`passwordHash != null`), or suspended accounts with `403`.

- **Auth**: Public
- **Request Body**:
  ```json
  {
    "anonymousId": "dev-fp-a1b2c3d4",
    "email": "citizen@example.com"
  }
  ```
  *(Note: `email` is optional; defaults to `<anonymousId>@anonymous.local` on new device creation.)*
- **Side Effects**: Sets `accessToken` and `refreshToken` `HttpOnly` cookies (`sameSite: 'lax'`).
- **Response (`201 Created` on initial device registration, `200 OK` on repeat sign-in)**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "uuid",
        "role": "USER"
      },
      "socketToken": "<jwt-socket-token>"
    }
  }
  ```
- **Errors**: `403` if account is privileged/password-protected or suspended (also clears auth cookies when suspended); `429` when rate-limited.

#### `POST /api/v1/auth/login`

Password authentication endpoint for `ADMIN` and password-protected accounts. Protected by `authLoginRateLimiter` (10 attempts / 15 min per IP).

- **Auth**: Public
- **Request Body**:
  ```json
  {
    "email": "admin@safety.bd",
    "password": "StrongPassword123"
  }
  ```
- **Side Effects**: Sets `accessToken` and `refreshToken` `HttpOnly` cookies (`sameSite: 'lax'`). `refreshToken` is never exposed in the JSON body.
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "uuid",
        "email": "admin@safety.bd",
        "role": "ADMIN",
        "isVerified": true,
        "trustScore": 100
      },
      "accessToken": "<jwt-access-token>",
      "socketToken": "<jwt-socket-token>"
    }
  }
  ```
- **Errors**: `401` on invalid credentials or suspended account; `429` when rate-limited.

#### `POST /api/v1/auth/refresh`

Single-use session refresh endpoint protected by `authRefreshRateLimiter` (30 requests / 15 min per IP). Atomically revokes the consumed `RefreshToken` record in PostgreSQL, issues a rotated `refreshToken` + `accessToken` `HttpOnly` cookie pair, and returns a fresh `socketToken`. Replaying a revoked refresh token returns `401`.

- **Auth**: `refreshToken` HttpOnly cookie
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "socketToken": "<jwt-socket-token>"
    }
  }
  ```
- **Errors**: `401` if cookie is missing, token is revoked/expired/replayed, or account is missing/banned; `429` when rate-limited.

#### `POST /api/v1/auth/logout`

Revokes the current session's `refreshToken` in PostgreSQL (if cookie present) and clears `accessToken` and `refreshToken` cookies. Accepts valid or expired (signature-verified) `accessToken` sessions or a `refreshToken` cookie.

- **Auth**: `optionalLogoutAuth` (`accessToken` or `refreshToken`)
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {}
  }
  ```

---

### 3.3 Users & Verification (`/api/v1/users`)

#### `GET /api/v1/users/me`

Returns the currently authenticated user's profile, activity counts, and latest verification status.

- **Auth**: `requireAuth`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "email": "citizen@example.com",
      "role": "USER",
      "isVerified": false,
      "trustScore": 3,
      "isBanned": false,
      "createdAt": "2026-11-12T08:00:00.000Z",
      "_count": {
        "reports": 2,
        "votes": 5,
        "alertZones": 1
      },
      "verifications": [
        {
          "id": "uuid",
          "type": "PHONE_OTP",
          "status": "PENDING",
          "phoneNumber": "+8801712345678",
          "createdAt": "2026-11-12T08:15:00.000Z"
        }
      ]
    }
  }
  ```

#### `POST /api/v1/users/verify`

Submits a KYC verification request (`PHONE_OTP` or `NID_DOCUMENT`). Protected by `userVerifyRateLimiter` (10 requests / 15 min per IP). Suspended users (`403`) or users with an existing `PENDING` verification (`400`) are rejected.

- **Auth**: `requireAuth`
- **Request Body (`PHONE_OTP`)**:
  ```json
  {
    "type": "PHONE_OTP",
    "phoneNumber": "01712345678"
  }
  ```
  *(Requires a valid Bangladesh mobile number accepted by `BD_MOBILE_REGEX`; normalized via `normalizeBangladeshPhone`.)*
- **Request Body (`NID_DOCUMENT`)**:
  ```json
  {
    "type": "NID_DOCUMENT",
    "documentUrl": "https://cdn.example.com/kyc/nid-front.jpg"
  }
  ```
- **Response (`201 Created`)**: Returns the created `UserVerification` record.

#### `POST /api/v1/users/verify/:id/approve`

*(Legacy compatibility alias for `POST /api/v1/admin/verifications/:id/approve`.)* Approves a pending verification request, sets `isVerified: true`, upgrades `USER` -> `VERIFIED_RESPONDER` (preserving `ADMIN` if already `ADMIN`), and writes an immutable `VERIFY_USER` entry in `ModerationLog`. Validates `:id` as UUID (`400`) and returns `404` if not found.

- **Auth**: `requireAuth`, `requireRole(['ADMIN'])`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "userId": "uuid",
      "role": "VERIFIED_RESPONDER"
    }
  }
  ```

---

### 3.4 Crime & Hazard Reports (`/api/v1/reports`)

#### `POST /api/v1/reports`

Creates a new citizen safety report, persists its PostGIS point, broadcasts `NEW_REPORT` and `STATS_UPDATED` via Socket.IO, and enqueues geofenced alert checks if `severity === 'HIGH'`.

- **Auth**: `requireAuth`
- **Rate Limit**: `reportCreationRateLimiter` (max 5/hour/IP) + 15-minute DB cooldown for `USER` role.
- **Optional Device GPS Headers** (validated against `MAX_GPS_PROXIMITY_METERS = 200` and `MAX_HARDWARE_GPS_ACCURACY_METERS` when `x-device-lat` and `x-device-lng` are provided):
  - `x-device-lat`, `x-device-lng`
  - `x-device-accuracy`
  - `x-gps-source`: `'hardware' | 'manual'` (`isGpsVerified` is `true` only when unmodified hardware GPS within accuracy threshold backs the check)
- **Request Body** (`description` is trimmed and bounded to `1..1000` characters):
  ```json
  {
    "category": "SNATCHING",
    "severity": "HIGH",
    "latitude": 23.7465,
    "longitude": 90.376,
    "description": "Two individuals snatched a phone near the bus stop."
  }
  ```
- **Response (`201 Created`)**: Returns the sanitized `Report` (reporter `userId` PII omitted) with `latitude`, `longitude`, and `fuzzedRadiusMeters: 150`.
- **Errors**: `400` if coordinates fail proximity (>200m) or validation (`description` empty or > 1000 chars), `403` if suspended, `429` if IP or `USER` cooldown rate-limited.

#### `GET /api/v1/reports`

Queries active, non-expired reports inside a PostGIS map bounding box (`ST_MakeEnvelope`) with optional filters.

- **Auth**: Public
- **Query Parameters**:
  - `minLng`, `minLat`, `maxLng`, `maxLat` (required finite geographic bounds with `minLng < maxLng` and `minLat < maxLat`; `-180..180` / `-90..90`)
  - `category` (optional `ReportCategory`)
  - `severity` (optional `ReportSeverity`)
  - `isNightReport` (optional `'true' | 'false'`)
- **Response (`200 OK`)**: Array of sanitized active reports (no `userId`), each with `fuzzedRadiusMeters: 150`.
- **Errors**: `400` on invalid/non-numeric or inverted bounds.

#### `GET /api/v1/reports/:id`

Fetches full details for a single report, including sanitized `media` (`blurredUrl` only; `originalUrl` excluded) and `isOwner`.

- **Auth**: `optionalAuth` (computes `isOwner` if authenticated)
- **Response (`200 OK`)**: Sanitized report details object with `latitude`, `longitude`, `fuzzedRadiusMeters: 150`, `isOwner`, and media metadata.

#### `PATCH /api/v1/reports/:id/resolve`

Marks an active report as `RESOLVED` and broadcasts `REPORT_RESOLVED` and `STATS_UPDATED`. Allowed only for the report author, `VERIFIED_RESPONDER`, or `ADMIN`.

- **Auth**: `requireAuth`
- **Response (`200 OK`)**: Updated sanitized report with `status: "RESOLVED"`, `fuzzedRadiusMeters: 150`, and `isOwner`.
- **Errors**: `400` if already `RESOLVED` or `PURGED`; `403` if caller is neither author nor `ADMIN`/`VERIFIED_RESPONDER`; `404` if not found.

#### `POST /api/v1/reports/:id/vote`

Casts an upvote (`1`) or downvote (`-1`) on a report. Protected by `reportVoteRateLimiter` (60 requests / 15 min per IP). Automatically increments the creator's `trustScore` on upvotes, and auto-purges (`status: 'PURGED'`, emits `REPORT_PURGED`, decrements creator `trustScore`) when `downvotes >= 5`.

- **Auth**: `requireAuth`
- **Request Body**:
  ```json
  {
    "voteType": 1
  }
  ```
- **Response (`201 Created`)**: Updated sanitized `Report` record (reporter `userId` PII omitted) reflecting new `upvotes`, `downvotes`, and `status`.
- **Errors**: `400` on self-vote, duplicate vote, or purged report; `403` if voter account is suspended; `404` if report is not found; `429` when rate-limited.

#### `POST /api/v1/reports/:id/updates`

Appends a threaded context update (`content` trimmed, `2..500` characters) to a non-purged report and broadcasts `NEW_REPORT_UPDATE` over Socket.IO. Protected by `reportUpdateRateLimiter` (20 requests / 15 min per IP).

- **Auth**: `requireAuth`
- **Request Body**:
  ```json
  {
    "content": "Police patrol has arrived at the intersection."
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "reportId": "uuid",
      "content": "Police patrol has arrived at the intersection.",
      "createdAt": "2026-11-12T10:05:00.000Z",
      "author": {
        "isVerified": true,
        "role": "VERIFIED_RESPONDER",
        "alias": "Verified Responder"
      }
    }
  }
  ```

#### `GET /api/v1/reports/:id/updates`

Lists chronological context updates for an existing, non-purged report.

- **Auth**: Public
- **Response (`200 OK`)**: Array of sanitized update objects ordered by `createdAt ASC`.
- **Errors**: `404` if report does not exist or is `PURGED`.

---

### 3.5 Verified Safe Zones (`/api/v1/safe-zones`)

#### `GET /api/v1/safe-zones`

Fetches verified safe havens (`HOSPITAL`, `POLICE_BOX`, `PHARMACY`) within a bounding box (`minLng`, `minLat`, `maxLng`, `maxLat`), within radial distance (`lat`, `lng`, optional `radius` defaulting to `5000` meters), or across default Bangladesh bounds (`88.0..93.0`, `20.5..27.0`) when no spatial filters are supplied. Automatically seeds default Bangladesh safe zones if the table is empty.

- **Auth**: Public
- **Query Parameters**:
  - Bounding-box mode: strict finite numeric `minLng`, `minLat`, `maxLng`, `maxLat` (`minLng < maxLng`, `minLat < maxLat`), optional `type` (`SafeZoneType`)
  - Radial mode: strict finite numeric `lat`, `lng`, optional positive `radius` (meters, default `5000`), optional `type` (`SafeZoneType`)
- **Response (`200 OK`)**: Array of safe zones (`id`, `type`, `name`, `latitude`, `longitude`, plus numeric `distanceMeters` (`number`) in radial mode or `createdAt` in bounds mode).
- **Errors**: `400` on non-numeric, partial, or out-of-range spatial query parameters.

#### `POST /api/v1/safe-zones`

Creates and persists a verified safe haven with its PostGIS geography column.

- **Auth**: `requireAuth`, `requireRole(['ADMIN'])`
- **Request Body**:
  ```json
  {
    "name": "Dhanmondi Police Box",
    "type": "POLICE_BOX",
    "latitude": 23.7461,
    "longitude": 90.3742
  }
  ```
- **Response (`201 Created`)**: Created safe zone (`id`, `type`, `name`, `latitude`, `longitude`, `createdAt`).

#### `DELETE /api/v1/safe-zones/:id`

Deletes a safe zone by ID.

- **Auth**: `requireAuth`, `requireRole(['ADMIN'])`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "deleted": true,
      "name": "Dhanmondi Police Box"
    }
  }
  ```
- **Errors**: `404` if safe zone does not exist.

---

### 3.6 Safe-Path Routing (`/api/v1/routes`)

#### `POST /api/v1/routes/safe-path`

Computes a safety-adjusted polyline route inside Bangladesh boundaries (`lat` 20.3–26.8, `lng` 87.8–92.9) that detours orthogonally around active corridor reports (`HIGH` = 500m, `MEDIUM` = 250m, `LOW` = 120m buffer). Protected by `safeRouteRateLimiter` (120 requests / 1 min per IP).

- **Auth**: Public
- **Request Body** (`.strict()`):
  ```json
  {
    "startLat": 23.7465,
    "startLng": 90.376,
    "endLat": 23.758,
    "endLng": 90.39
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "origin": [23.7465, 90.376],
      "destination": [23.758, 90.39],
      "directDistanceMeters": 1915,
      "safeDistanceMeters": 2240,
      "safetyRating": "HIGH_SAFETY",
      "bypassedHazardsCount": 1,
      "bypassedHazards": [
        {
          "id": "uuid",
          "category": "SNATCHING",
          "severity": "HIGH",
          "latitude": 23.752,
          "longitude": 90.383,
          "distanceFromRouteMeters": 85
        }
      ],
      "waypoints": [
        [23.7465, 90.376],
        [23.7568, 90.3792],
        [23.758, 90.39]
      ]
    }
  }
  ```
  *(`safetyRating` is `"CLEAR"` when `bypassedHazardsCount === 0`, or `"HIGH_SAFETY"` when hazards were detoured.)*

---

### 3.7 Geofenced Alerts (`/api/v1/alerts`)

#### `POST /api/v1/alerts/zones`

Creates a PostGIS geofenced monitoring polygon (`UserAlertZone`). Enforces closed GeoJSON ring validation, PostGIS topological validity (`ST_IsValid`, rejecting self-intersecting polygons with `400`), WGS84 bounds, max **5** active zones per user, and a **25 km²** maximum geodesic area cap.

- **Auth**: `requireAuth`
- **Request Body**:
  ```json
  {
    "name": "Dhanmondi Commute",
    "coordinates": [
      [90.37, 23.74],
      [90.38, 23.74],
      [90.38, 23.75],
      [90.37, 23.75],
      [90.37, 23.74]
    ]
  }
  ```
- **Response (`201 Created`)**: `{ id, userId, name, isActive, createdAt, updatedAt, area }` (parsed GeoJSON polygon).

#### `GET /api/v1/alerts/zones`

Lists all active geofenced alert zones belonging to the authenticated user.

- **Auth**: `requireAuth`
- **Response (`200 OK`)**: Array of `AlertZoneOutput` items.

#### `DELETE /api/v1/alerts/zones/:id`

Deletes one of the authenticated user's alert zones.

- **Auth**: `requireAuth`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Alert zone deleted successfully"
    }
  }
  ```

#### `POST /api/v1/alerts/subscribe`

Registers/acknowledges a Web Push subscription contract for the authenticated user.

- **Auth**: `requireAuth`
- **Request Body** (`keys` optional):
  ```json
  {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "subscribed": true,
      "userId": "uuid"
    }
  }
  ```

---

### 3.8 Media & Privacy Auto-Blurring (`/api/v1/media`)

Note: `/api/v1/media` rejects `multipart/form-data` payloads with **`415 Unsupported Media Type`**. Uploads use direct-to-object-storage presigned URLs or the inline fallback when S3 is unconfigured.

#### `GET /api/v1/media/presigned-url`

Issues an S3/R2/Supabase Storage presigned `PUT` URL (or `isMock: true` indicator when S3 credentials are absent) for report owners, `VERIFIED_RESPONDER`, or `ADMIN`.

- **Auth**: `requireAuth`
- **Query Parameters**:
  - `reportId` (UUID)
  - `fileType`: `'image/jpeg' | 'image/png' | 'image/webp'`
  - `fileSize`: integer bytes, max `5242880` (5 MB)
- **Response (`200 OK`)**: `{ uploadUrl, fileKey, publicUrl, expiresInSeconds, isMock }`

#### `POST /api/v1/media/confirm`

Confirms an uploaded object (`fileKey` or trusted `originalUrl`), inserts `ReportMedia`, runs `processPrivacyBlur`, and returns sanitized metadata without exposing `originalUrl`.

- **Auth**: `requireAuth` (report owner, `VERIFIED_RESPONDER`, or `ADMIN`)
- **Request Body**:
  ```json
  {
    "reportId": "uuid",
    "fileKey": "reports/<reportId>/<uuid>.jpg"
  }
  ```
- **Response (`201 Created` or `200 OK` if idempotent)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "reportId": "uuid",
      "blurredUrl": "https://...",
      "createdAt": "2026-11-12T10:10:00.000Z"
    }
  }
  ```

#### `POST /api/v1/media/mock-upload`

Authenticated fallback when S3 credentials are **not** configured (`isS3Configured() === false`). Accepts a compressed JPEG/PNG/WebP base64 data URI (<= 512 KB decoded), validates magic bytes, runs `processPrivacyBlur`, and stores `ReportMedia`.

- **Auth**: `requireAuth` (report owner, `VERIFIED_RESPONDER`, or `ADMIN`)
- **Request Body**:
  ```json
  {
    "reportId": "uuid",
    "imageDataUrl": "data:image/jpeg;base64,/9j/4AAQ..."
  }
  ```
- **Response (`201 Created` or `200 OK` if already persisted)**: `{ id, reportId, blurredUrl, createdAt }`
- **Errors**: `409 Conflict` if S3 storage is configured; `400` on invalid image/size; `403`/`404` on report auth failure.

#### `POST /api/v1/media/webhook`

Server-to-server callback supporting S3 `ObjectCreated` event batches and Supabase Storage `INSERT` payloads. Strictly fails closed (`401`) whenever `STORAGE_WEBHOOK_SECRET` is unset, empty, missing, or mismatched against the `x-webhook-secret` header. Optionally filters by `STORAGE_WEBHOOK_BUCKET`.

- **Auth**: `verifyStorageWebhookSecret` (`x-webhook-secret` header)
- **Request Body** (must include `Records`, `record`, or `key`):
  ```json
  {
    "Records": [
      {
        "eventName": "ObjectCreated:Put",
        "s3": {
          "bucket": { "name": "dangerzone-media" },
          "object": { "key": "reports/<reportId>/<uuid>.jpg" }
        }
      }
    ]
  }
  ```
  *(Also accepts Supabase Storage format `{ "type": "INSERT", "record": { "bucket_id": "...", "name": "reports/<reportId>/<uuid>.jpg" } }` and direct key payload `{ "key": "reports/<reportId>/<uuid>.jpg" }`.)*
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "received": true
    }
  }
  ```

---

### 3.9 Admin Moderation & Analytics (`/api/v1/admin`)

All endpoints under `/api/v1/admin` require **`requireAuth`** + **`requireRole(['ADMIN'])`**.

#### `GET /api/v1/admin/verifications`

Lists all `PENDING` user KYC verification requests ordered oldest-first (`createdAt ASC`), including associated user info (`id`, `email`, `phoneNumber`, `role`, `trustScore`, `createdAt`).

- **Auth**: `ADMIN`
- **Response (`200 OK`)**: Array of `UserVerification` rows with nested `user`.

#### `POST /api/v1/admin/verifications/:id/approve`

Approves a pending verification request, sets `isVerified: true`, promotes `USER` -> `VERIFIED_RESPONDER` (preserving `ADMIN`), and logs `VERIFY_USER` in `ModerationLog`.

- **Auth**: `ADMIN`
- **Response (`200 OK`)**: Returns the updated user record (`id`, `anonymousId`, `email`, `role`, `isVerified`, `trustScore`, `isBanned`, `createdAt`, `updatedAt`).
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "anonymousId": "dev-fp-a1b2c3d4",
      "email": "citizen@example.com",
      "role": "VERIFIED_RESPONDER",
      "isVerified": true,
      "trustScore": 3,
      "isBanned": false,
      "createdAt": "2026-11-12T08:00:00.000Z",
      "updatedAt": "2026-11-12T10:00:00.000Z"
    }
  }
  ```

#### `POST /api/v1/admin/verifications/:id/reject`

Rejects a pending verification request and records an immutable `REJECT_VERIFICATION` entry in `ModerationLog`.

- **Auth**: `ADMIN`
- **Request Body** (`reason` required, 3–500 chars): `{ "reason": "Document unreadable" }`
- **Response (`200 OK`)**: Updated `UserVerification` record with `status: "REJECTED"`.

#### `POST /api/v1/admin/users/:id/ban`

Suspends a non-admin user (`isBanned: true`), revokes all active `RefreshToken` rows, logs `BAN_USER` in `ModerationLog`, and broadcasts `STATS_UPDATED`. Forbids self-banning and suspending peer `ADMIN` accounts (`403 Forbidden`).

- **Auth**: `ADMIN`
- **Request Body** (`reason` required, 3–500 chars): `{ "reason": "Repeated spam submissions" }`
- **Response (`200 OK`)**: `{ "user": { id, email, role, isVerified, trustScore, isBanned, createdAt }, "log": { ... } }`
- **Errors**: `403` when targeting self or any `ADMIN` user.

#### `POST /api/v1/admin/users/:id/unban`

Restores a banned user (`isBanned: false`), logs `UNBAN_USER` in `ModerationLog`, and broadcasts `STATS_UPDATED`.

- **Auth**: `ADMIN`
- **Request Body** (`reason` required, 3–500 chars): `{ "reason": "Appeal verified" }`
- **Response (`200 OK`)**: `{ "user": { id, email, role, isVerified, trustScore, isBanned, createdAt }, "log": { ... } }`

#### `POST /api/v1/admin/reports/:id/purge`

Manually purges an incident (`status: 'PURGED'`), logs `PURGE_REPORT`, emits `REPORT_PURGED`, and broadcasts `STATS_UPDATED`.

- **Auth**: `ADMIN`
- **Request Body** (`reason` required, 3–500 chars): `{ "reason": "Duplicate or fabricated incident" }`
- **Response (`200 OK`)**: `{ "report": { ... }, "log": { ... } }`

#### `GET /api/v1/admin/logs`

Returns paginated `ModerationLog` audit entries (`admin`, `targetUser`, `targetReport` relations included).

- **Auth**: `ADMIN`
- **Query Parameters** (strictly validated; rejects out-of-range or unknown query params with `400`): `page` (positive integer >= `1`, default `1`), `limit` (integer `1..100`, default `20`), `action` (optional `ModerationAction` enum filter)
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "logs": [],
      "pagination": {
        "total": 12,
        "page": 1,
        "limit": 20,
        "totalPages": 1
      }
    }
  }
  ```

#### `GET /api/v1/admin/analytics/trends`

Aggregates 30-day temporal crime & hazard trends, day-vs-night breakdown, and distributions by category, severity, and status.

- **Auth**: `ADMIN`
- **Query Parameters**: None (`timeframe` is fixed to `30_DAYS`; unexpected query params are rejected with `400`)
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "timeframe": "30_DAYS",
      "startDate": "2026-10-13T10:00:00.000Z",
      "totalReports": 42,
      "nightReportsCount": 18,
      "nightReportPercentage": 42.9,
      "breakdown": {
        "byCategory": { "SNATCHING": 12, "ROAD_ACCIDENT": 9 },
        "bySeverity": { "HIGH": 15, "MEDIUM": 20, "LOW": 7 },
        "byStatus": { "ACTIVE": 30, "RESOLVED": 8, "PURGED": 4 }
      },
      "timeline": [
        { "date": "2026-11-12", "count": 6 }
      ]
    }
  }
  ```

#### `POST /api/v1/admin/news/crawl`

Manually triggers the RSS news crawler (`triggerNewsCrawler()` with concurrency mutex).

- **Auth**: `ADMIN`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "status": "success",
      "feedsChecked": 3,
      "totalIngested": 4,
      "totalSkipped": 19,
      "totalVerifiedMatches": 1
    }
  }
  ```
  *(Returns `{ "status": "in_progress", "ingested": 0 }` if a crawl is already running.)*

---

### 3.10 Platform Statistics (`/api/v1/stats`)

#### `GET /api/v1/stats`

Returns live platform-wide aggregates used by dashboards and synced in real time via `STATS_UPDATED`.

- **Auth**: Public
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "totalReports": 128,
      "activeReports": 34,
      "resolvedReports": 19,
      "criticalThreats": 11,
      "totalCitizens": 85,
      "verifiedCitizens": 12,
      "safeHavens": 18,
      "totalVotes": 240,
      "lastActiveAt": "2026-11-12T09:58:00.000Z",
      "timestamp": "2026-11-12T10:00:00.000Z"
    }
  }
  ```

---

### 3.11 Cron Triggers (`/api/v1/cron`)

#### `GET /api/v1/cron/news-crawl` & `POST /api/v1/cron/news-crawl`

External scheduler trigger for the RSS news crawler (supporting platforms like Vercel Cron or Render/GitHub schedulers via `GET` or `POST`).

- **Auth**: `verifyCronSecret` — accepts `x-cron-secret: <CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`. Strictly fails closed (`401 Unauthorized`) whenever `CRON_SECRET` is unset, empty, missing, or mismatched.
- **Rate Limit**: `cronNewsCrawlRateLimiter` (max 2 requests / 10 minutes per IP).
- **Response (`200 OK`)**: Same payload as `POST /api/v1/admin/news/crawl` (`triggerNewsCrawler()` result) wrapped with `message` and `timestamp`.

---

### 3.12 Next.js App Router API Proxies (`apps/web/app/api`)

In addition to the 43 Express endpoints in `apps/api`, the Next.js frontend exposes 3 App Router API route handlers (`GET /api/health`, `GET /api/cron/news-crawl`, and `POST /api/cron/news-crawl`):

#### `GET /api/health` (`apps/web/app/api/health/route.ts`)

Aggregates live status across the Next.js frontend, Express `/health`, and Express `/health/db` (targeting `INTERNAL_API_URL`, `NEXT_PUBLIC_API_URL`, or Render production backend).

- **Auth**: Public
- **Response**: `200 OK` (`status: "healthy"`) when both backend probes succeed, or `503 Service Unavailable` (`status: "degraded"`) otherwise.

#### `GET /api/cron/news-crawl` & `POST /api/cron/news-crawl` (`apps/web/app/api/cron/news-crawl/route.ts`)

Vercel Cron proxy handler (`export const POST = GET`) that verifies `CRON_SECRET` (`Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`, failing closed with `401`) and forwards an authenticated `POST /api/v1/cron/news-crawl` request to the Express backend.

- **Auth**: `CRON_SECRET` (`Bearer` or `x-cron-secret`, fail-closed `401`)
- **Response**: JSON summary including `success`, `triggeredAt`, `backendStatus`, and forwarded backend `result`.

---

## 4. Real-Time WebSocket Gateway (Socket.IO)

### 4.1 Connection & Handshake Authentication

Socket.IO attaches to the HTTP server with `cors: { origin: CORS_ORIGIN, credentials: true }`, `pingTimeout: 20000`, `pingInterval: 25000`.

- **Guest Read-Only Mode**: Connecting with no credentials succeeds and joins `live_reports`.
- **Authenticated Mode**: Checks the `accessToken` cookie first, falling back to `socket.handshake.auth.token` (which accepts either an `accessToken` or a scoped `socketToken`). Invalid/expired tokens or suspended/deleted users fail the handshake. Authenticated connections join both `live_reports` and `user:<userId>`.

```ts
import { io } from 'socket.io-client';

const socket = io(API_URL, {
  withCredentials: true,
  auth: { token: socketToken }, // Required when cookies are not sent cross-origin
});
```

### 4.2 Client -> Server Events

| Event | Payload | Purpose |
| :--- | :--- | :--- |
| `join_map_bounds` | `{ minLng, minLat, maxLng, maxLat }` | Stores client viewport bounding box on `socket.data.bounds`. |
| `disconnect` | Built-in | Cleans up socket state. |

### 4.3 Server -> Client Events (Broadcast to `live_reports`)

All `SOCKET_EVENTS` constants are exported by `@repo/shared`:

| Event | Payload | Trigger |
| :--- | :--- | :--- |
| `NEW_REPORT` | Sanitized report (`id`, `category`, `severity`, `latitude`, `longitude`, `description`, `upvotes`, `downvotes`, `status`, `expiresAt`, `createdAt`, `sourceUrl`, `sourceName`, `isGpsVerified`) preserving exact 6-decimal coordinates | Citizen submission or news ingestion |
| `REPORT_VOTED` | `{ reportId, upvotes, downvotes, status }` | Community vote cast |
| `REPORT_PURGED` | `{ reportId, reason? }` | Trust-engine auto-purge (`downvotes >= 5`) or admin purge (`ADMIN_PURGED: ...`) |
| `REPORT_EXPIRED` | `{ reportIds, reason: "TIME_DECAY_EXPIRED" }` | Time-decay cron purge |
| `REPORT_RESOLVED` | `{ reportId, status: "RESOLVED", resolvedAt }` | Author, `VERIFIED_RESPONDER`, or `ADMIN` resolves report |
| `NEW_REPORT_UPDATE` | `{ reportId, update }` | Threaded context update posted |
| `REPORT_VERIFIED` | `{ reportId, verifiedBy, sourceUrl?, articleTitle? }` | News crawler cross-verifies citizen report |
| `STATS_UPDATED` | `PlatformStats` object (same shape as `GET /api/v1/stats`) | Coalesced broadcast after mutations/expirations |

### 4.4 Targeted Notifications (`user:<userId>`)

| Event | Payload | Trigger |
| :--- | :--- | :--- |
| `GEOFENCE_ALERT` | Alert payload describing intersecting `HIGH` severity report & matched zone | Background `notificationWorker` match against `UserAlertZone` |

---

## 5. Automated Background Workers & Cron Jobs

### 5.1 Time-Decay Expiry & Daily Retention Cleanup (`apps/api/src/jobs/timeDecayJob.ts`)

1. **Time-Decay Purge (`initTimeDecayCron`, default `*/5 * * * *`)**:
   - Protected by concurrency mutex (`isPurging`).
   - Transitions `ACTIVE` reports where `expiresAt < NOW()` to `status = 'PURGED'`, broadcasts `REPORT_EXPIRED`, and triggers `broadcastPlatformStats()`.
   - **Citizen Report Lifespans (`calculateReportExpiry`)**:
     - `THEFT`, `SNATCHING`, `MUGGING`, `EXTORTION`: **3 hours**
     - `ROBBERY`, `THEFT_ROBBERY`, `DACOITY`, `THEFT_DACOITY`, `ARMED_ASSAULT`, `SNATCHING_ARMED_ASSAULT`: **4 hours**
     - `ROAD_ACCIDENT`, `TEEN_GANG_ARMED_ASSAULT`: **6 hours**
     - `YOUTH_GANG_ACTIVITY`, `TEEN_GANG`, `DRUG_RELATED_CRIME`, `DRUG_ACTIVITY`: **24 hours**
     - `UNLIT_ROAD`: **14 days**
2. **Daily Rolling Hard-Delete Retention (`initDailyRetentionCron`, default `0 3 * * *`)**:
   - Calls `hardDeleteStaleRetentionData(30)` inside an isolated transaction (with `isHardCleaning` mutex) to permanently remove stale `PURGED` reports (cascading votes/updates/media and unlinking moderation logs), orphan news articles, and expired refresh tokens older than 30 days.

### 5.2 Automated News Crawler (`apps/api/src/jobs/newsCrawlerJob.ts`, `newsCrawlerService.ts`, `newsVerificationService.ts`)

- **Schedule**: `0 * * * *` (hourly) plus `scheduleStartupCrawl()` **10 seconds** after server boot to recover from container sleep/spin-downs.
- **Feeds**: Google News BD Crime (EN), Google News BD Safety (BN), The Daily Star Law & Crime.
- **Pipeline**: Filters foreign/overseas stories -> classifies category/severity (`newsClassifierService`) -> geocodes location -> deduplicates active incidents (`incidentDeduplicationService`) -> persists `NewsArticle` + verified `Report` -> cross-verifies active citizen reports within **500m** and a **24-hour** window (`crossVerifyCitizenReports`), emitting `REPORT_VERIFIED`.
- **News Report Lifespans (`calculateNewsReportExpiry`)**: `ROAD_ACCIDENT` = 48h, violent/property crimes = 72h, recurring gang/drug hazards = 7 days, `UNLIT_ROAD` = 14 days, always guaranteeing at least **24 hours** of map visibility from time of ingestion.

### 5.3 Geofenced Notification Worker (`apps/api/src/jobs/notificationWorker.ts`)

- Triggered asynchronously when a `HIGH` severity report is created (`enqueueReportNotification`).
- Evaluates PostGIS spatial intersection against active `UserAlertZone` polygons and emits targeted `GEOFENCE_ALERT` events to `user:<userId>`.

---

## 6. Complete Endpoints Summary Table

All **43** Express endpoints registered in `apps/api/src/app.ts` and `apps/api/src/routes/*.ts`:

| # | Method | Full Path | Auth / Guard | Description |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `GET` | `/` | Public | API identity & status metadata |
| 2 | `GET` | `/health` | Public | Server liveness probe |
| 3 | `GET` | `/health/db` | Public | PostgreSQL & PostGIS probe |
| 4 | `GET` | `/api/v1/health` | Public | Versioned server liveness probe |
| 5 | `GET` | `/api/v1/health/db` | Public | Versioned PostgreSQL & PostGIS probe |
| 6 | `POST` | `/api/v1/auth/device` | Public + `authDeviceRateLimiter` | Anonymous/device `USER` login (`200`) & registration (`201`) |
| 7 | `POST` | `/api/v1/auth/login` | Public + `authLoginRateLimiter` | Email/password login for `ADMIN` & password-protected accounts |
| 8 | `POST` | `/api/v1/auth/refresh` | `authRefreshRateLimiter` + `refreshToken` cookie | Single-use refresh rotation + new `socketToken` |
| 9 | `POST` | `/api/v1/auth/logout` | `optionalLogoutAuth` | Revoke refresh token & clear auth cookies (allows expired accessToken) |
| 10 | `GET` | `/api/v1/users/me` | `requireAuth` | Authenticated user profile & activity counts |
| 11 | `POST` | `/api/v1/users/verify` | `requireAuth` + `userVerifyRateLimiter` | Submit `PHONE_OTP` or `NID_DOCUMENT` verification |
| 12 | `POST` | `/api/v1/users/verify/:id/approve` | `requireAuth` + `ADMIN` + UUID check | Legacy alias: approve user KYC verification (preserves `ADMIN` role) |
| 13 | `POST` | `/api/v1/reports` | `requireAuth` + `reportCreationRateLimiter` | Submit safety report (sanitized output, exact coords + `fuzzedRadiusMeters: 150`) |
| 14 | `GET` | `/api/v1/reports` | Public | Query active reports in strict PostGIS map bounds |
| 15 | `GET` | `/api/v1/reports/:id` | `optionalAuth` | Single report detail, sanitized media (`blurredUrl`), & `isOwner` |
| 16 | `PATCH` | `/api/v1/reports/:id/resolve` | `requireAuth` | Resolve incident (author, `VERIFIED_RESPONDER`, or `ADMIN`) |
| 17 | `POST` | `/api/v1/reports/:id/vote` | `requireAuth` + `reportVoteRateLimiter` | Cast upvote (`1`) or downvote (`-1`) without leaking `userId` |
| 18 | `POST` | `/api/v1/reports/:id/updates` | `requireAuth` + `reportUpdateRateLimiter` | Append trimmed threaded context update (`2..500` chars) |
| 19 | `GET` | `/api/v1/reports/:id/updates` | Public | List report context updates |
| 20 | `GET` | `/api/v1/safe-zones` | Public | List safe zones by strict bounds or radial distance (`number` `distanceMeters`) |
| 21 | `POST` | `/api/v1/safe-zones` | `requireAuth` + `ADMIN` | Create verified safe zone |
| 22 | `DELETE` | `/api/v1/safe-zones/:id` | `requireAuth` + `ADMIN` | Delete safe zone |
| 23 | `POST` | `/api/v1/routes/safe-path` | Public + `safeRouteRateLimiter` | Compute hazard-avoiding safe polyline route |
| 24 | `POST` | `/api/v1/alerts/zones` | `requireAuth` | Create PostGIS geofenced alert polygon (max 5 zones, <= 25 km²) |
| 25 | `GET` | `/api/v1/alerts/zones` | `requireAuth` | List user's active alert zones |
| 26 | `DELETE` | `/api/v1/alerts/zones/:id` | `requireAuth` | Delete user's alert zone |
| 27 | `POST` | `/api/v1/alerts/subscribe` | `requireAuth` | Register Web Push subscription |
| 28 | `GET` | `/api/v1/media/presigned-url` | `requireAuth` | Generate presigned S3 upload URL (or mock flag) |
| 29 | `POST` | `/api/v1/media/confirm` | `requireAuth` | Confirm uploaded media & generate `blurredUrl` |
| 30 | `POST` | `/api/v1/media/mock-upload` | `requireAuth` | Inline base64 evidence fallback when S3 is unconfigured |
| 31 | `POST` | `/api/v1/media/webhook` | `verifyStorageWebhookSecret` | S3/Supabase storage callback (`x-webhook-secret`, fail-closed) |
| 32 | `GET` | `/api/v1/admin/verifications` | `requireAuth` + `ADMIN` | List pending KYC verification requests |
| 33 | `POST` | `/api/v1/admin/verifications/:id/approve` | `requireAuth` + `ADMIN` | Approve pending KYC verification |
| 34 | `POST` | `/api/v1/admin/verifications/:id/reject` | `requireAuth` + `ADMIN` | Reject pending KYC verification |
| 35 | `POST` | `/api/v1/admin/users/:id/ban` | `requireAuth` + `ADMIN` | Ban user, revoke sessions, & log `BAN_USER` |
| 36 | `POST` | `/api/v1/admin/users/:id/unban` | `requireAuth` + `ADMIN` | Unban user & log `UNBAN_USER` |
| 37 | `POST` | `/api/v1/admin/reports/:id/purge` | `requireAuth` + `ADMIN` | Manually purge report & broadcast `REPORT_PURGED` |
| 38 | `GET` | `/api/v1/admin/logs` | `requireAuth` + `ADMIN` | Paginated `ModerationLog` audit trail |
| 39 | `GET` | `/api/v1/admin/analytics/trends` | `requireAuth` + `ADMIN` | 30-day crime/hazard trends, night share, & category/severity/status breakdowns |
| 40 | `POST` | `/api/v1/admin/news/crawl` | `requireAuth` + `ADMIN` | Manually trigger RSS news crawler |
| 41 | `GET` | `/api/v1/stats` | Public | Live platform statistics snapshot |
| 42 | `GET` | `/api/v1/cron/news-crawl` | `verifyCronSecret` + `cronNewsCrawlRateLimiter` | Scheduler `GET` trigger (`CRON_SECRET`, fail-closed) |
| 43 | `POST` | `/api/v1/cron/news-crawl` | `verifyCronSecret` + `cronNewsCrawlRateLimiter` | Scheduler `POST` trigger (`CRON_SECRET`, fail-closed) |

### Next.js Frontend API Proxies (`apps/web/app/api`)

| # | Method | Path | Auth / Guard | Description |
| :--- | :--- | :--- | :--- | :--- |
| 44 | `GET` | `/api/health` | Public | Aggregated frontend + Express `/health` + `/health/db` status probe |
| 45 | `GET` | `/api/cron/news-crawl` | `CRON_SECRET` (`Bearer` or `x-cron-secret`) | Vercel Cron proxy forwarding `POST /api/v1/cron/news-crawl` |
| 46 | `POST` | `/api/cron/news-crawl` | `CRON_SECRET` (`Bearer` or `x-cron-secret`) | Vercel Cron proxy forwarding `POST /api/v1/cron/news-crawl` (`POST = GET`) |
