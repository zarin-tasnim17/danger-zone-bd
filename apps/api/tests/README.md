# DangerZoneBD Automated Backend API Testing Framework

Modular, reusable, evidence-driven backend test harness covering all **43 Express endpoints**, **3 Next.js App Router API proxies**, and the **Socket.IO real-time gateway** (**47 interfaces total**).

## Directory Structure

```text
apps/api/tests/
├── framework/          # Shared runner, ephemeral Express+Socket server, HTTP client, auth helpers, DB tracker, assertions
├── api/                # Endpoint-by-endpoint functional, validation, edge-case & Socket.IO suites (01..07)
├── authentication/     # Auth lifecycle, JWT tampering, alg=none, cookie flags, ban revocation
├── authorization/      # Role matrix (Unauth / USER / VERIFIED_RESPONDER / ADMIN) + horizontal IDOR/BOLA
├── validation/         # .strict() mass-assignment checks, PostGIS polygon limits, GPS/MIME/size boundaries
├── security/           # OWASP API Top 10 probes, SSRF, polyglot uploads, rate limiting, SQLi/XSS probes
├── database/           # Transaction atomicity, 5-downvote trust purge, concurrent race condition checks
├── workflows/          # Multi-step E2E business journeys (KYC promotion, safe-path lifecycle, alerts)
├── performance/        # Seeded fuzzing + bounded concurrency P50/P90/P95/P99 latency baseline
├── regression/         # Failing reproducers asserting expected fixed behavior for BACKEND-001..BACKEND-014
└── reports/            # Generated JSON, JUnit XML, HTML, and performance metrics reports
```

## Available Commands (`apps/api`)

- `npm run test:api` — Run full verification suite (`all`, excluding known-failing bug reproducers)
- `npm run test:api:functional` — Run `api/` functional & Socket.IO suites
- `npm run test:api:auth` — Run authentication suite
- `npm run test:api:authorization` — Run RBAC & IDOR/BOLA suite
- `npm run test:api:validation` — Run schema & geometry validation suite
- `npm run test:api:security` — Run security audit probes
- `npm run test:api:database` — Run PostgreSQL/PostGIS integrity & concurrency suite
- `npm run test:api:workflows` — Run E2E workflow journeys
- `npm run test:api:performance` — Run fuzzing & bounded concurrency benchmark (`perf-metrics.json`)
- `npm run test:api:regression` — Run bug reproducer suite (`BACKEND-001`..`BACKEND-014`)
- `npm run test:api:ci` — Deterministic CI gate
- `npm run test:api:report` — Execute every module (including regression probes) and generate `results.json`, `junit.xml`, `coverage-summary.json`, and `report.html`

## Safe Database Isolation

Tests spin up an ephemeral in-process HTTP + Socket.IO server (`127.0.0.1:0`) and track every test `User`, `Report`, `UserAlertZone`, `SafeZone`, `UserVerification`, `ModerationLog`, `ReportMedia`, and `NewsArticle` ID in `TestDataTracker`, deleting created rows in `after()` hooks without altering pre-existing or seeded database records.
