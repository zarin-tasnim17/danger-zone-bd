# BD Safety Map — Backend API Documentation

Welcome to the official backend API documentation for **BD Safety Map** (`apps/api`). This document details all HTTP endpoints, query parameters, payload schemas, authentication guards, role-based access rules, and WebSocket real-time events.

---

## 1. Environment & Base URLs

| Environment | Base URL | WebSocket URL |
| :--- | :--- | :--- |
| **Local Development** | `http://127.0.0.1:5000/api/v1` | `ws://127.0.0.1:5000` |
| **Production (Render)** | `https://danger-zone-bd.onrender.com/api/v1` | `wss://danger-zone-bd.onrender.com` |
| **Production Frontend (Vercel)** | `https://danger-zone-bd-snowy.vercel.app` | — |

> **Note on Root Endpoints:**
> - `GET /`: API welcome banner & directory.
> - `GET /health` and `GET /api/v1/health`: API status ping.
> - `GET /health/db` and `GET /api/v1/health/db`: Database connectivity verification.

---

## 2. Global Standards & Authentication Model

### 2.1 Standard Response Envelope
All API endpoints return JSON following the standard `ApiResponse<T>` contract:

```typescript
// Success Response
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}

// Error Response
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable explanation of error",
    "details": [] // Optional field validation errors
  }
}
```

### 2.2 Authentication & Cookies
Authentication uses short-lived JWT access tokens and persistent refresh tokens stored in secure, `HttpOnly` cookies:
- `accessToken` (Expires: 15 minutes, `HttpOnly`, `SameSite=Strict`, `Secure` in production)
- `refreshToken` (Expires: 7 days, `HttpOnly`, `SameSite=Strict`, `Secure` in production)

### 2.3 Required Custom Headers for Specific Endpoints
- **Incident Reporting (`POST /api/v1/reports`)**:
  - `x-device-lat`: Latitude string of client device GPS (e.g. `"23.8103"`).
  - `x-device-lng`: Longitude string of client device GPS (e.g. `"90.4125"`).
  - *Enforcement*: The server performs a Haversine distance check ensuring the device is within **200 meters** of the incident coordinates to prevent remote spam.
  - *Rate Limiting*: 1 incident report per 15 minutes per authenticated user.

### 2.4 User Roles & Permissions
- `CITIZEN`: Default anonymous device user. Can view reports, submit incidents within 200m, upvote/downvote (1 per report), and post context updates.
- `VERIFIED_RESPONDER`: Verified via Phone OTP or NID document. High trust score (`80+`), verified badge on posts.
- `ADMIN`: Full moderation privileges. Can purge reports, ban/unban users, approve/reject verifications, create safe zones, view audit logs, and trigger manual news crawlers.

---

## 3. API Endpoints Catalog

### 3.1 System & Health

#### `GET /`
- **Description**: API Welcome banner, status, and endpoint directory index.
- **Auth**: Public
- **Response `200 OK`**:
```json
{
  "name": "BD Safety Map API",
  "status": "online",
  "version": "1.0.0",
  "endpoints": { ... }
}
```

#### `GET /health` & `GET /api/v1/health`
- **Description**: Liveness health check for load balancers and orchestrators.
- **Auth**: Public
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "API is running"
}
```

#### `GET /health/db` & `GET /api/v1/health/db`
- **Description**: Readiness health check verifying PostgreSQL / PostGIS database connectivity via `SELECT 1`.
- **Auth**: Public
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Database connection successful"
}
```
- **Error `503 Service Unavailable`**:
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
- **Description**: Transparent anonymous device registration & login. Generates or fetches user by unique hardware/client UUID and sets `accessToken` & `refreshToken` cookies.
- **Auth**: Public
- **Request Body**:
```json
{
  "anonymousId": "c8d4f45a-9f44-4f27-9c60-a29d5b7a1e09",
  "email": "user@example.com" // Optional (required for admin login)
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "b3e61c56-3472-4cfd-92a1-fa1e466c1b33",
      "role": "CITIZEN" // or "ADMIN" / "VERIFIED_RESPONDER"
    }
  }
}
```

#### `POST /api/v1/auth/refresh`
- **Description**: Refreshes expired `accessToken` using the valid `refreshToken` HttpOnly cookie.
- **Auth**: Public (Requires `refreshToken` cookie)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {}
}
```

#### `POST /api/v1/auth/logout`
- **Description**: Revokes the active refresh token in the database and clears both `accessToken` and `refreshToken` cookies.
- **Auth**: Protected (`requireAuth`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {}
}
```

