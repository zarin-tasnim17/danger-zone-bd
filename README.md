# BD Safety Map

## Project Overview

BD Safety Map is a zero-budget, web-based, real-time, crowdsourced public safety and crime map for Bangladesh. It aims to allow users to submit real-time reports for various incidents and provide situational awareness through interactive maps.

> **Important Legal Disclaimer:** This is a public-safety application dealing with location data, anonymous submissions, and sensitive crime-related information. A thorough legal and privacy review (including Cyber Security Act considerations) must be conducted before public launch.

## Architecture

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, Leaflet, React-Leaflet, Zustand.
  - *Responsibilities:* UI, state management, map rendering, and communicating with the backend.
- **Backend:** Node.js, Express, TypeScript, Socket.IO, Prisma.
  - *Responsibilities:* Dedicated API and real-time service layer. Manages business logic, database interaction, and socket events.
- **Database:** PostgreSQL with PostGIS extension (e.g., Supabase Database).
  - *Options:* Supabase is recommended for its zero-deletion free tier (pauses after 7 days of inactivity).
- **Authentication:** Custom Backend Auth.
  - *Approach:* Email/password and Google OAuth managed entirely by the Express backend.
- **Monorepo Tooling:** pnpm workspaces, Turborepo.

## Hosting & Deployment Considerations

This project is designed for zero-budget hosting:
- **Frontend (Vercel or Netlify):** Standard static/SSR deployment.
- **Backend (Render):** Deployed as a web service. 
  - *Tradeoff:* Render's free tier sleeps after inactivity. The Socket.IO client in the frontend is configured to handle reconnections gracefully.

## Prerequisites

- **Node.js:** v20 or higher
- **pnpm:** v9 or higher
- **Database:** PostgreSQL with PostGIS enabled (Local or Hosted)

## Project Structure

```text
project-root/
├── apps/
│   ├── web/               # Next.js frontend
│   └── api/               # Express backend & Prisma schema
├── packages/
│   └── shared/            # Shared types and constants
├── .env.example
├── pnpm-workspace.yaml
└── turbo.json
```

## Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd <repo-name>
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Environment Variables:**
   Copy `.env.example` to `.env` in the root (or in respective `apps/*` folders as needed).
   Review the `.env.example` file for required placeholders for API URLs, database credentials, and OAuth secrets.

4. **Database & PostGIS Setup:**
   - **Hosted (Supabase):** Go to Database → Extensions, search for "postgis", and enable it. Set `DATABASE_URL` and `DIRECT_URL`.
   - **Local:** Run a PostGIS-enabled Docker container (e.g., `postgis/postgis`) and set `DATABASE_URL` accordingly.

5. **Prisma Commands:**
   Generate the Prisma client and run migrations (make sure your DB is accessible):
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

6. **Development Commands:**
   Start the entire stack (frontend on port 3000, backend on port 5000):
   ```bash
   pnpm dev
   ```

7. **Build Commands:**
   Build the applications for production:
   ```bash
   pnpm build
   ```

## Google OAuth Configuration
Future setup requires creating Google Cloud credentials and setting `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in the environment variables.

## Known Limitations
- Geospatial queries, marker clustering, user trust scores, voting, and report expiration are architectural foundations only and not fully implemented in this phase.
- Reconnection state sync for Socket.IO is a future scope.