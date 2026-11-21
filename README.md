# Danger Zone BD (বিপদজনক এলাকা বাংলাদেশ)

<div align="center">

![Danger Zone BD Banner](https://raw.githubusercontent.com/zarin-tasnim17/danger-zone-bd/main/apps/web/public/icon.svg)

**Real-Time Crowdsourced Threat Radar, Hardware-Verified Civic Hazard Telemetry & Safe Navigation Engine for Bangladesh**

[![Live Demo](https://img.shields.io/badge/Production%20Web-Live%20on%20Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://danger-zone-bd-snowy.vercel.app)
[![Backend API](https://img.shields.io/badge/Backend%20API-Render%20Cloud-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://danger-zone-bd.onrender.com)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20PostGIS-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com)
[![Architecture](https://img.shields.io/badge/Monorepo-Turborepo%20%2B%20pnpm-EF4444?style=for-the-badge&logo=turborepo&logoColor=white)](https://turbo.build/repo)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

[Explore Live Threat Radar](https://danger-zone-bd-snowy.vercel.app) • [Safe Havens Directory](https://danger-zone-bd-snowy.vercel.app/safe-zones) • [Safe Route Planner](https://danger-zone-bd-snowy.vercel.app/routes) • [Admin Console](https://danger-zone-bd-snowy.vercel.app/admin)

</div>

---

## 1. Executive Summary

**Danger Zone BD** is a zero-budget, open-source, civic emergency intelligence platform engineered specifically for the public safety realities of Bangladesh. It converts fragmented eyewitness reports, municipal hazard telemetry, and localized digital news into an **immediate, actionable, geographically verified public safety radar**.

Rather than functioning as a social discussion forum or an ad-driven news board, Danger Zone BD is designed as a **tactical civic utility**. The platform empowers citizens moving through urban centers like Dhaka, Chattogram, and regional transit corridors to answer three vital questions in real time:

1. **Where am I right now, and what active physical hazards are around me?**
2. **If danger breaks out, where is the nearest verified safe haven (police station, outpost, or 24/7 hospital)?**
3. **What is the safest street-level route to reach my destination while actively avoiding high-threat zones?**

---

## 2. The Real-World Problem & Motivation

### The Reality in Bangladesh
Citizens navigating Bangladeshi urban environments regularly encounter volatile street-level security risks:
* **Violent Street Crime:** Mobile phone and bag snatching (*chintai*), armed robbery (*dakaiti*), organized extortion (*chandabaji*), and targeted assaults.
* **Youth Gang Turf Conflicts:** Violent clashes (*teen gang confrontations*) that erupt unpredictably in public markets and thoroughfares.
* **Critical Infrastructure Failures:** Severe waterlogging, open construction trenches, unlit streets during rolling blackouts, and high-frequency collision intersections.
* **Rapidly Shifting Civil Disruptions:** Sudden roadblocks, mob skirmishes, and transport strikes that render customary transit routes impassable without warning.

### The Information Void
When acute safety emergencies occur, existing channels fail to protect citizens:
* **Traditional Press is Too Slow:** Mainstream news outlets publish reports hours or days after an incident. A news report published at 10:00 PM about a 5:00 PM mugging provides zero protection to a commuter walking home at 5:30 PM.
* **Social Media is Chaotic and Unanchored:** Public Facebook groups and messaging channels amplify rumors, political propaganda, and panic without precise geographic coordinates or timestamp validation.
* **Commercial Navigation is "Safety-Blind":** Mainstream GPS applications (such as Google Maps) calculate routes solely based on traffic velocity and travel distance. They routinely steer pedestrians, women commuters, and motorcyclists directly through unlit alleys, active clash spots, or high-crime bottlenecks.
* **Emergency Dispatch Operates in a Vacuum:** First responders (National Emergency Service 999) lack hyper-local, distributed citizen telemetry and dynamic threat heatmaps to guide preventive patrols.

**Danger Zone BD bridges this gap** by combining low-latency citizen crowdsourcing, server-side hardware GPS anti-spoofing, automated bilingual press corroboration, and PostGIS spatial intelligence.

---

## 3. Core Architectural Pillars & Key Capabilities

```mermaid
flowchart TD
    subgraph Ingestion["1. Multi-Channel Ingestion"]
        A["Citizen Eyewitness (Web / Mobile)"] -->|Hardware GPS Telemetry| C["Ingestion Gateway"]
        B["National News Crawler (RSS Feeds)"] -->|Bilingual NLP Classifier| C
    end

    subgraph Verification["2. Verification & Integrity Engine"]
        C --> D{"Anti-Spoofing Check"}
        D -->|Offset <= 200m| E["Hardware-Verified GPS"]
        D -->|Offset > 200m| F["Rejected (Spoof Prevention)"]
        E --> G["Spatial Deduplication Engine"]
        G --> H["Community Consensus Voting"]
        G --> I["Automated Press Corroboration"]
    end

    subgraph Processing["3. Spatial Core & Lifecycle"]
        H & I --> J["PostgreSQL + PostGIS (Point 4326)"]
        J --> K["Category-Based TTL Decay Worker"]
        K -->|Expired| L["Auto-Resolution / Pruning"]
    end

    subgraph Distribution["4. Real-Time Distribution"]
        J --> M["Socket.io WebSocket Broadcast"]
        J --> N["Web Push Notifications (VAPID)"]
        M --> O["Interactive Threat Radar (Leaflet)"]
        M --> P["Safe Navigation Engine (OSRM)"]
        M --> Q["Admin Moderation Suite"]
    end
```

### 🗺️ Interactive Live Threat Radar (`/`)
* **Multi-Layer Basemaps:** Switch smoothly between OpenStreetMap, high-detail Google Streets, and Google Satellite Hybrid tiles.
* **Spatial Viewport Queries:** PostGIS bounding-box indexing (`ST_MakeEnvelope`) streams only the incidents relevant to the user's active viewport and zoom level.
* **Visual Threat Taxonomy:** Differentiates incidents with distinct color-coded markers and badges: *Armed Assault* (Red), *Robbery/Snatching* (Orange), *Extortion* (Purple), *Youth Gang Activity* (Violet), *Drug Crime* (Blue), *Road Accidents* (Emerald), and *Unlit Roads* (Yellow).
* **Night Hazard Mode:** Automatically tags incidents occurring during Bangladesh night hours (sunset to sunrise) with high-visibility luminescent indicators.

### 🛡️ Zero-Friction Anonymous Reporting with Hardware Anti-Spoofing (`/report`)
* **< 30-Second Workflow:** Eyewitnesses can submit emergency hazard reports without mandatory registration, password creation, or email verification.
* **Protection Against Retaliation:** Eyewitnesses are assigned silent, cryptographically generated device tokens (`anonymousId`). Public markers **never** expose reporter PII.
* **Hardware GPS Geofence Enforcement:** The server calculates the spatial offset between the user's live device hardware coordinates and the dropped pin location. Submissions exceeding **200 meters** are rejected to eliminate remote troll attacks and misinformation.
* **Interactive Map Pinning:** Eyewitnesses can pinpoint hazards directly on the interactive map with real-time radius confirmation and coordinate reverse-geocoding.
* **Privacy-Preserving Media:** Uploaded photos undergo automatic visual blurring of sensitive regions, bystanders, and license plates before storage.

### ⏱️ Dynamic Time-To-Live (TTL) & Lifecycle Management
* Physical hazards are inherently temporary. The platform enforces an automated **Time-To-Live (TTL)** decay model based on incident category and severity (e.g., snatching alerts decay faster than structural road hazards).
* A background cron worker (`timeDecayJob.ts`) prunes expired incidents continuously, ensuring the live threat radar remains uncluttered and accurate.

### 📰 Automated Bilingual Press Ingestion & Cross-Verification
* **Nationwide Publisher Registry:** Curated RSS feeds covering major national and regional dailies across all 64 districts in Bengali and English (e.g., Prothom Alo, The Daily Star, BSS, BDNews24, Dhaka Tribune, Samakal).
* **Bilingual NLP Classifier:** Evaluates headline and summary text against contextual crime dictionaries, landmark disambiguation engines, and regional regex patterns. It hardens classification against police arrest follow-ups, court proceedings, and non-physical allegations.
* **Temporal Extraction Engine:** Accurately extracts historical and relative incident timing (including Bengali numerals and relative phrases like *গতকাল*, *গত শুক্রবার*) to prevent re-reporting historical events as active breaking emergencies.
* **6-Stage Active Threat Eligibility State Machine:** Classifies incidents through `INGESTED` → `CLASSIFIED` → `CORROBORATED` → `ADMIN_VERIFIED` to distinguish active ongoing physical threats from resolved police actions.
* **"Press Confirmed" Corroboration:** When a crawled press report matches a citizen-reported incident within 500 meters and 24 hours, the platform automatically links citations and elevates community trust scores.
* **SSRF-Protected Network Boundary:** Crawler HTTP requests enforce strict IP/DNS validation, preventing Server-Side Request Forgery against private local cloud subnets and metadata endpoints.

### 🚨 Verified Safe-Haven Directory (`/safe-zones`)
* An authoritative, spatial directory of **police stations (*Thanas* across all 64 districts)**, police outposts, and 24/7 emergency medical clinics.
* Provides real-time distance calculation, address details, and **one-touch emergency dialer links** for National Emergency Service (999) and local police desks.

### 🧭 Hazard-Aware Safe Routing Engine (`/routes`)
* Integrates with the **Open Source Routing Machine (OSRM)** to compute turn-by-turn walking and driving routes.
* Intersects transit polylines against active hazard threat zones, visualizes intersecting danger buffers, and computes alternative paths around high-risk areas.

### 🔔 Custom Polygon Alert Geofences & Web Push (`/alerts`)
* Allows citizens to draw custom geographic polygon boundaries on the map (e.g., around their residential area, university campus, or daily transit route).
* Dispatches standard browser Web Push (VAPID) notifications and synthesized browser audio/haptic sirens whenever a high-threat incident occurs inside their monitored zone.

### 🔒 Privileged Administrative Moderation Console (`/admin`)
* Dedicated credential-gated portal for authorized safety administrators.
* **Incident Queue & Purge Modal:** Review active reports, verify incidents, reclassify categories, or permanently purge fraudulent entries with mandatory, auditable justifications.
* **User & Device Defense:** Inspect user trust scores and ban malicious or abusive device IDs.
* **Citizen Verification Queue:** Review submitted Bangladeshi phone numbers (OTP) and National ID (NID) documents to upgrade community members to `VERIFIED_RESPONDER` status.
* **Immutable Audit Trail:** All administrative interventions are permanently recorded in `ModerationLog`.

---

## 4. Technology Stack & Engineering Architecture

DangerZoneBD is architected as an end-to-end TypeScript monorepo managed via **Turborepo** and **pnpm workspaces**:

```text
danger-zone-bd/
├── apps/
│   ├── web/                     # Next.js 14 App Router frontend application
│   │   ├── app/                 # Page routes & serverless route handlers
│   │   ├── components/          # Modular React & Leaflet UI components
│   │   ├── lib/                 # API client, WebSockets, GPS & push utilities
│   │   └── store/               # Zustand reactive client state stores
│   │
│   └── api/                     # Node.js + Express + TypeScript backend
│       ├── prisma/              # PostgreSQL + PostGIS schema & migrations
│       ├── src/
│       │   ├── config/          # Zod environment variable validation
│       │   ├── controllers/     # Express REST controllers
│       │   ├── db/              # Prisma client & raw PostGIS spatial queries
│       │   ├── jobs/            # Scheduled background cron workers
│       │   ├── middleware/      # JWT auth, RBAC, rate-limiting & error handlers
│       │   ├── routes/          # Express route definitions
│       │   ├── services/        # Business logic, deduplication & news classifier
│       │   ├── sockets/         # Socket.io real-time event broadcasting
│       │   └── server.ts        # HTTP server entry point & WebSocket bootstrap
│       └── tests/               # Backend integration & test suites
│
├── packages/
│   └── shared/                  # Universal cross-platform contracts & types
│       └── src/index.ts         # Threat categories, severity enums & BD mobile regex
│
├── tests/                       # Root-level opaque-box E2E test suites (Python)
├── package.json                 # Monorepo root dependencies & scripts
├── pnpm-workspace.yaml          # Workspace topology
├── turbo.json                   # Build task pipeline & cache rules
└── render.yaml                  # Backend cloud deployment specification
```

### Technology Breakdown

| Domain | Technology / Tool | Purpose in Danger Zone BD |
| :--- | :--- | :--- |
| **Monorepo Engine** | [Turborepo](https://turbo.build/) + [pnpm](https://pnpm.io/) | Workspace orchestration, incremental build caching, and isolated package management. |
| **Frontend Framework** | [Next.js 14](https://nextjs.org/) (App Router, React 18) | Server-side rendering, progressive web app routing, and dynamic client bundles. |
| **Styling & Icons** | [Tailwind CSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/) | High-performance mobile-first responsive styling and consistent civic icon taxonomy. |
| **Mapping Engine** | [Leaflet](https://leafletjs.com/) + [React-Leaflet](https://react-leaflet.js.org/) | Lightweight, GPU-accelerated interactive map rendering without vendor lock-in. |
| **Client State** | [Zustand](https://github.com/pmndrs/zustand) | Minimalist reactive state management for active incidents, map viewports, and auth tokens. |
| **Backend Runtime** | [Node.js](https://nodejs.org/) (v20+) + [Express](https://expressjs.com/) | Decoupled RESTful API microservice written in strict TypeScript. |
| **Real-Time Layer** | [Socket.io](https://socket.io/) | Bi-directional WebSocket channels broadcasting new reports, votes, and purges instantly. |
| **Geospatial Database**| [PostgreSQL 15](https://www.postgresql.org/) + [PostGIS 3.3](https://postgis.net/) | Native `geography(Point, 4326)` spatial queries, GIST spatial indexing, and envelope filtering. |
| **Database ORM** | [Prisma ORM](https://www.prisma.io/) | Type-safe schema definition, relational cascade enforcement, and migration workflows. |
| **Data Validation** | [Zod](https://zod.dev/) | Runtime request payload validation, route parameter sanitization, and environment parsing. |
| **Routing Engine** | [OSRM](http://project-osrm.org/) | Open-source multi-modal road navigation calculating transit geometry and waypoints. |
| **Background Cron** | [node-cron](https://github.com/node-cron/node-cron) | Scheduled background tasks for news scraping, report expiration, and metric tracking. |
| **Cloud Hosting** | [Vercel](https://vercel.com) (Frontend) + [Render](https://render.com) (API) | Zero-budget cloud tier hosting with automated CI/CD and deployment pipelines. |

---

## 5. Security, Privacy & Civic Integrity

### Asymmetric Security Architecture
Danger Zone BD employs a deliberate, bifurcated security model tailored to civic emergency conditions:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ASYMMETRIC SECURITY MODEL                       │
├───────────────────────────────────┬────────────────────────────────────┤
│ Citizen / Eyewitness              │ Platform Administrator             │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Silent Anonymous Device Tokens  │ • Strict Email + Password Auth     │
│ • No account or password required │ • Bcrypt Hash (12 rounds)          │
│ • Zero PII stored or broadcast    │ • Role-Based Access Gate (ADMIN)   │
│ • Protection against retaliation  │ • Immutable audit trail in DB      │
└───────────────────────────────────┴────────────────────────────────────┘
```

1. **Non-Retaliation by Design:** Public endpoints strip all reporter identities. Exact incident coordinates are deterministically fuzzed within a small privacy radius to protect the eyewitness's exact vantage point or physical hiding spot.
2. **Anti-Spoofing Telemetry:** Remote adversaries cannot drop pins in cities they are not physically located in. The server enforces a mandatory 200m hardware GPS Haversine verification before accepting submissions.
3. **Sliding-Window Rate Limiting:** Enforces strict per-IP and per-device rate ceilings on reporting, voting, and verification endpoints to thwart denial-of-service and bot-stuffing attacks.
4. **Zero-Budget Civic Sustainability:** Built strictly on open protocols (OpenStreetMap tiles, Photon geocoding, OSRM routing, VAPID Web Push), ensuring the platform can operate indefinitely without recurring monthly billing overhead.

---

## 6. Local Development & Setup Guide

### Prerequisites
Ensure your local development environment has the following installed:
* **Node.js:** `v20.0.0` or higher
* **pnpm:** `v9.0.0` or higher (`npm install -g pnpm`)
* **PostgreSQL:** `v15+` with the **PostGIS extension** enabled (e.g., local Docker or a free [Supabase](https://supabase.com) project)

### Step 1: Clone the Repository
```bash
git clone https://github.com/zarin-tasnim17/danger-zone-bd.git
cd danger-zone-bd
```

### Step 2: Install Monorepo Dependencies
```bash
pnpm install
```

### Step 3: Configure Environment Variables
Copy the example environment templates in the respective workspace packages:

#### In `apps/api/.env`:
```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN="http://localhost:3000"

# PostgreSQL connection with PostGIS enabled
DATABASE_URL="postgresql://postgres:[PASSWORD]@localhost:5432/danger_zone_bd?schema=public"
DIRECT_URL="postgresql://postgres:[PASSWORD]@localhost:5432/danger_zone_bd?schema=public"

# Authentication Secrets (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET="your-development-jwt-secret-min-32-chars"
JWT_REFRESH_SECRET="your-development-refresh-secret-min-32-chars"
CRON_SECRET="danger-zone-bd-cron-crawler-secret-2026"

# Default Administrator Credentials (for local seeding)
ADMIN_EMAIL="admin@safetymap.bd"
ADMIN_PASSWORD="AdminSafety@2026"

# Safe Routing & Map Settings
OSRM_BASE_URL="https://router.project-osrm.org"
```

#### In `apps/web/.env`:
```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:5000/api/v1"
NEXT_PUBLIC_SOCKET_URL="http://localhost:5000"
NEXT_PUBLIC_MAP_DEFAULT_LAYER="google_streets"
INTERNAL_API_URL="http://localhost:5000"
CRON_SECRET="danger-zone-bd-cron-crawler-secret-2026"
```

### Step 4: Database Setup & Seeding
Ensure PostgreSQL is running and PostGIS is enabled (`CREATE EXTENSION IF NOT EXISTS postgis;`). Then execute:

```bash
# Generate Prisma Client models
pnpm --filter api db:generate

# Apply database migrations
pnpm --filter api db:migrate

# Seed the administrator account
pnpm --filter api db:seed:admin

# Seed verified Bangladesh Police Stations (all 64 districts)
pnpm --filter api db:seed:safezones
```

### Step 5: Start Development Servers
Run the full-stack development pipeline via Turborepo:
```bash
pnpm dev
```
* **Frontend Web Application:** [http://localhost:3000](http://localhost:3000)
* **Backend REST/Socket API:** [http://localhost:5000/health](http://localhost:5000/health)
* **Administrator Portal:** [http://localhost:3000/admin](http://localhost:3000/admin) *(Log in with seeded admin credentials)*

---

## 7. Available Scripts & Command Reference

| Command | Workspace | Description |
| :--- | :--- | :--- |
| `pnpm dev` | Monorepo Root | Starts both frontend (port 3000) and backend API (port 5000) concurrently via Turbo. |
| `pnpm build` | Monorepo Root | Builds all workspace packages for production deployment. |
| `pnpm lint` | Monorepo Root | Executes ESLint across web and API codebases. |
| `pnpm typecheck` | Monorepo Root | Validates strict TypeScript compilation across the entire monorepo. |
| `pnpm --filter api test:api` | Backend API | Executes the comprehensive API test suite across all profiles. |
| `pnpm --filter web test:web` | Frontend Web | Executes the frontend component, contract, and workflow test runner. |
| `python tests/test_police_stations_e2e.py` | Root | Runs the 34-case opaque-box test suite verifying Bangladesh police geospatial data. |
| `node scripts/generate_code_appendix.js` | Monorepo Root | Compiles all 149 source files into a structured lab report code appendix. |

---

## 8. Testing & Quality Assurance

The codebase includes an extensive, multi-layered quality assurance matrix:

* **Backend Test Framework (`apps/api/tests/`):** Custom test harness testing functional routing, JWT authentication, RBAC authorization, PostGIS spatial queries, rate-limiting windows, and security regression.
* **Frontend Test Harness (`apps/web/tests/`):** Evaluates React component rendering, DOM mock environments, API contract schemas, location calibration, and emergency SOS triggers.
* **Geospatial Integrity Tests (`tests/test_police_stations_e2e.py`):** Standalone zero-dependency Python test suite validating coordinate bounds ($20.3^\circ\text{N} \le \text{lat} \le 26.8^\circ\text{N}$, $88.0^\circ\text{E} \le \text{lng} \le 92.7^\circ\text{E}$), station IDs, and district coverage across all 64 districts of Bangladesh.

---

## 9. Current Status & Strategic Roadmap

### Current Production State (Milestone 1 & 2 Complete)
- [x] Full-stack responsive web client deployed on Vercel.
- [x] Scalable Express & WebSocket API deployed on Render.
- [x] PostGIS spatial database hosted on Supabase PostgreSQL.
- [x] Hardware GPS anti-spoofing validation ($\le$ 200m Haversine limit).
- [x] Dynamic Time-To-Live (TTL) category report decay worker.
- [x] Automated bilingual RSS news crawler with NLP classification.
- [x] Curated safe-haven directory covering police facilities across all 64 districts.
- [x] Safe navigation routing with OSRM hazard avoidance.
- [x] Complete administrator moderation suite with audit logging (`/admin`).

### Future Roadmap
- [ ] **Native Mobile Application (React Native / Flutter):** Dedicated mobile app offering persistent background GPS geofencing and zero-latency push alerts.
- [ ] **Offline Mesh Hazard Sync:** Peer-to-peer hazard distribution via Bluetooth Low Energy / Wi-Fi Direct during urban mobile network blackouts.
- [ ] **Predictive Temporal Threat Modeling:** Machine learning analysis of historical incident data to warn commuters of high-risk corridors during late-night windows.
- [ ] **Emergency Dispatch Telemetry Integration:** Anonymized, aggregated hazard heatmaps shared with city corporations and National Emergency Service (999).

---

## 10. Contributors & License

### Project Contributors
* **Lead Engineers & Authors:** CSE 3104 Software Engineering Project Team
* **Target Community:** Citizens, commuters, and public safety stakeholders across the People's Republic of Bangladesh.

### License
This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with dedication for public safety and civic awareness in Bangladesh.**  
*If this project helps keep your commute safe, consider starring the repository ⭐!*

</div>