---

### 3.3 User Profile & Citizen Verification (`/api/v1/users`)

#### `GET /api/v1/users/me`
- **Description**: Retrieve the current authenticated user's profile, role, trust score, and verification status.
- **Auth**: Protected (`requireAuth`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "b3e61c56-3472-4cfd-92a1-fa1e466c1b33",
    "role": "CITIZEN",
    "trustScore": 50,
    "isVerified": false,
    "isBanned": false,
    "createdAt": "2026-10-25T12:00:00.000Z"
  }
}
```

#### `POST /api/v1/users/verify`
- **Description**: Submit a citizen KYC verification request (Phone OTP or National ID Document).
- **Auth**: Protected (`requireAuth`)
- **Request Body**:
```json
{
  "type": "PHONE_OTP", // "PHONE_OTP" | "NID_DOCUMENT"
  "documentUrl": "https://storage.supabase.co/..." // Optional URL if type is NID_DOCUMENT
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "d1a8e23f-...",
    "userId": "b3e61c56-...",
    "type": "PHONE_OTP",
    "status": "PENDING",
    "createdAt": "2026-10-25T12:30:00.000Z"
  }
}
```

#### `POST /api/v1/users/verify/:id/approve`
- **Description**: Approve a pending citizen verification request and promote the user to `VERIFIED_RESPONDER`.
- **Auth**: Protected (`requireAuth`, `requireRole(['ADMIN'])`)
- **URL Parameters**:
  - `id`: UUID of the Verification record.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "userId": "b3e61c56-...",
    "role": "VERIFIED_RESPONDER"
  }
}
```

---

### 3.4 Incident Reports & Community Moderation (`/api/v1/reports`)

#### `POST /api/v1/reports`
- **Description**: Submit a new safety hazard incident report. Enforces device proximity check (<= 200m) and rate limiting (1 report per 15 minutes).
- **Auth**: Protected (`requireAuth`)
- **Required Headers**:
  - `x-device-lat`: Client GPS latitude (e.g. `"23.7925"`)
  - `x-device-lng`: Client GPS longitude (e.g. `"90.4078"`)
- **Request Body**:
```json
{
  "category": "MUGGING", // "MUGGING" | "THEFT" | "UNLIT_ROAD" | "EXTORTION" | "DRUG_ACTIVITY"
  "severity": "HIGH",    // "LOW" | "MEDIUM" | "HIGH"
  "latitude": 23.7925,
  "longitude": 90.4078,
  "description": "Two individuals on a motorcycle snatching bags near Banani 11 bridge."
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "9a1b8c7d-...",
    "category": "MUGGING",
    "severity": "HIGH",
    "latitude": 23.7925,
    "longitude": 90.4078,
    "description": "Two individuals on a motorcycle snatching bags near Banani 11 bridge.",
    "status": "ACTIVE",
    "upvotes": 0,
    "downvotes": 0,
    "expiresAt": "2026-10-25T18:00:00.000Z",
    "createdAt": "2026-10-25T12:00:00.000Z"
  }
}
```

#### `GET /api/v1/reports`
- **Description**: Query active safety reports within a geographic bounding box with deterministic coordinate fuzzing (approx. 50-100m for privacy).
- **Auth**: Public
- **Query Parameters**:
  - `minLng` *(required)*: Minimum longitude (e.g. `90.35`)
  - `minLat` *(required)*: Minimum latitude (e.g. `23.70`)
  - `maxLng` *(required)*: Maximum longitude (e.g. `90.45`)
  - `maxLat` *(required)*: Maximum latitude (e.g. `23.85`)
  - `category` *(optional)*: Filter by `MUGGING`, `THEFT`, `UNLIT_ROAD`, `EXTORTION`, `DRUG_ACTIVITY`
  - `severity` *(optional)*: Filter by `LOW`, `MEDIUM`, `HIGH`
  - `isNightReport` *(optional)*: `"true"` | `"false"`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "9a1b8c7d-...",
      "category": "MUGGING",
      "severity": "HIGH",
      "latitude": 23.7921, // Fuzzed coordinates for privacy
      "longitude": 90.4082,
      "description": "Two individuals on a motorcycle...",
      "status": "ACTIVE",
      "upvotes": 5,
      "downvotes": 0,
      "expiresAt": "2026-10-25T18:00:00.000Z",
      "createdAt": "2026-10-25T12:00:00.000Z",
      "sourceUrl": "https://www.thedailystar.net/...", // Present if verified from news
      "sourceName": "The Daily Star"
    }
  ]
}
```

#### `GET /api/v1/reports/:id`
- **Description**: Fetch full details for a single incident report by UUID.
- **Auth**: Public
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "9a1b8c7d-...",
    "category": "MUGGING",
    "severity": "HIGH",
    "latitude": 23.7921,
    "longitude": 90.4082,
    "description": "...",
    "status": "ACTIVE",
    "upvotes": 5,
    "downvotes": 0,
    "createdAt": "...",
    "updates": [],
    "media": []
  }
}
```

