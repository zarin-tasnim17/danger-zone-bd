const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'docs', 'LAB_REPORT_SOURCE_CODE.md');

// Mapping of custom 3-4 line descriptions for each file
const FILE_DESCRIPTIONS = {
  // Section 1
  'packages/shared/src/index.ts': 
`This file serves as the universal contract between the backend API and frontend clients.
It defines shared TypeScript interfaces, threat categories (e.g., SNATCHING, ARMED_ASSAULT, EXTORTION), severity levels, and report lifecycle statuses.
It also exports official Bangladeshi mobile number regex patterns and type guards used for cross-platform data validation.`,

  // Section 2
  'apps/api/prisma/schema.prisma':
`This file defines the PostgreSQL relational database schema and PostGIS spatial point geometries using Prisma ORM.
It models core platform entities including User, Report, Vote, ReportUpdate, ReportMedia, SafeZone, UserAlertZone, and ModerationLog.
It establishes relational foreign key constraints, cascade deletion behaviors, and spatial GIST indexing for sub-second geographical queries.`,

  // Section 3
  'apps/api/src/config/env.ts':
`This module validates and exposes strongly-typed environment variables for the backend application.
It utilizes Zod to parse configuration values such as DATABASE_URL, JWT secrets, CORS origins, and port bindings.
If any critical environment secret is missing or malformed, it halts server startup immediately with descriptive error logging.`,

  'apps/api/src/db/prisma.ts':
`This file instantiates and configures the singleton Prisma database client connected to PostgreSQL.
It manages database connection pooling, logging levels based on the active NODE_ENV, and graceful disconnection hooks.
The exported client instance is imported across all backend services to execute type-safe database queries.`,

  'apps/api/src/db/spatialUtils.ts':
`This utility module executes native PostGIS spatial queries for geospatial hazard calculation.
It defines functions to query reports within a dynamic geographical bounding box using ST_MakeEnvelope and ST_DWithin.
It also implements deterministic location fuzzing algorithms to protect reporter privacy on public map outputs.`,

  'apps/api/src/utils/jwt.ts':
`This utility provides cryptographic token generation and verification using jsonwebtoken.
It issues short-lived access tokens, long-lived refresh tokens, and scoped WebSocket authentication tokens.
It also verifies incoming token signatures and extracts claims including user ID, role, and verification status.`,

  'apps/api/src/utils/responseFormatter.ts':
`This helper standardizes all HTTP response payloads returned by the Express API.
It exports successResponse and errorResponse functions to ensure uniform JSON formatting across all endpoints.
This consistency simplifies client-side error handling, network parsing, and status code verification.`,

  'apps/api/src/app.ts':
`This file configures the core Express application instance and registers global middleware.
It applies security headers via Helmet, cross-origin resource sharing via CORS, JSON body parsing, and cookie parsing.
It binds all REST route modules under /api/v1 and attaches the centralized global error-handling middleware.`,

  'apps/api/src/server.ts':
`This is the main entry point for the backend server process.
It wraps the Express app with an HTTP server, initializes the Socket.io WebSocket server, and begins listening on the configured port.
It also registers graceful shutdown handlers for process termination signals (SIGTERM, SIGINT) to close database connections cleanly.`,

  // Section 4
  'apps/api/src/middleware/requireAuth.ts':
`This middleware protects private API routes by verifying the caller's JWT access token.
It extracts tokens from either HTTP-only cookies or the Authorization bearer header and decodes user identity.
If the token is invalid, expired, or missing, it blocks execution with a 401 Unauthorized response.`,

  'apps/api/src/middleware/requireRole.ts':
`This higher-order middleware enforces Role-Based Access Control (RBAC) across protected endpoints.
It checks whether the authenticated user's assigned role matches the required role (e.g., ADMIN or VERIFIED_RESPONDER).
Requests from users without adequate role privileges are rejected with a 403 Forbidden error.`,

  'apps/api/src/middleware/validateRequest.ts':
`This middleware performs runtime schema validation on incoming HTTP requests using Zod schemas.
It validates the request body, URL parameters, and query strings before forwarding control to controllers.
If validation fails, it formats the specific constraint violations into a clear 400 Bad Request error response.`,

  'apps/api/src/middleware/rateLimiter.ts':
`This module implements IP and device rate limiting using express-rate-limit.
It enforces tiered submission windows to prevent spam, denial-of-service attacks, and brute-force credential stuffing.
Separate limits are configured for standard reporting, verification uploads, and public map tile fetches.`,

  'apps/api/src/middleware/errorHandler.ts':
`This is the centralized Express error-handling middleware for all unhandled application exceptions.
It intercepts operational errors, database constraint exceptions, and syntax failures across the API pipeline.
It logs internal stack traces securely on the server while returning sanitized, structured error messages to clients.`,

  'apps/api/src/middleware/verifyWebhookSecret.ts':
`This middleware validates cryptographically signed webhook requests originating from external cron triggers.
It verifies the shared CRON_SECRET header to ensure scheduled news crawler runs cannot be triggered by unauthorized callers.
Requests lacking the matching secret key are immediately rejected with a 401 Unauthorized status.`,

  // Section 5
  'apps/api/src/services/authService.ts':
`This service encapsulates all authentication and session management logic.
It implements zero-friction anonymous device authentication via unique device tokens and email/password login for administrators.
It manages refresh token rotation, token revocation in PostgreSQL, and user credential validation using bcrypt.`,

  'apps/api/src/services/reportService.ts':
`This core service orchestrates incident report creation, spatial querying, and lifecycle status updates.
It enforces hardware GPS proximity checks (max 200m offset), computes category-based Time-To-Live (TTL) expiration, and queries PostGIS envelopes.
It also sanitizes public report payloads by stripping reporter PII and applying privacy location fuzzing.`,

  'apps/api/src/services/reportUpdateService.ts':
`This service manages situational updates appended to existing active incident reports.
It validates whether the contributor is the original author or a verified responder before saving updates.
When an update is recorded, it triggers real-time WebSocket notifications to inform nearby commuters.`,

  'apps/api/src/services/voteService.ts':
`This service handles community consensus voting (upvotes and downvotes) on active hazard reports.
It prevents duplicate votes by enforcing composite unique constraints on user ID and report ID.
Voting activity dynamically recalculates the report's community confirmation state and updates the author's trust score.`,

  'apps/api/src/services/userService.ts':
`This service manages user profile retrieval and verification document submissions.
It processes citizen verification requests for Bangladeshi mobile numbers (PHONE_OTP) and National ID cards (NID_DOCUMENT).
It also calculates user trust scores based on past reporting accuracy and community upvote ratios.`,

  'apps/api/src/services/safeZoneService.ts':
`This service provides access to verified emergency shelter infrastructure across Bangladesh.
It queries PostGIS spatial tables for police stations (Thanas and outposts across all 64 districts), police boxes, and 24/7 hospitals.
It returns contact telephone numbers and spatial coordinates to help distressed citizens locate the nearest refuge.`,

  'apps/api/src/services/safeRouteService.ts':
`This service integrates with the Open Source Routing Machine (OSRM) to calculate safety-aware transit paths.
It generates multi-modal route waypoints and spatial bounding envelopes between departure and destination coordinates.
It evaluates route geometry against active danger buffers to alert travelers to hazards intersecting their path.`,

  'apps/api/src/services/alertZoneService.ts':
`This service manages user-defined polygonal geofences for personalized danger alerts.
It stores custom geographic areas as PostGIS polygons linked to the user's account.
When new incidents are reported inside a user's active geofence, it triggers automated push notifications.`,

  'apps/api/src/services/geocodingService.ts':
`This service handles reverse geocoding between geographic coordinates and administrative boundaries in Bangladesh.
It resolves latitude and longitude coordinates to their corresponding division, district, and upazila.
This ensures news reports and citizen submissions are correctly indexed for administrative search filtering.`,

  'apps/api/src/services/privacyBlurService.ts':
`This utility service applies automated visual privacy protections to user-uploaded incident media.
It detects and blurs sensitive regions, personal faces, and vehicle license plates before public distribution.
This protects eyewitnesses and bystanders from retaliation while preserving visual evidence of the hazard.`,

  'apps/api/src/services/storageService.ts':
`This service manages object storage interactions with AWS S3 or Supabase Storage buckets.
It generates pre-signed upload URLs allowing clients to securely upload incident photographs directly.
It validates file mime types, enforces file size ceilings, and constructs immutable CDN media URLs.`,

  'apps/api/src/services/newsClassifierService.ts':
`This service implements a bilingual (Bangla and English) NLP classifier for scraped crime and safety news.
It analyzes article titles and summaries using contextual keyword dictionaries and regex patterns for 64 districts.
It assigns standardized threat categories (e.g., THEFT, ROBBERY, ARMED_ASSAULT) and severity ratings automatically.`,

  'apps/api/src/services/publisherRegistry.ts':
`This module maintains an authoritative registry of trusted Bangladeshi news publishers and RSS feed configurations.
It defines source names, base domains, regional focus areas, and RSS feed endpoints for major national dailies.
The crawler service references this registry to ingest verified, high-credibility press reports.`,

  'apps/api/src/services/newsCrawlerService.ts':
`This service executes automated RSS crawling across registered national news feeds.
It parses recent news items, deduplicates them against stored article GUIDs, and classifies geographic coordinates.
Matched incidents are ingested as "Press Confirmed" hazard reports or linked to existing citizen reports.`,

  'apps/api/src/services/newsVerificationService.ts':
`This service cross-references crowdsourced citizen reports with scraped news media articles.
It performs spatial-temporal correlation checks (matching reports within 500 meters and 24 hours).
When a match is confirmed, it upgrades the report's verification stage from unverified to press-corroborated.`,

  'apps/api/src/services/newsObservabilityService.ts':
`This service provides telemetry and metric tracking for automated news crawler executions.
It records run durations, total feeds checked, articles ingested, duplicates rejected, and classification failure rates.
Administrators can inspect these metrics through the admin portal to monitor crawler health and feed reliability.`,

  'apps/api/src/services/incidentDeduplicationService.ts':
`This service identifies and clusters duplicate or overlapping incident reports submitted by different users.
It evaluates geographic proximity, temporal alignment, and category matching to detect redundant reports.
This prevents map clutter and coordinates clustering while consolidating community confirmations.`,

  'apps/api/src/services/internationalIncidentFilter.ts':
`This service filters out international, foreign, and non-local news reports ingested from general news feeds.
It cross-references article text against a comprehensive database of Bangladeshi place names, divisions, and districts.
Articles referencing foreign conflicts or overseas crimes are rejected to maintain strict focus on Bangladesh safety.`,

  'apps/api/src/services/statsService.ts':
`This service aggregates platform-wide incident counts, severity distributions, and community reporting metrics.
It computes active hazard counts, resolved incidents, and district-level threat heat rankings.
It also broadcasts updated summary statistics over WebSockets when incidents are created or resolved.`,

  'apps/api/src/services/adminService.ts':
`This service implements privileged administrative moderation capabilities.
It handles manual incident verification, threat reclassification, report purging with recorded reasons, and user banning.
All administrative modifications execute within atomic database transactions that write immutable records to ModerationLog.`,

  // Section 6
  'apps/api/src/controllers/authController.ts':
`This controller handles HTTP endpoints for device registration, administrator login, and session token refreshing.
It reads request credentials, invokes authService methods, and sets secure HTTP-only cookies on responses.
It also manages user logout by clearing session cookies and revoking active refresh tokens in the database.`,

  'apps/api/src/controllers/reportController.ts':
`This controller manages REST endpoints for fetching, creating, and resolving hazard reports.
It handles PostGIS bounding-box viewport queries, validates incident submission payloads, and triggers real-time socket events.
It guarantees that public responses omit sensitive reporter identifiers and return fuzzed coordinates.`,

  'apps/api/src/controllers/reportUpdateController.ts':
`This controller handles requests to append follow-up situational updates to active incident reports.
It validates that updates originate from authorized users or verified responders before persisting them.
It returns updated report data and notifies connected clients of new incident developments.`,

  'apps/api/src/controllers/safeZoneController.ts':
`This controller serves endpoints for querying emergency safe-haven facilities (police stations and hospitals).
It accepts geographic bounding box and coordinate filters to return nearby shelters sorted by proximity.
It formats location names, categories, and verified phone numbers for emergency dialer integration.`,

  'apps/api/src/controllers/routingController.ts':
`This controller handles safe navigation route calculation requests between origin and destination coordinates.
It invokes safeRouteService to fetch OSRM navigation paths and intersects route waypoints with active hazard zones.
It returns primary and alternative paths along with warnings for any high-risk segments.`,

  'apps/api/src/controllers/alertController.ts':
`This controller manages user alert geofence subscriptions for custom hazard notifications.
It allows authenticated users to create, view, update, and delete monitored polygon geographic areas.
It ensures that users can only view and modify alert zones belonging to their own account.`,

  'apps/api/src/controllers/userController.ts':
`This controller handles endpoints for user profile inspection and citizen verification submissions.
It retrieves current user trust scores, reporting history counts, and verification statuses.
It also accepts NID document URLs and mobile phone numbers for responder privilege upgrades.`,

  'apps/api/src/controllers/adminController.ts':
`This controller exposes moderation endpoints reserved exclusively for authenticated administrators.
It handles actions such as banning disruptive device IDs, purging fraudulent reports, and reviewing verification queues.
It also exposes manual triggers for RSS news crawling and provides paginated audit log queries.`,

  'apps/api/src/controllers/mediaController.ts':
`This controller provides endpoints for uploading incident evidence photographs and obtaining pre-signed URLs.
It validates file sizes and extensions to ensure only safe image formats are stored in the media bucket.
It returns uploaded image metadata to attach to incident report submissions.`,

  'apps/api/src/controllers/voteController.ts':
`This controller handles endpoints for submitting community upvotes and downvotes on active incident reports.
It validates vote types, updates consensus tallies, and prevents double voting by the same user.
It returns updated score metrics and triggers live WebSocket updates for connected map clients.`,

  'apps/api/src/controllers/statsController.ts':
`This controller serves public summary statistics reflecting current platform activity and safety levels.
It delivers counts of active hazards, total resolved reports, and high-frequency category breakdowns.
These metrics power the landing dashboard banners and municipal hazard analytics charts.`,

  // Section 7
  'apps/api/src/routes/auth.ts':
`This file registers authentication HTTP routes under the /auth prefix.
It binds endpoints for anonymous device registration (/auth/device), admin login (/auth/login), and token refreshing (/auth/refresh).
It attaches request validation schemas and strict rate limiting to protect authentication gates.`,

  'apps/api/src/routes/reports.ts':
`This file defines the primary REST routes for incident reporting under /reports.
It configures endpoints for fetching reports in viewport bounds, retrieving report details by ID, submitting new hazards, and marking incidents resolved.
It enforces authentication, rate limiting, and request validation middleware on all mutation endpoints.`,

  'apps/api/src/routes/safeZones.ts':
`This file declares the routing endpoints for the safe-haven directory under /safe-zones.
It exposes public GET endpoints to query police stations, medical clinics, and 24/7 pharmacies across Bangladesh.
It applies query caching headers and spatial parameter validation to ensure responsive map layer rendering.`,

  'apps/api/src/routes/routing.ts':
`This file registers the safe routing calculation route under /routing.
It defines the POST /routing/safe-route endpoint, accepting origin and destination coordinates.
It validates input coordinates with Zod schemas and connects to the safe navigation controller.`,

  'apps/api/src/routes/alerts.ts':
`This file configures user alert zone routes under /alerts.
It provides endpoints to create, list, and delete custom polygon geofences for hazard notifications.
All routes in this module require active user authentication and validate polygon coordinate arrays.`,

  'apps/api/src/routes/users.ts':
`This file registers user management and profile endpoints under /users.
It binds the GET /users/me endpoint to fetch active session identity and trust metrics.
It also declares the POST /users/verify endpoint for submitting phone OTP and NID verification requests.`,

  'apps/api/src/routes/admin.ts':
`This file defines privileged administration routes under /admin.
It protects all contained endpoints with both requireAuth and requireRole(['ADMIN']) middleware.
It binds routes for user bans, report purges, verification approvals, audit logs, and crawler metrics.`,

  'apps/api/src/routes/media.ts':
`This file declares media upload endpoints under /media.
It binds routes to request pre-signed upload URLs and upload incident evidence attachments.
It applies rate limits and file size validation to prevent storage resource abuse.`,

  'apps/api/src/routes/cron.ts':
`This file registers external cron trigger endpoints under /cron.
It exposes the POST /cron/news-crawl endpoint invoked by scheduled cloud workers.
It protects the execution with verifyWebhookSecret middleware to prevent unauthorized crawling.`,

  'apps/api/src/routes/health.ts':
`This file defines service health check and monitoring endpoints under /health.
It verifies database connectivity and returns server uptime, memory usage, and operational status.
Cloud deployment platforms (e.g., Render) poll this endpoint to verify container availability.`,

  'apps/api/src/routes/stats.ts':
`This file registers public metric and analytics routes under /stats.
It exposes GET /stats to deliver summary platform figures for active reports and threat distributions.
It applies lightweight caching headers to ensure fast dashboard rendering under concurrent traffic.`,

  // Section 8
  'apps/api/src/sockets/index.ts':
`This module initializes and manages Socket.io real-time WebSocket communication.
It authenticates connecting socket clients using scoped JWT tokens and organizes them into regional rooms.
It exports event emitter functions to broadcast new reports, community votes, and administrative purges immediately.`,

  'apps/api/src/jobs/index.ts':
`This module serves as the central orchestrator for all scheduled background workers.
It exports an initialization function that registers the news crawler job, time-decay cleaner, and notification dispatcher.
It ensures that automated maintenance tasks start up cleanly when the backend application boots.`,

  'apps/api/src/jobs/newsCrawlerJob.ts':
`This background job executes automated news crawling on a recurring schedule (default every 10 minutes).
It uses a mutex lock to prevent overlapping runs and ingests recent public safety news across Bangladesh.
It also schedules a cold-start crawl shortly after server boot to ensure fresh news upon container wake.`,

  'apps/api/src/jobs/notificationWorker.ts':
`This worker processes and dispatches queued push notifications for active hazard alerts.
It queries users whose registered geofence polygons intersect newly reported incident coordinates.
It formats Web Push payloads and delivers notifications to subscribers via the Web Push Protocol.`,

  'apps/api/src/jobs/timeDecayJob.ts':
`This background worker enforces the temporal decay lifecycle of active incident reports.
It runs periodically to identify reports whose expiresAt timestamp has passed and marks them inactive.
This automated pruning ensures that outdated, temporary hazards do not linger on the live radar.`,

  'apps/api/src/scripts/seedAdmin.ts':
`This database script provisions and seeds the initial administrator account in PostgreSQL.
It reads ADMIN_EMAIL and ADMIN_PASSWORD from environment variables and generates secure bcrypt password hashes.
It guarantees that at least one verified administrator exists for moderation and dashboard access.`,

  'apps/api/src/scripts/seedSafeZones.ts':
`This seeding script populates the database with verified police stations and emergency facilities across all 64 districts of Bangladesh.
It reads curated geographic datasets, validates coordinates, and inserts PostGIS Point geometries into the SafeZone table.
This provides the foundational safe-haven directory used for emergency navigation.`,

  // Section 9
  'apps/web/store/useAuthStore.ts':
`This Zustand store manages client-side authentication state, user identity, and session tokens.
It coordinates silent anonymous device authentication on initial visit and administrator credential login.
It synchronizes authentication cookies, stores user trust metrics, and manages WebSocket authentication tokens.`,

  'apps/web/store/useIncidentStore.ts':
`This reactive Zustand store manages all incident data displayed across the frontend application.
It stores active reports, applied category and severity filters, and real-time report additions.
It listens to WebSocket events to dynamically insert new reports and remove purged hazards without page reloads.`,

  'apps/web/store/useMapStore.ts':
`This Zustand store coordinates map viewport state, user coordinates, active zoom level, and selected tile layers.
It manages GPS tracking accuracy markers, calibration modal visibility, and active search target coordinates.
It ensures synchronized map navigation between search bars, location buttons, and interactive pins.`,

  'apps/web/store/useFilterStore.ts':
`This store manages active search filters, category selections, and severity thresholds on the threat radar.
It provides action creators to toggle individual threat categories (e.g., snatching, extortion, accidents) or reset filters.
The active filters are referenced by map and feed components to filter displayed incidents client-side.`,

  'apps/web/store/useLanguageStore.ts':
`This lightweight Zustand store manages the active UI language selection between English (en) and Bengali (bn).
It persists the user's language preference in localStorage and triggers seamless UI re-rendering.
All components read this store to display localized text strings and danger category labels.`,

  'apps/web/store/useStatsStore.ts':
`This store holds aggregated platform safety statistics fetched from the /stats endpoint.
It tracks counts of total active incidents, resolved threats, verified safe zones, and high-risk zones.
It updates dynamically via real-time WebSocket events to reflect current safety trends across Bangladesh.`,

  'apps/web/store/useToastStore.ts':
`This store manages the display of non-blocking toast notifications across the web interface.
It supports success, warning, and error toast variants with automated auto-dismiss timers.
Components dispatch toast messages through this store to provide immediate visual feedback for user actions.`,

  // Section 10
  'apps/web/lib/api.ts':
`This utility module wraps the native browser fetch API with automatic base URL injection and credential handling.
It intercepts 401 Unauthorized responses to silently attempt session refreshing via /auth/refresh before failing.
It also formats network exceptions into structured ApiError instances for consistent component-level error handling.`,

  'apps/web/lib/socket.ts':
`This module manages the client-side Socket.io WebSocket connection to the backend server.
It handles automatic reconnection, maintains scoped authentication tokens, and exports socket event subscription helpers.
It ensures that map markers, community vote counts, and report purges synchronize across browsers in real time.`,

  'apps/web/lib/supabase.ts':
`This helper initializes and exports the Supabase client for frontend storage operations.
It configures public bucket access for uploading and retrieving user incident photographs.
It ensures that image attachments are fetched through secure, CDN-cached media URLs.`,

  'apps/web/lib/gpsVerification.ts':
`This utility validates device hardware GPS coordinates against user-selected incident pin locations.
It implements the Haversine distance formula to calculate the exact spatial offset between the two points.
It alerts users if their dropped pin exceeds the permitted 200-meter anti-spoofing threshold.`,

  'apps/web/lib/proximityEngine.ts':
`This module calculates real-time proximity between the user's live GPS position and surrounding hazard reports.
It identifies nearby high-severity incidents within danger thresholds (e.g., 500m or 1km) and calculates distance deltas.
It powers the warning banners that alert commuters when they are approaching an active danger zone.`,

  'apps/web/lib/audioAlert.ts':
`This utility generates browser audio alerts using the Web Audio API without requiring external audio assets.
It synthesizes multi-tone audible chimes for imminent hazard warnings, emergency SOS triggers, and high-priority alerts.
It respects user sound preferences and browser autoplay permission policies.`,

  'apps/web/lib/vibrationAlert.ts':
`This helper triggers physical haptic vibration patterns on supported mobile devices using navigator.vibrate.
It provides distinct vibration cadences for standard notifications, nearby hazard warnings, and emergency SOS alerts.
This provides tactile warnings to users walking or commuting in noisy urban environments.`,

  'apps/web/lib/systemNotification.ts':
`This utility interfaces with the browser Notification API to display native desktop and mobile OS notifications.
It requests user notification permissions and formats notification title, icon, and body strings.
It ensures users receive critical safety alerts even when the browser tab is minimized or in the background.`,

  'apps/web/lib/webPush.ts':
`This module handles Web Push subscription management using VAPID public keys.
It converts URL-safe base64 VAPID keys to Uint8Array format, registers PushManager subscriptions, and sends them to the API.
This enables persistent server-initiated push alerts even after the browser session closes.`,

  'apps/web/lib/mediaUpload.ts':
`This utility orchestrates incident photo uploads from the browser to cloud storage buckets.
It compresses high-resolution photographs client-side, requests pre-signed upload URLs from the API, and transmits binary data.
It returns uploaded image URLs to attach to the final incident submission payload.`,

  'apps/web/lib/deviceUtils.ts':
`This utility generates and retrieves persistent anonymous device identifiers stored in browser localStorage.
It uses crypto.randomUUID to mint unique tokens for silent citizen device authentication (/auth/device).
It also provides helper methods to reset device identity when requested in the user profile.`,

  'apps/web/lib/filterUtils.ts':
`This helper provides pure utility functions to filter and sort arrays of incident reports.
It applies category filtering, severity filtering, time-range slicing, and text search across reports.
It ensures fast, unlagged client-side filtering without redundant network requests.`,

  'apps/web/lib/incidentUtils.ts':
`This module provides formatting and calculation helpers for incident report data.
It calculates remaining time before incident expiration, formats relative timestamps (e.g., "5 minutes ago"), and computes net community votes.
It also translates threat statuses into user-friendly localized status badges.`,

  'apps/web/lib/incidentCategoryVisuals.ts':
`This configuration module maps threat categories to their visual styling attributes.
It defines color palettes (e.g., orange for snatching, red for armed assault), Lucide icon associations, and badge styles.
This ensures consistent, recognizable visual hierarchy across map markers, feeds, and detail cards.`,

  'apps/web/lib/mapMarkerUtils.ts':
`This utility creates customized Leaflet HTML markers and SVG icons for map rendering.
It constructs pulsating threat markers, category badges, and color-coded safe-zone pins.
It optimizes marker DOM complexity to maintain smooth 60 FPS panning and zooming on mobile browsers.`,

  'apps/web/lib/safeZoneMeta.ts':
`This helper module defines metadata, icons, and category descriptors for emergency safe-haven facilities.
It maps facility types (police stations, police boxes, hospitals, pharmacies) to distinct visual icons and colors.
It also formats emergency telephone numbers for direct click-to-call dialing.`,

  'apps/web/lib/translations.ts':
`This file contains the bilingual translation dictionary for English and Bengali (বাংলা) UI strings.
It provides translations for navigation menus, danger category names, severity levels, modal prompts, and error notices.
It is imported by components across the application to ensure complete bilingual localization.`,

  'apps/web/lib/initial-data.ts':
`This file provides fallback baseline data and default geographic coordinates for initial application loading.
It defines standard map centering coordinates for Bangladesh (Dhaka center) and fallback category lists.
This prevents empty state flashing before live API data finishes fetching.`,

  // Section 11
  'apps/web/components/layout/Navbar.tsx':
`This component renders the primary responsive application navigation header.
It includes brand logos, live threat alerts, language toggle buttons (EN/BN), navigation links, and administrative console access.
It features a mobile collapsible drawer menu for seamless navigation on smartphone screens.`,

  'apps/web/components/layout/CategoryFilterPopover.tsx':
`This component renders a floating dropdown popover allowing users to filter map incidents by threat category.
Users can toggle individual categories (e.g., theft, snatching, armed assault, road hazards) or select all.
It displays active filter count badges and updates the map radar dynamically in real time.`,

  'apps/web/components/layout/RouteTestNav.tsx':
`This component renders a navigation helper bar used to test and verify application routes.
It provides quick links to all application pages during testing and development.
It adapts dynamically to screen widths and can be toggled without cluttering user interfaces.`,

  'apps/web/components/map/MapClient.tsx':
`This is the core interactive mapping component built with React-Leaflet.
It renders base tile layers, clusters hazard markers, draws danger zones, and handles map click events.
It coordinates viewport boundary updates with the backend to load incidents dynamically as the user pans.`,

  'apps/web/components/map/DynamicMap.tsx':
`This component dynamically loads the Leaflet map client using Next.js dynamic import with SSR disabled.
Because Leaflet requires browser window and DOM APIs, this dynamic wrapper prevents server-side rendering errors.
It displays a sleek skeleton loading state while the map bundle initializes.`,

  'apps/web/components/map/LocationAccuracyBanner.tsx':
`This component displays a warning banner when device GPS location accuracy is degraded or unavailable.
It alerts the user to potential geolocation discrepancies and provides a button to trigger location calibration.
This prevents accidental report rejections caused by inaccurate device positioning.`,

  'apps/web/components/map/LocationCalibrationModal.tsx':
`This interactive modal allows users to calibrate their location by dragging an interactive pin on a focused map.
It calculates distance deltas between hardware GPS readings and user-adjusted coordinates.
It guides users to align their location within the 200-meter anti-spoofing threshold before reporting.`,

  'apps/web/components/map/LocationSearchBar.tsx':
`This component provides an autocomplete location search bar to quickly pan the map to specific areas.
It searches Bangladeshi divisions, districts, upazilas, and major landmarks using local datasets and geocoding.
Selecting a search suggestion smoothly pans the interactive map to the target coordinates.`,

  'apps/web/components/map/MapLayerSwitcher.tsx':
`This floating control lets users toggle between multiple map tile basemaps.
It supports OpenStreetMap Standard, Google Streets, and Google Satellite Hybrid layers.
Users can switch layers instantly to evaluate street geography or aerial terrain context.`,

  'apps/web/components/map/HazardProximityBanner.tsx':
`This critical safety banner warns commuters when they are physically near an active, high-severity hazard.
It displays distance in meters, incident category, and time elapsed since the report was filed.
It includes quick actions to view the hazard details or recalculate a safe route away from the area.`,

  'apps/web/components/map/IncidentMiniMap.tsx':
`This compact map component renders a lightweight, non-interactive visual preview of a specific incident location.
It displays a single centered hazard marker surrounded by its estimated danger radius circle.
It is embedded within incident detail cards and report confirmation dialogs.`,

  'apps/web/components/map/DynamicIncidentMiniMap.tsx':
`This is the dynamic client-only wrapper for the IncidentMiniMap component with SSR disabled.
It loads Leaflet mini-map dependencies on demand to optimize initial page bundle size.
It renders a placeholder skeleton until client-side map rendering is ready.`,

  'apps/web/components/incidents/IncidentFeed.tsx':
`This component renders a chronological, filterable list of active and recent public safety incidents.
Each card displays category badges, verification status, relative timestamp, distance, and community upvote counts.
Users can click any incident card to view details or zoom the main radar map directly to the hazard pin.`,

  'apps/web/components/incidents/ReportIncidentModal.tsx':
`This modal encapsulates the multi-step hazard reporting workflow for eyewitnesses.
It allows users to select threat categories, pick locations, enter descriptions, and attach photos.
It enforces hardware GPS proximity validation before submitting the report to ensure zero-spoof data integrity.`,

  'apps/web/components/report/ReportPinMap.tsx':
`This interactive map component is embedded inside the reporting page to allow precise pin placement.
It centers on user GPS coordinates and allows draggable pin adjustments within the 200m validation boundary.
It renders a visual geofence circle indicating the allowable reporting perimeter.`,

  'apps/web/components/safe-zones/SafeZonesMap.tsx':
`This component visualizes the safe-haven directory overlay on the interactive map.
It displays color-coded markers for police stations, police outposts, and emergency hospitals.
Clicking any safe-haven marker opens a popup with facility names, distance, and one-touch phone dialer links.`,

  'apps/web/components/routes/RoutePathMap.tsx':
`This component renders safe navigation route polylines and hazard intersection buffers on the map.
It visualizes calculated transit paths from origin to destination and highlights segments passing near active hazards.
It assists commuters in choosing safer alternative routes around danger hotspots.`,

  'apps/web/components/alerts/PolygonDrawerMap.tsx':
`This component provides an interactive map canvas for drawing custom polygon alert geofences.
Users can click to plot vertices defining a geographic perimeter (e.g., around their home or commute path).
Saved polygons are stored in PostgreSQL to trigger automated push notifications for incidents inside the boundary.`,

  'apps/web/components/emergency/EmergencySosPill.tsx':
`This persistent floating emergency button provides immediate access to critical crisis services.
With one tap, it reveals rapid-dial buttons for the National Emergency Service (999) and local police stations.
It also features an emergency siren toggle that plays synthesized alarm tones to deter attackers.`,

  'apps/web/components/emergency/SafetyTutorialModal.tsx':
`This modal provides onboarding instructions for first-time visitors to DangerZoneBD.
It explains how to interpret threat marker colors, how to report hazards anonymously, and how to verify location.
It helps new users quickly understand the platform's public safety tools and verification badges.`,

  'apps/web/components/auth/AdminLoginGateway.tsx':
`This component renders the secure administrator authentication gateway at /admin.
It provides a credential form for administrators to log in using verified email and password combinations.
Upon authentication, it stores secure session cookies and unlocks the moderation dashboard controls.`,

  'apps/web/components/admin/AdminHeader.tsx':
`This component renders the top status header of the administrator dashboard.
It displays active admin credentials, quick metric summary badges, and an automated news crawler status ticker.
It also includes buttons to trigger manual news crawls and log out securely.`,

  'apps/web/components/admin/AdminTabsNav.tsx':
`This component renders the navigation tab switcher within the administrator moderation portal.
It allows administrators to switch between Reports, Users, Verifications, Audit Logs, and Analytics views.
It displays notification badges indicating pending verification submissions and unreviewed reports.`,

  'apps/web/components/admin/AdminReportsSection.tsx':
`This section component renders the moderation queue of all crowdsourced incident reports.
Administrators can search by description, filter by category or status, and inspect incident details.
It provides action buttons to verify reports, reclassify categories, or open the purge dialog.`,

  'apps/web/components/admin/AdminUsersSection.tsx':
`This section component allows administrators to inspect user activity and enforce platform defense policies.
It lists user IDs, trust scores, verification statuses, report counts, and current ban states.
Administrators can ban abusive device IDs or restore suspended accounts with recorded moderation reasons.`,

  'apps/web/components/admin/AdminVerificationsSection.tsx':
`This section component manages citizen verification submissions for phone OTP and NID documents.
Administrators can inspect uploaded document images, verify submitted phone numbers, and review identity claims.
It provides buttons to approve requests (upgrading user role to VERIFIED_RESPONDER) or reject them with reasons.`,

  'apps/web/components/admin/AdminLogsSection.tsx':
`This section component renders an immutable, paginated audit trail of all administrative actions.
It displays logs for report purges, user bans, verification approvals, and category reclassifications.
Each entry records the acting administrator, target ID, action type, reason, and exact timestamp.`,

  'apps/web/components/admin/AdminAnalyticsSection.tsx':
`This section component visualizes platform threat analytics and historical reporting trends.
It renders charts showing incident frequency by category, daily submission volumes, and district hazard distribution.
These visualizations assist administrators in identifying emerging crime hotspots across Bangladesh.`,

  'apps/web/components/admin/AdminPurgeModal.tsx':
`This modal prompts administrators for a mandatory reason before permanently purging an incident report.
Purging an incident removes it from the public map and broadcasts a real-time PURGE event over WebSockets.
The entered reason is permanently recorded in ModerationLog to maintain moderation transparency.`,

  'apps/web/components/admin/AdminBanModal.tsx':
`This modal captures the formal justification required when an administrator bans a user or device ID.
It validates that the reason meets minimum length requirements before submitting the ban request.
Banned accounts are immediately prevented from submitting new reports or casting community votes.`,

  'apps/web/components/admin/AdminRejectModal.tsx':
`This modal allows administrators to record specific explanations when rejecting a citizen verification request.
It provides predefined and custom rejection reasons (such as unreadable documents or mismatched phone numbers).
The recorded feedback is returned to the user to guide them in re-submitting valid documents.`,

  'apps/web/components/admin/AdminShortcutsModal.tsx':
`This modal displays a quick-reference guide of keyboard shortcuts available within the admin portal.
It enables administrators to navigate tabs, filter queues, and trigger moderation actions rapidly using keystrokes.
This streamlines moderation workflows during high-volume breaking safety situations.`,

  'apps/web/components/admin/types.ts':
`This file defines TypeScript type definitions and interfaces used across the administrator panel components.
It types moderation tab states, audit log records, verification review payloads, and crawler metrics.
This ensures strict type safety across all administrative UI modules.`,

  'apps/web/components/ui/Button.tsx':
`This reusable UI primitive renders styled interactive buttons with multiple visual variants and sizes.
It supports primary, secondary, danger, ghost, and outline styles with built-in loading spinner states.
It enforces consistent hover effects, focus rings, and disabled behaviors across the application.`,

  'apps/web/components/ui/GlassCard.tsx':
`This component renders a modern glassmorphic card container with backdrop blur and border styling.
It is used across the map dashboard, incident feed, and detail views to overlay panels cleanly on map tiles.
It accepts custom padding and hover animation options.`,

  'apps/web/components/ui/Modal.tsx':
`This reusable primitive renders accessible modal dialogs with backdrop blur and keyboard escape dismissal.
It manages focus trapping, background scroll locking, and smooth entrance and exit animations.
It serves as the foundation for reporting forms, calibration dialogs, and moderation modals.`,

  'apps/web/components/ui/Badge.tsx':
`This component renders status and category indicator badges with tailored color themes.
It formats verification states (Unverified, Community Confirmed, Press Confirmed) and severity levels.
It ensures consistent visual tagging across map popups, feed cards, and detail pages.`,

  'apps/web/components/ui/ToastContainer.tsx':
`This component renders the global toast notification viewport anchored to the screen edge.
It subscribes to useToastStore to display non-intrusive floating alert messages.
It renders entrance transitions and automatically dismisses toasts after their configured duration.`,

  'apps/web/components/pwa/ServiceWorkerRegister.tsx':
`This client component registers the Progressive Web App (PWA) service worker on initial page load.
It enables offline asset caching, faster repeat visits, and background Web Push notification reception.
It checks browser serviceWorker compatibility before executing registration.`,

  // Section 12
  'apps/web/app/layout.tsx':
`This is the root Next.js App Router layout component wrapping all application pages.
It defines global HTML metadata, OpenGraph tags, responsive viewport settings, and font imports.
It embeds the global ToastContainer and ServiceWorkerRegister components across the entire site.`,

  'apps/web/app/page.tsx':
`This is the primary landing page and live interactive threat radar of DangerZoneBD.
It integrates the full-screen dynamic map client, category filter popovers, search bar, and incident feed drawer.
It orchestrates live WebSocket incident streaming so commuters immediately see real-time local hazards.`,

  'apps/web/app/report/page.tsx':
`This page renders the dedicated hazard reporting interface for eyewitnesses.
It guides users through category selection, pin calibration within the 200m GPS boundary, and photo attachment.
It submits validated incident reports to the backend and redirects the user to the live map.`,

  'apps/web/app/reports/[id]/page.tsx':
`This dynamic route page renders comprehensive details for a single specific incident report.
It displays full incident descriptions, category and severity badges, attached photos, and community voting controls.
It also features an embedded mini-map showing the danger perimeter and a list of situational updates.`,

  'apps/web/app/safe-zones/page.tsx':
`This page renders the national safe-haven directory and emergency refuge locator.
It displays an interactive map of verified police stations and 24/7 hospitals across all 64 districts of Bangladesh.
Users can filter facilities by category, search by district name, and click to initiate direct phone calls.`,

  'apps/web/app/routes/page.tsx':
`This page provides the safety-aware route navigation engine.
Users enter departure and destination points to calculate multi-modal walking and driving routes via OSRM.
The page renders the transit path overlaid on the map and highlights any active hazards intersecting the route.`,

  'apps/web/app/alerts/page.tsx':
`This page enables users to manage personalized danger alert geofences.
Users can draw custom polygon boundaries around their home, workplace, or regular transit corridors.
It displays active geofences and allows users to toggle alert notifications for incidents within those boundaries.`,

  'apps/web/app/feed/page.tsx':
`This page presents a full-screen, chronological feed of all recent safety incidents across Bangladesh.
It provides advanced multi-category filters, district dropdowns, and search bars for civic awareness.
Users can review community confirmations, read press citations, and click to view map locations.`,

  'apps/web/app/profile/page.tsx':
`This page displays the user's current identity profile, community trust score, and reporting history.
It allows anonymous users to reset their device identity or submit NID and mobile phone verification.
Approved verifications upgrade user trust, allowing their reports to gain faster community confirmation.`,

  'apps/web/app/admin/page.tsx':
`This page renders the comprehensive administrator moderation portal.
It gates access behind the AdminLoginGateway for unauthenticated users and presents moderation tabs for admins.
Administrators can purge reports, ban malicious users, approve responder verifications, and inspect audit trails.`,

  'apps/web/app/login/page.tsx':
`This page provides a dedicated standalone login route that redirects administrators directly to /admin.
It ensures that administrative users accessing the standard /login URL are seamlessly routed to the admin portal.
It maintains backwards compatibility while keeping citizen access registration-free.`,

  'apps/web/app/health/page.tsx':
`This page displays client-side diagnostics and system health indicators.
It verifies WebSocket connectivity, API server responsiveness, geolocation permissions, and push notification status.
It helps users and developers diagnose local device connectivity issues during testing.`,

  'apps/web/app/dev-test/page.tsx':
`This developer sandbox page provides diagnostic tools for testing frontend components and workflows.
It allows developers to simulate GPS coordinates, trigger mock audio alarms, and inspect raw API payloads.
It is restricted to development environments to facilitate rapid feature verification.`,

  'apps/web/app/api/cron/news-crawl/route.ts':
`This Next.js serverless route handler acts as the external webhook receiver for scheduled news crawler triggers.
It verifies incoming CRON_SECRET headers before forwarding the execution request to the backend API.
Cron scheduling services (e.g., cron-job.org or Vercel Cron) ping this endpoint on regular intervals.`,

  'apps/web/app/api/health/route.ts':
`This Next.js API route handler provides a lightweight health check endpoint for the web deployment.
It returns deployment status, environment name, and timestamps to monitoring services.
Hosting providers (e.g., Vercel) query this endpoint to verify frontend container availability.`,

  // Section 13
  'package.json':
`This is the root configuration file for the DangerZoneBD monorepo workspace.
It configures pnpm workspaces, defines shared development dependencies, and registers global pipeline scripts.
Scripts include recursive build, lint, typecheck, and database generation commands.`,

  'turbo.json':
`This configuration file defines the build pipelines and caching rules for Turborepo.
It declares task dependencies (e.g., ensuring db:generate runs before build) and specifies cache output directories.
This accelerates continuous integration and local builds by caching unchanged build artifacts.`,

  'render.yaml':
`This infrastructure-as-code specification configures the backend deployment on Render.
It declares environment variables, build commands, start commands, health check paths, and auto-scaling settings.
It automates the production deployment of the Express.js API and WebSocket server.`,

  'apps/api/package.json':
`This file manages dependencies, scripts, and package metadata for the Express backend application.
It lists dependencies including Express, Prisma, Socket.io, Zod, bcrypt, jsonwebtoken, and RSS parser.
It defines development scripts for live TypeScript watching, migrations, and test execution.`,

  'apps/web/package.json':
`This file manages dependencies and build scripts for the Next.js frontend web application.
It lists dependencies including Next.js, React, Tailwind CSS, Leaflet, React-Leaflet, Zustand, and Lucide icons.
It defines scripts for Next.js development, production building, and static export.`,

  'packages/shared/package.json':
`This file defines the configuration and metadata for the @repo/shared internal workspace package.
It configures TypeScript compilation exports so that shared types and constants can be imported by both api and web.
It ensures that shared domain contracts remain synchronized across the entire monorepo.`,
};

