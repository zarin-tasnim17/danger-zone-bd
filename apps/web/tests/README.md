# DangerZoneBD Frontend API Integration Testing Framework

Reusable multi-layer verification suite for `apps/web`, permanently separating **Mocked**, **Contract**, **Live Backend (Express + PostgreSQL/PostGIS + Socket.IO)**, **Real Chromium E2E**, and **Defect Regression** layers.

## Profiles

- `npm --prefix apps/web run test:web:unit` — Pure unit tests for frontend API, media, GPS, filter, formatting, and shared utilities (Mocked/Offline).
- `npm --prefix apps/web run test:web:mocked` — Unit tests + mocked `apiFetch` error/timeout/malformed/concurrency resilience + mocked Zustand stores + Next.js App Router handler unit tests (`/api/health`, `/api/cron/news-crawl`).
- `npm --prefix apps/web run test:web:contracts` — Backend Zod contract parity validation against all `47` documented interfaces (`EP-001` through `EP-047`).
- `npm --prefix apps/web run test:web:auth` — Authentication session lifecycle and RBAC/guard verification.
- `npm --prefix apps/web run test:web:forms` — Client-side validation for report, KYC, geofence polygon, safe-route, and media upload flows.
- `npm --prefix apps/web run test:web:components` — Server-side React (`react-dom/server`) UI state & error/loading rendering verification across safety components.
- `npm --prefix apps/web run test:web:live` — Full end-to-end integration tests wiring real `apps/web` stores and `apiFetch` to an ephemeral local `apps/api` Express + PostgreSQL + Socket.IO backend with automatic `TestDataTracker` cleanup and orphan DB checks.
- `npm --prefix apps/web run test:web:e2e` — Real headless Chrome/Edge browser E2E suite via `puppeteer-core` booting `next dev` + local `apps/api` backend and checking every route, live API network roundtrip, and console/page errors.
- `npm --prefix apps/web run test:web:regression` — Deterministic reproduction tests asserting expected fixed behavior for confirmed `FRONTEND-XXX` defects (exits non-zero while application code defects remain unfixed).
- `npm --prefix apps/web run test:web:report` — Runs all verification suites + regression reproduction suite and generates `tests/reports/{results.json,junit.xml,coverage-summary.json,report.html}`.