#### `PATCH /api/v1/reports/:id/resolve`
- **Description**: Mark an active incident report as `RESOLVED`.
- **Auth**: Protected (`requireAuth` - Only report creator or `ADMIN`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "9a1b8c7d-...",
    "status": "RESOLVED",
    "resolvedAt": "2026-10-25T14:30:00.000Z"
  }
}
```

#### `POST /api/v1/reports/:id/vote`
- **Description**: Upvote (`1`) or downvote (`-1`) a report.
  - Users cannot vote on their own report.
  - A user can only vote once per report (re-voting updates the vote).
  - Reaching **5 net downvotes** triggers the Trust Engine to auto-purge the report.
- **Auth**: Protected (`requireAuth`)
- **Request Body**:
```json
{
  "voteType": 1 // 1 for Upvote, -1 for Downvote
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "9a1b8c7d-...",
    "upvotes": 6,
    "downvotes": 0,
    "status": "ACTIVE"
  }
}
```

#### `POST /api/v1/reports/:id/updates`
- **Description**: Add a real-time, threaded context update to an ongoing incident (e.g. "Police arrived at the scene", "Road cleared").
- **Auth**: Protected (`requireAuth`)
- **Request Body**:
```json
{
  "content": "Police patrol vehicle just arrived at the location." // 2 to 500 characters
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "update-uuid",
    "reportId": "9a1b8c7d-...",
    "content": "Police patrol vehicle just arrived at the location.",
    "createdAt": "2026-10-25T13:00:00.000Z",
    "user": {
      "role": "CITIZEN",
      "trustScore": 50
    }
  }
}
```

#### `GET /api/v1/reports/:id/updates`
- **Description**: Retrieve all threaded context updates for a specific report in chronological order.
- **Auth**: Public
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "update-uuid",
      "content": "Police patrol vehicle just arrived at the location.",
      "createdAt": "2026-10-25T13:00:00.000Z",
      "user": {
        "role": "CITIZEN",
        "trustScore": 50
      }
    }
  ]
}
```

---

### 3.5 Safe Zones (`/api/v1/safe-zones`)

#### `GET /api/v1/safe-zones`
- **Description**: Fetch verified safe shelters (Hospitals, Police Boxes, Pharmacies). Supports viewport bounding box or proximity distance radius queries.
- **Auth**: Public
- **Query Parameters**:
  - `minLng`, `minLat`, `maxLng`, `maxLat` *(optional)*: Viewport bounding box.
  - `lat`, `lng`, `radius` *(optional)*: Proximity search centered on coordinates (`radius` in meters, default 5000m).
  - `type` *(optional)*: Filter by `HOSPITAL`, `POLICE_BOX`, `PHARMACY`.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "sz-uuid-1",
      "name": "Gulshan Police Station",
      "type": "POLICE_BOX",
      "latitude": 23.7925,
      "longitude": 90.4167,
      "createdAt": "2026-10-20T00:00:00.000Z"
    },
    {
      "id": "sz-uuid-2",
      "name": "United Hospital Dhaka",
      "type": "HOSPITAL",
      "latitude": 23.8051,
      "longitude": 90.4162,
      "createdAt": "2026-10-20T00:00:00.000Z"
    }
  ]
}
```

#### `POST /api/v1/safe-zones`
- **Description**: Create a verified safe zone.
- **Auth**: Protected (`requireAuth`, `requireRole(['ADMIN'])`)
- **Request Body**:
```json
{
  "name": "Kurmitola General Hospital",
  "type": "HOSPITAL", // "HOSPITAL" | "POLICE_BOX" | "PHARMACY"
  "latitude": 23.8242,
  "longitude": 90.4072
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "new-sz-uuid",
    "name": "Kurmitola General Hospital",
    "type": "HOSPITAL",
    "latitude": 23.8242,
    "longitude": 90.4072
  }
}
```

#### `DELETE /api/v1/safe-zones/:id`
- **Description**: Delete a safe zone by UUID.
- **Auth**: Protected (`requireAuth`, `requireRole(['ADMIN'])`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "message": "Safe zone deleted successfully"
  }
}
```