const SECTIONS = [
  {
    title: '1. Shared Domain Contracts & Data Models',
    description: 'Universal cross-platform types, schema constants, threat classifications, and validation regular expressions shared between API and Web clients.',
    files: [
      'packages/shared/src/index.ts',
    ]
  },
  {
    title: '2. Database Schema & Entity Relational Definitions (Prisma & PostGIS)',
    description: 'PostgreSQL schema definitions with PostGIS geospatial spatial point data types, relational constraints, indexing, and cascade behaviors.',
    files: [
      'apps/api/prisma/schema.prisma',
    ]
  },
  {
    title: '3. Backend Server Core & Infrastructure Layer',
    description: 'Server entry point, Express application bootstrapping, environment variable validation, database client instantiation, and PostGIS spatial query utilities.',
    files: [
      'apps/api/src/config/env.ts',
      'apps/api/src/db/prisma.ts',
      'apps/api/src/db/spatialUtils.ts',
      'apps/api/src/utils/jwt.ts',
      'apps/api/src/utils/responseFormatter.ts',
      'apps/api/src/app.ts',
      'apps/api/src/server.ts',
    ]
  },
  {
    title: '4. Backend Security & Middleware Layer',
    description: 'JWT authorization gates, role-based access control, rate limiters, schema validators, error handlers, and webhook verification.',
    files: [
      'apps/api/src/middleware/requireAuth.ts',
      'apps/api/src/middleware/requireRole.ts',
      'apps/api/src/middleware/validateRequest.ts',
      'apps/api/src/middleware/rateLimiter.ts',
      'apps/api/src/middleware/errorHandler.ts',
      'apps/api/src/middleware/verifyWebhookSecret.ts',
    ]
  },
  {
    title: '5. Backend Core Business Services & Threat Intelligence',
    description: 'Business logic for incident reports, safe havens, safe routing, news classification, automated RSS scraping, deduplication, trust scoring, and admin actions.',
    files: [
      'apps/api/src/services/authService.ts',
      'apps/api/src/services/reportService.ts',
      'apps/api/src/services/reportUpdateService.ts',
      'apps/api/src/services/voteService.ts',
      'apps/api/src/services/userService.ts',
      'apps/api/src/services/safeZoneService.ts',
      'apps/api/src/services/safeRouteService.ts',
      'apps/api/src/services/alertZoneService.ts',
      'apps/api/src/services/geocodingService.ts',
      'apps/api/src/services/privacyBlurService.ts',
      'apps/api/src/services/storageService.ts',
      'apps/api/src/services/newsClassifierService.ts',
      'apps/api/src/services/publisherRegistry.ts',
      'apps/api/src/services/newsCrawlerService.ts',
      'apps/api/src/services/newsVerificationService.ts',
      'apps/api/src/services/newsObservabilityService.ts',
      'apps/api/src/services/incidentDeduplicationService.ts',
      'apps/api/src/services/internationalIncidentFilter.ts',
      'apps/api/src/services/statsService.ts',
      'apps/api/src/services/adminService.ts',
    ]
  },
  {
    title: '6. Backend Express API Controllers',
    description: 'HTTP request handlers translating REST input to service invocations, formatting responses, and managing auth cookies.',
    files: [
      'apps/api/src/controllers/authController.ts',
      'apps/api/src/controllers/reportController.ts',
      'apps/api/src/controllers/reportUpdateController.ts',
      'apps/api/src/controllers/safeZoneController.ts',
      'apps/api/src/controllers/routingController.ts',
      'apps/api/src/controllers/alertController.ts',
      'apps/api/src/controllers/userController.ts',
      'apps/api/src/controllers/adminController.ts',
      'apps/api/src/controllers/mediaController.ts',
      'apps/api/src/controllers/voteController.ts',
      'apps/api/src/controllers/statsController.ts',
    ]
  },
  {
    title: '7. Backend Express Route Definitions',
    description: 'Route registries binding URIs, rate limiters, validation schemas, and controller endpoints.',
    files: [
      'apps/api/src/routes/auth.ts',
      'apps/api/src/routes/reports.ts',
      'apps/api/src/routes/safeZones.ts',
      'apps/api/src/routes/routing.ts',
      'apps/api/src/routes/alerts.ts',
      'apps/api/src/routes/users.ts',
      'apps/api/src/routes/admin.ts',
      'apps/api/src/routes/media.ts',
      'apps/api/src/routes/cron.ts',
      'apps/api/src/routes/health.ts',
      'apps/api/src/routes/stats.ts',
    ]
  },
  {
    title: '8. Real-Time WebSockets, Background Cron & Seeding Scripts',
    description: 'Socket.io event broadcasters, scheduled background cron workers, time-decay workers, and database seed scripts.',
    files: [
      'apps/api/src/sockets/index.ts',
      'apps/api/src/jobs/index.ts',
      'apps/api/src/jobs/newsCrawlerJob.ts',
      'apps/api/src/jobs/notificationWorker.ts',
      'apps/api/src/jobs/timeDecayJob.ts',
      'apps/api/src/scripts/seedAdmin.ts',
      'apps/api/src/scripts/seedSafeZones.ts',
    ]
  },
  {
    title: '9. Frontend Global State Management (Zustand Stores)',
    description: 'Client-side reactive state stores managing authentication, live incidents, active map state, search filters, and translations.',
    files: [
      'apps/web/store/useAuthStore.ts',
      'apps/web/store/useIncidentStore.ts',
      'apps/web/store/useMapStore.ts',
      'apps/web/store/useFilterStore.ts',
      'apps/web/store/useLanguageStore.ts',
      'apps/web/store/useStatsStore.ts',
      'apps/web/store/useToastStore.ts',
    ]
  },
  {
    title: '10. Frontend Network, WebSockets & Client Utilities',
    description: 'Fetch wrappers with auto-refresh, WebSocket lifecycle handlers, hardware GPS helpers, English/Bengali translations, and map layer configurations.',
    files: [
      'apps/web/lib/api.ts',
      'apps/web/lib/socket.ts',
      'apps/web/lib/supabase.ts',
      'apps/web/lib/gpsVerification.ts',
      'apps/web/lib/proximityEngine.ts',
      'apps/web/lib/audioAlert.ts',
      'apps/web/lib/vibrationAlert.ts',
      'apps/web/lib/systemNotification.ts',
      'apps/web/lib/webPush.ts',
      'apps/web/lib/mediaUpload.ts',
      'apps/web/lib/deviceUtils.ts',
      'apps/web/lib/filterUtils.ts',
      'apps/web/lib/incidentUtils.ts',
      'apps/web/lib/incidentCategoryVisuals.ts',
      'apps/web/lib/mapMarkerUtils.ts',
      'apps/web/lib/safeZoneMeta.ts',
      'apps/web/lib/translations.ts',
      'apps/web/lib/initial-data.ts',
    ]
  },
  {
    title: '11. Frontend Reusable UI & Leaflet Map Components',
    description: 'Interactive Leaflet radar map, hardware calibration modals, hazard banners, safe zone map overlays, and admin panel modules.',
    files: [
      'apps/web/components/layout/Navbar.tsx',
      'apps/web/components/layout/CategoryFilterPopover.tsx',
      'apps/web/components/layout/RouteTestNav.tsx',
      'apps/web/components/map/MapClient.tsx',
      'apps/web/components/map/DynamicMap.tsx',
      'apps/web/components/map/LocationAccuracyBanner.tsx',
      'apps/web/components/map/LocationCalibrationModal.tsx',
      'apps/web/components/map/LocationSearchBar.tsx',
      'apps/web/components/map/MapLayerSwitcher.tsx',
      'apps/web/components/map/HazardProximityBanner.tsx',
      'apps/web/components/map/IncidentMiniMap.tsx',
      'apps/web/components/map/DynamicIncidentMiniMap.tsx',
      'apps/web/components/incidents/IncidentFeed.tsx',
      'apps/web/components/incidents/ReportIncidentModal.tsx',
      'apps/web/components/report/ReportPinMap.tsx',
      'apps/web/components/safe-zones/SafeZonesMap.tsx',
      'apps/web/components/routes/RoutePathMap.tsx',
      'apps/web/components/alerts/PolygonDrawerMap.tsx',
      'apps/web/components/emergency/EmergencySosPill.tsx',
      'apps/web/components/emergency/SafetyTutorialModal.tsx',
      'apps/web/components/auth/AdminLoginGateway.tsx',
      'apps/web/components/admin/AdminHeader.tsx',
      'apps/web/components/admin/AdminTabsNav.tsx',
      'apps/web/components/admin/AdminReportsSection.tsx',
      'apps/web/components/admin/AdminUsersSection.tsx',
      'apps/web/components/admin/AdminVerificationsSection.tsx',
      'apps/web/components/admin/AdminLogsSection.tsx',
      'apps/web/components/admin/AdminAnalyticsSection.tsx',
      'apps/web/components/admin/AdminPurgeModal.tsx',
      'apps/web/components/admin/AdminBanModal.tsx',
      'apps/web/components/admin/AdminRejectModal.tsx',
      'apps/web/components/admin/AdminShortcutsModal.tsx',
      'apps/web/components/admin/types.ts',
      'apps/web/components/ui/Button.tsx',
      'apps/web/components/ui/GlassCard.tsx',
      'apps/web/components/ui/Modal.tsx',
      'apps/web/components/ui/Badge.tsx',
      'apps/web/components/ui/ToastContainer.tsx',
      'apps/web/components/pwa/ServiceWorkerRegister.tsx',
    ]
  },
  {
    title: '12. Next.js App Router Pages & API Route Handlers',
    description: 'Application page views (threat radar, reporting, safe-zones, safe routing, alerts, profile, admin) and serverless route handlers.',
    files: [
      'apps/web/app/layout.tsx',
      'apps/web/app/page.tsx',
      'apps/web/app/report/page.tsx',
      'apps/web/app/reports/[id]/page.tsx',
      'apps/web/app/safe-zones/page.tsx',
      'apps/web/app/routes/page.tsx',
      'apps/web/app/alerts/page.tsx',
      'apps/web/app/feed/page.tsx',
      'apps/web/app/profile/page.tsx',
      'apps/web/app/admin/page.tsx',
      'apps/web/app/login/page.tsx',
      'apps/web/app/health/page.tsx',
      'apps/web/app/dev-test/page.tsx',
      'apps/web/app/api/cron/news-crawl/route.ts',
      'apps/web/app/api/health/route.ts',
    ]
  },
  {
    title: '13. Monorepo Configuration & Deployment Manifests',
    description: 'Turborepo pipeline orchestration, Render backend deployment specification, and Vercel frontend configurations.',
    files: [
      'package.json',
      'turbo.json',
      'render.yaml',
      'apps/api/package.json',
      'apps/web/package.json',
      'packages/shared/package.json',
    ]
  }
];