---

### 3.6 Safe Route Pathfinding (`/api/v1/routes`)

#### `POST /api/v1/routes/safe-path`
- **Description**: Pathfinding engine that calculates a multi-waypoint navigation route avoiding active red hazard zones using PostGIS spatial safety buffers.
- **Auth**: Public
- **Request Body**:
```json
{
  "startLat": 23.7808,
  "startLng": 90.4152,
  "endLat": 23.7925,
  "endLng": 90.4078
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "isDiverted": true,
    "divertedReason": "Route diverted to maintain a 150m buffer from 2 active high-severity hazard zones.",
    "waypoints": [
      { "latitude": 23.7808, "longitude": 90.4152 },
      { "latitude": 23.7865, "longitude": 90.4180 },
      { "latitude": 23.7925, "longitude": 90.4078 }
    ],
    "hazardsAvoidedCount": 2,
    "distanceMeters": 1850
  }
}
```

---

### 3.7 Media & Privacy Pipeline (`/api/v1/media`)

> **Note on Direct File Uploads**:
> Direct `multipart/form-data` uploads are blocked with `415 Unsupported Media Type` to protect server memory. Clients must request a presigned URL, upload directly to cloud storage, and call `POST /confirm`.

#### `GET /api/v1/media/presigned-url`
- **Description**: Generates an authenticated presigned URL for direct upload to cloud storage (S3 / Supabase Storage).
- **Auth**: Protected (`requireAuth` - Only report creator, `VERIFIED_RESPONDER`, or `ADMIN`)
- **Query Parameters**:
  - `reportId` *(required)*: UUID of the incident report.
  - `fileType` *(required)*: `image/jpeg` | `image/png` | `image/webp`.
  - `fileSize` *(required)*: File size in bytes (maximum 5,242,880 bytes / 5MB).
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://storage.supabase.co/storage/v1/object/upload/sign/reports/...",
    "fileKey": "reports/9a1b8c7d-uuid/evidence.jpg",
    "expiresInSeconds": 300
  }
}
```

#### `POST /api/v1/media/confirm`
- **Description**: Confirms the upload and queues an asynchronous background task to run the Privacy Blurring Pipeline (automatic blurring of human faces and vehicle license plates).
- **Auth**: Protected (`requireAuth` - Only report creator, `VERIFIED_RESPONDER`, or `ADMIN`)
- **Request Body**:
```json
{
  "reportId": "9a1b8c7d-...",
  "fileKey": "reports/9a1b8c7d-uuid/evidence.jpg",
  "originalUrl": "https://storage.supabase.co/storage/v1/object/public/reports/..." // Optional
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "media-record-uuid",
    "status": "PROCESSING",
    "message": "Media upload confirmed. Privacy auto-blur pipeline triggered."
  }
}
```

#### `POST /api/v1/media/webhook`
- **Description**: Webhook handler receiving direct cloud storage event notifications when files are created.
- **Auth**: Public (Validated via internal webhook secret header)
- **Response `200 OK`**:
```json
{
  "received": true
}
```

---

### 3.8 Geofenced Alerts (`/api/v1/alerts`)

#### `POST /api/v1/alerts/zones`
- **Description**: Create a personal alert geofence polygon. Automatically caps the area at **25 km²** to prevent abuse.
- **Auth**: Protected (`requireAuth`)
- **Request Body**:
```json
{
  "name": "Home & Office Route",
  "coordinates": [
    [90.4100, 23.7900],
    [90.4200, 23.7900],
    [90.4200, 23.8000],
    [90.4100, 23.8000],
    [90.4100, 23.7900] // Closed ring (min 4 coordinate pairs)
  ]
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "zone-uuid",
    "name": "Home & Office Route",
    "userId": "user-uuid",
    "createdAt": "2026-10-25T14:00:00.000Z"
  }
}
```

#### `GET /api/v1/alerts/zones`
- **Description**: Retrieve all alert zones created by the current user.
- **Auth**: Protected (`requireAuth`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "zone-uuid",
      "name": "Home & Office Route",
      "coordinates": [ ... ],
      "createdAt": "2026-10-25T14:00:00.000Z"
    }
  ]
}
```

#### `DELETE /api/v1/alerts/zones/:id`
- **Description**: Delete a user alert zone by UUID.
- **Auth**: Protected (`requireAuth`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "message": "Alert zone deleted successfully"
  }
}
```

#### `POST /api/v1/alerts/subscribe`
- **Description**: Register browser Web Push subscription credentials for background hazard notifications.
- **Auth**: Protected (`requireAuth`)
- **Request Body**:
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "BLc4x92...",
    "auth": "sA9x2..."
  }
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "subscribed": true,
    "userId": "user-uuid"
  }
}
```

---

### 3.9 Admin Portal & Moderation (`/api/v1/admin`)

> **Access Restriction**: All endpoints under `/api/v1/admin` require an authenticated session (`requireAuth`) with the role `ADMIN` (`requireRole(['ADMIN'])`). Unauthorized attempts return `403 Forbidden`.

#### `POST /api/v1/admin/users/:id/ban`
- **Description**: Ban a malicious user account. Immediately prevents report submissions and revokes active sessions.
- **Request Body**:
```json
{
  "reason": "Repeated submission of fabricated incident reports." // 3-500 chars
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "userId": "target-user-uuid",
    "isBanned": true,
    "reason": "Repeated submission of fabricated incident reports."
  }
}
```

#### `POST /api/v1/admin/users/:id/unban`
- **Description**: Restore a previously banned user account.
- **Request Body**:
```json
{
  "reason": "User appeal verified and approved." // 3-500 chars
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "userId": "target-user-uuid",
    "isBanned": false
  }
}
```

#### `POST /api/v1/admin/reports/:id/purge`
- **Description**: Force-delete a false, malicious, or spam incident report. Logs the action in `ModerationLog` and emits `REPORT_PURGED` via WebSocket to instantly remove the pin from all client screens.
- **Request Body**:
```json
{
  "reason": "False report verified with local authorities." // 3-500 chars
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "reportId": "target-report-uuid",
    "status": "PURGED"
  }
}
```

#### `GET /api/v1/admin/logs`
- **Description**: Retrieve paginated audit trail of all moderation actions taken by admins or the automated Trust Engine.
- **Query Parameters**:
  - `page` *(optional)*: Page number (default: `1`)
  - `limit` *(optional)*: Items per page (default: `20`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log-uuid-1",
        "action": "PURGE_REPORT",
        "reason": "False report verified with local authorities.",
        "adminId": "admin-uuid",
        "targetReportId": "report-uuid",
        "targetUserId": null,
        "createdAt": "2026-10-25T15:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42
    }
  }
}
```

#### `GET /api/v1/admin/analytics/trends`
- **Description**: 30-day analytics trends of incident frequencies, category distributions, and peak hazard hours.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "totalIncidents30Days": 148,
    "byCategory": {
      "MUGGING": 54,
      "THEFT": 39,
      "UNLIT_ROAD": 28,
      "EXTORTION": 18,
      "DRUG_ACTIVITY": 9
    },
    "bySeverity": {
      "HIGH": 62,
      "MEDIUM": 55,
      "LOW": 31
    },
    "nightIncidentsPercentage": 64.2
  }
}
```

#### `GET /api/v1/admin/verifications`
- **Description**: List all pending citizen KYC verification requests.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "verify-uuid-1",
      "userId": "user-uuid",
      "type": "NID_DOCUMENT",
      "documentUrl": "https://storage.supabase.co/...",
      "status": "PENDING",
      "createdAt": "2026-10-25T11:00:00.000Z"
    }
  ]
}
```

#### `POST /api/v1/admin/verifications/:id/reject`
- **Description**: Reject a citizen verification request with a specified reason.
- **Request Body**:
```json
{
  "reason": "Uploaded document was unreadable or blurry." // 3-500 chars
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "verificationId": "verify-uuid-1",
    "status": "REJECTED",
    "reason": "Uploaded document was unreadable or blurry."
  }
}
```

#### `POST /api/v1/admin/news/crawl`
- **Description**: Manually trigger the automated 100% free RSS news crawler across major Bangladeshi news outlets (The Daily Star, Prothom Alo, Dhaka Tribune, BDNews24, etc.) and execute the cross-verification engine.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "status": "COMPLETED",
    "articlesScanned": 45,
    "incidentsExtracted": 4,
    "crossVerifiedReports": 2
  }
}
```