function generateAppendix() {
  console.log('[Generator] Building Lab Report Source Code Appendix with 3-4 line functional summaries...');
  let content = '';

  content += '# DangerZoneBD — Full Source Code Appendix for Lab Report\n';
  content += '### Course: CSE 3104 — Software Engineering / Web & Database Systems\n';
  content += `### Generated Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;

  content += '---\n\n';
  content += '## Architectural Table of Contents\n\n';
  content += 'This appendix organizes the complete DangerZoneBD codebase according to the **canonical dependency execution order**:\n';
  content += 'Shared Contracts → Database Entities → Backend Core & Middleware → Business Services → Controllers & Routes → Web State & Sockets → UI & Map Components → Next.js App Router Pages.\n\n';

  let globalIndex = 1;
  SECTIONS.forEach((sec) => {
    content += `### ${sec.title}\n`;
    content += `*${sec.description}*\n\n`;
    sec.files.forEach((f) => {
      content += `${globalIndex++}. \`${f}\`\n`;
    });
    content += '\n';
  });

  content += '---\n\n';

  globalIndex = 1;
  let totalLines = 0;
  let totalFiles = 0;

  SECTIONS.forEach((sec) => {
    content += `\n# ==============================================================================\n`;
    content += `# ${sec.title}\n`;
    content += `# ==============================================================================\n\n`;

    sec.files.forEach((relPath) => {
      const fullPath = path.join(ROOT_DIR, relPath);
      if (!fs.existsSync(fullPath)) {
        console.warn(`[Warning] Missing file: ${relPath}`);
        return;
      }

      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      const lines = fileContent.split('\n').length;
      totalLines += lines;
      totalFiles++;

      const ext = path.extname(relPath).replace('.', '');
      let lang = 'typescript';
      if (ext === 'prisma') lang = 'prisma';
      else if (ext === 'json') lang = 'json';
      else if (ext === 'yaml' || ext === 'yml') lang = 'yaml';
      else if (ext === 'tsx') lang = 'tsx';
      else if (ext === 'js' || ext === 'mjs') lang = 'javascript';

      const description = FILE_DESCRIPTIONS[relPath] || 
`This file is an integral component of the DangerZoneBD software architecture.
It implements supporting logic, data handling, or UI rendering for its respective layer.
It interacts directly with surrounding modules to ensure reliable and type-safe operation.`;

      content += `## [File ${globalIndex++}] \`${relPath}\`\n`;
      content += `> **Path:** \`${relPath}\`  \n`;
      content += `> **Lines of Code:** ${lines}  \n`;
      content += `> **Language:** \`${lang}\`\n\n`;
      content += `### What This Code Does\n`;
      content += `${description.trim()}\n\n`;

      content += '```' + lang + '\n';
      content += fileContent.replace(/\r\n/g, '\n');
      if (!fileContent.endsWith('\n')) content += '\n';
      content += '```\n\n';
      content += '---\n\n';
    });
  });

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, content, 'utf-8');

  console.log(`[Success] Successfully compiled ${totalFiles} source files (${totalLines} total lines) with 3-4 line functional summaries into:`);
  console.log(`-> ${OUTPUT_FILE}`);
}

generateAppendix();