---

## 4. Real-Time WebSocket Gateway (`Socket.IO`)

The API runs a real-time WebSocket server mounted alongside Express on the same port.

### 4.1 Connection & Handshake Authentication
- **Transport**: `websocket`, `polling`
- **Auth**: The handshake extracts either the `accessToken` HttpOnly cookie or an explicit auth token passed in the handshake:
```typescript
import { io } from 'socket.io-client';

const socket = io('https://danger-zone-bd.onrender.com', {
  withCredentials: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity
});
```

### 4.2 Auto Rooms
- `live_reports`: Every connected client automatically joins this room to receive nationwide or viewport incident updates.
- `user:<userId>`: Every authenticated user joins their personal room to receive targeted geofence push alerts.

### 4.3 Client-to-Server Events

#### `joinMapBounds`
- **Payload**:
```json
{
  "minLng": 90.35,
  "minLat": 23.70,
  "maxLng": 90.45,
  "maxLat": 23.85
}
```
- **Description**: Notifies the server of the client's current map viewport for geo-scoped broadcast filtering.

---

### 4.4 Server-to-Client Broadcast Events

| Event Name | Room | Payload Description |
| :--- | :--- | :--- |
| `NEW_REPORT` | `live_reports` | Emitted when a new incident is submitted by a citizen or extracted from news portals. Excludes user PII and fuzzes coordinates. |
| `REPORT_VOTED` | `live_reports` | Emitted when vote tallies change: `{ reportId, upvotes, downvotes, status }`. |
| `REPORT_PURGED` | `live_reports` | Emitted when an incident is deleted or purged: `{ reportId, reason }`. |
| `REPORT_EXPIRED` | `live_reports` | Emitted by Time-Decay worker when incidents age out: `{ reportIds, reason }`. |
| `REPORT_RESOLVED`| `live_reports` | Emitted when an incident is marked resolved: `{ reportId, status, resolvedAt }`. |
| `NEW_REPORT_UPDATE` | `live_reports` | Emitted when a threaded update is submitted: `{ reportId, update }`. |
| `REPORT_VERIFIED` | `live_reports` | Emitted when a report is verified by a news outlet: `{ reportId, verifiedBy, sourceUrl, articleTitle }`. |
| `GEOFENCE_ALERT` | `user:<userId>` | Emitted to a user's personal room when a new incident falls inside one of their saved alert zones. |

---

## 5. Automated Background Jobs

The backend executes autonomous scheduled tasks managed in `apps/api/src/jobs`:

1. **RSS News Crawler & Cross-Verification (`newsCrawlerJob.ts`)**:
   - Runs on a recurring schedule.
   - Fetches public RSS feeds from leading Bangladesh news portals.
   - Classifies crime/safety articles into category and severity (`newsClassifierService.ts`).
   - Geocodes mentioned landmarks using OpenStreetMap Nominatim with Dhaka local gazetteer fallbacks (`geocodingService.ts`).
   - Cross-verifies active citizen reports within 500m / 48hr window, elevating citizen trust scores and appending press verification tags (`newsVerificationService.ts`).

2. **Time-Decay & Expiration Worker (`timeDecayJob.ts`)**:
   - Evaluates active reports based on severity:
     - `LOW`: 6 hours
     - `MEDIUM`: 12 hours
     - `HIGH`: 24 hours
   - Upvotes extend expiration by 2 hours per vote (up to 48 hours maximum).
   - Marks aged-out reports as `EXPIRED` and broadcasts `REPORT_EXPIRED`.

3. **Geofence Proximity Notifier (`notificationWorker.ts`)**:
   - On every new incident, checks for intersecting user alert zones via PostGIS `ST_Intersects`.
   - Sends real-time WebSocket `GEOFENCE_ALERT` and Web Push notifications.

4. **Privacy Auto-Blur Pipeline (`privacyBlurService.ts`)**:
   - Asynchronously processes uploaded evidence media to blur identifiable human faces and vehicle license plates before rendering to public clients.

---

## 6. Complete Endpoints Reference Table

| Method | Path | Auth / Role Guard | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Public | Welcome banner & endpoint directory |
| `GET` | `/health` | Public | API liveness health check |
| `GET` | `/health/db` | Public | Database readiness health check |
| `GET` | `/api/v1/health` | Public | API liveness health check |
| `GET` | `/api/v1/health/db` | Public | Database readiness health check |
| `POST` | `/api/v1/auth/device` | Public | Anonymous device login & JWT issuance |
| `POST` | `/api/v1/auth/refresh` | Public (`refreshToken` cookie) | Refresh session JWT |
| `POST` | `/api/v1/auth/logout` | Protected (`CITIZEN`) | Revoke refresh token & clear cookies |
| `GET` | `/api/v1/users/me` | Protected (`CITIZEN`) | Get authenticated user profile |
| `POST` | `/api/v1/users/verify` | Protected (`CITIZEN`) | Submit citizen KYC verification |
| `POST` | `/api/v1/users/verify/:id/approve` | Protected (`ADMIN`) | Approve citizen KYC & elevate role |
| `POST` | `/api/v1/reports` | Protected (`CITIZEN`, 200m GPS) | Submit incident report (rate limited 15m) |
| `GET` | `/api/v1/reports` | Public | Get reports in bounding box (fuzzed coords) |
| `GET` | `/api/v1/reports/:id` | Public | Get single report details by UUID |
| `PATCH` | `/api/v1/reports/:id/resolve` | Protected (Author / `ADMIN`) | Mark report as resolved |
| `POST` | `/api/v1/reports/:id/vote` | Protected (`CITIZEN`) | Upvote (`1`) or downvote (`-1`) |
| `POST` | `/api/v1/reports/:id/updates` | Protected (`CITIZEN`) | Add threaded context update |
| `GET` | `/api/v1/reports/:id/updates` | Public | Get all context updates for report |
| `GET` | `/api/v1/safe-zones` | Public | Query safe zones by bbox or proximity |
| `POST` | `/api/v1/safe-zones` | Protected (`ADMIN`) | Create verified safe zone |
| `DELETE` | `/api/v1/safe-zones/:id` | Protected (`ADMIN`) | Delete safe zone by UUID |
| `POST` | `/api/v1/routes/safe-path` | Public | Calculate route avoiding red hazard zones |
| `GET` | `/api/v1/media/presigned-url` | Protected (Author / `ADMIN`) | Generate S3/Supabase upload presigned URL |
| `POST` | `/api/v1/media/confirm` | Protected (Author / `ADMIN`) | Confirm upload & queue privacy blur |
| `POST` | `/api/v1/media/webhook` | Public (Webhook secret) | Cloud storage event receiver |
| `POST` | `/api/v1/alerts/zones` | Protected (`CITIZEN`) | Create alert zone (max 25 km²) |
| `GET` | `/api/v1/alerts/zones` | Protected (`CITIZEN`) | List current user's alert zones |
| `DELETE` | `/api/v1/alerts/zones/:id` | Protected (`CITIZEN`) | Delete alert zone by UUID |
| `POST` | `/api/v1/alerts/subscribe` | Protected (`CITIZEN`) | Register Web Push credentials |
| `POST` | `/api/v1/admin/users/:id/ban` | Protected (`ADMIN`) | Ban user account |
| `POST` | `/api/v1/admin/users/:id/unban` | Protected (`ADMIN`) | Restore banned user account |
| `POST` | `/api/v1/admin/reports/:id/purge` | Protected (`ADMIN`) | Purge false/spam report |
| `GET` | `/api/v1/admin/logs` | Protected (`ADMIN`) | Get paginated moderation audit logs |
| `GET` | `/api/v1/admin/analytics/trends` | Protected (`ADMIN`) | Get 30-day incident analytics & trends |
| `GET` | `/api/v1/admin/verifications` | Protected (`ADMIN`) | List pending citizen KYC verifications |
| `POST` | `/api/v1/admin/verifications/:id/reject` | Protected (`ADMIN`) | Reject citizen KYC verification |
| `POST` | `/api/v1/admin/news/crawl` | Protected (`ADMIN`) | Trigger manual RSS crawl & verification |
