# DangerZoneBD — Product Knowledge Base & Strategic Direction

> **Document Status:** Authoritative Single Source of Truth  
> **Target Region:** People's Republic of Bangladesh  
> **Classification:** Public Safety, Civic Telemetry & Hazard Avoidance  
> **Last Updated:** November 2026  

---

## 1. Project Overview & Identity

**DangerZoneBD** (formerly *BD Safety Map*) is a zero-budget, real-time, crowdsourced civic hazard, danger-zone monitoring, and safe navigation platform engineered specifically for Bangladesh.

Its primary purpose is to convert fragmented eyewitness reports, localized news feeds, and civic hazard data into **immediate, actionable, geographically verified public safety intelligence**. Through an interactive multi-mode threat radar, a live incident stream, hardware-validated hazard reporting, an official safe-haven directory, and a hazard-aware navigation engine, DangerZoneBD gives citizens the real-time situational awareness required to navigate urban and regional Bangladesh safely.

### The Core Essence
DangerZoneBD is **not** a social media network, a crime sensationalism board, or a generic news scraper. It is a **civic emergency utility**. The platform exists to answer three fundamental questions for any citizen moving through Bangladesh:
1. **Where am I right now, and what hazards are active near me?**
2. **If danger breaks out, where is the nearest safe haven (police station, hospital, pharmacy)?**
3. **What is the safest street-level path to reach my destination while avoiding active threats?**

---

## 2. Project Motivation & The Real-World Problem

### 2.1 The Reality in Bangladesh
Citizens in urban centers like Dhaka, Chattogram, and Khulna, as well as suburban and regional transit corridors, face recurring threats to physical safety:
- **Violent Street Crime:** Mobile and bag snatching (*chintai*), armed robbery (*dakaiti*), extortion (*chandabaji*), and targeted assaults.
- **Youth Gang Clashes:** Localized turf wars and armed altercations (*teen gang conflicts*) that erupt unpredictably in public thoroughfares.
- **Infrastructural Hazards:** Broken pavements, unlit streets during blackouts, unshielded construction pits, open manholes, and catastrophic vehicle collisions.
- **Rapidly Shifting Civil Unrest:** Sudden roadblocks, vehicular arson, and violent street clashes that render customary commute routes impassable within minutes.

### 2.2 The Information Void
When acute safety threats materialize, citizens currently experience a complete informational breakdown:
- **Traditional Press is Too Slow:** News media reports incidents hours or days after the physical danger has subsided. A news report published at 10:00 PM about a violent clash at 5:00 PM does nothing to save a commuter walking home at 5:30 PM.
- **Social Media is Unreliable and Chaotic:** Facebook groups and messaging channels amplify rumors, political propaganda, outdated footage, and geographically unanchored panic.
- **Official Law Enforcement Dispatch Lacks Visibility:** Emergency dispatchers (999) operate in an information vacuum without access to distributed real-time citizen telemetry or hyper-local hazard heatmaps.
- **Navigation Tools are Safety-Blind:** Standard commercial GPS apps calculate routes based purely on traffic speed and distance, routinely steering pedestrians and motorists directly through active riot zones, unlit alleys, or high-crime bottlenecks.

### 2.3 The Gap DangerZoneBD Bridges
DangerZoneBD bridges this gap by combining **live crowd participation with automated verification and PostGIS spatial intelligence**. It transforms individual awareness into collective civic defense while enforcing strict verification, location validation, and time-decay mechanisms to prevent panic and manipulation.

---

## 3. Mission and Purpose

### 3.1 Mission Statement
> *"To democratize public safety intelligence across Bangladesh by providing every citizen with free, real-time, verified, and geographically precise danger awareness—safeguarding human life, preserving reporter anonymity, and steering commuters out of harm's way."*

### 3.2 Fundamental Purpose
1. **Eliminate Blind Danger Exposure:** Empower commuters, students, late-shift workers, and vulnerable pedestrians to identify and circumvent hazards before stepping into them.
2. **Preserve Human Dignity & Privacy:** Ensure eyewitnesses can report crimes and hazards without fear of local extortionists, retaliatory gangs, or legal intimidation.
3. **Establish an Objective Ground Truth:** Cut through sensationalism, misinformation, and duplicate claims using spatial proximity checks, community consensus voting, and automated press cross-verification.
4. **Provide Immediate Actionability:** Never leave a user in passive fear; always pair hazard alerts with practical countermeasures—safe routes, safe shelters, and emergency telemetry.

---

## 4. Product Vision & Long-Term Direction

### 4.1 Short-Term Horizon (Current State)
- Seamless real-time citizen reporting with hardware GPS proximity validation.
- Live incident radar featuring basic, heatmap, and categorized danger overlays.
- National safe-zone infrastructure covering all 64 districts and verified police facilities.
- Multi-route safe navigation comparing shortest vs. safest corridors.
- Bilingual localization (English and Bengali) across all touchpoints.

### 4.2 Medium-Term Horizon
- **Geofenced Push Notifications:** Background PWA push alerts warning pedestrians when their physical coordinates drift within 200m of an active high-severity hazard.
- **Community KYC & Verified Responder Badges:** Allowing neighborhood watches, volunteer medics, and student safety committees to gain trusted reporting privileges.
- **Offline Mesh & Peer Sync:** Enabling cached map tiles, peer-to-peer hazard sharing via Bluetooth/Wi-Fi Direct, and resilient operation during mobile network disruptions.

### 4.3 Long-Term Strategic Direction
- **Civic Authority & Municipal Integration:** Providing city corporations, traffic police, and emergency responders with anonymized, aggregated hazard heatmaps to fix broken infrastructure and patrol chronic crime zones.
- **Public Transport & Rideshare Safety Feeds:** Open APIs enabling ride-hailing services, bus syndicates, and delivery couriers to avoid dangerous corridors automatically.
- **Predictive Temporal Threat Modeling:** AI-assisted crime-pattern forecasting that alerts commuters to historically recurring danger windows (e.g., unlit canal roads prone to mugging between 10:00 PM and 3:00 AM).

---

## 5. Target Audience & Stakeholder Archetypes

DangerZoneBD is designed to serve five primary stakeholder groups under varied psychological and physical conditions:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DANGERZONEBD USER ECOSYSTEM                        │
├───────────────────┬───────────────────┬─────────────────────────────────┤
│ User Archetype    │ Context / Mindset │ Core Value Delivered            │
├───────────────────┼───────────────────┼─────────────────────────────────┤
│ 1. Everyday       │ Commuting home,   │ Live threat radar, safe-route   │
│    Commuter       │ traveling at      │ navigation, nearest safe havens,│
│    & Pedestrian   │ night, anxious    │ quick SOS dialer.               │
├───────────────────┼───────────────────┼─────────────────────────────────┤
│ 2. Citizen        │ Eyewitness to a   │ Instant, anonymous reporting    │
│    Eyewitness     │ crime or road     │ without fear of reprisal, GPS   │
│                   │ hazard            │ proximity validation.           │
├───────────────────┼───────────────────┼─────────────────────────────────┤
│ 3. Verified       │ Local community   │ Threaded updates ("police here",│
│    Responder      │ volunteer, medic, │ "road clear"), elevated voting  │
│                   │ reporter          │ weight, press corroboration.    │
├───────────────────┼───────────────────┼─────────────────────────────────┤
│ 4. Person in      │ Actively hunted,  │ One-tap 999 dialing with exact  │
│    Acute Danger   │ cornered, or      │ GPS telemetry displayed, instant│
│                   │ trapped           │ distress dispatch to family.    │
├───────────────────┼───────────────────┼─────────────────────────────────┤
│ 5. Civic Monitor  │ Safety analyst,   │ Incident moderation, bad-actor  │
│    & Admin        │ dispatcher,       │ banning, audit trails, 30-day   │
│                   │ municipal monitor │ spatial hazard trends.          │
└───────────────────┴───────────────────┴─────────────────────────────────┘
```

---

## 6. Core Product Capabilities & Functional Intent

### 6.1 Interactive Multi-Mode Threat Radar (`/`)
- **Three Cartographic Modes:**
  1. *Basic Street View:* High-contrast urban basemap displaying active hazard markers and verified safe havens.
  2. *Categorized Labeled View:* Detailed category icons with color-coded severity rings (Red, Orange, Yellow).
  3. *Heatmap Density View:* Cumulative spatial risk gradient highlighting acute crime clusters across neighborhoods.
- **Drag-to-Calibrate Pinpoint:** Allows users on low-accuracy mobile GPS to manually drag their location pin to their true physical position, bound strictly within Bangladesh territory.
- **Night-Time Visual Weighting:** Automatically intensifies and prioritizes incidents occurring between 8:00 PM and 5:00 AM, when pedestrian vulnerability is highest.

### 6.2 Hardware-Verified Citizen Incident Reporting (`/report`)
- **Strict Anti-Spoofing Proximity Validation:** The backend cross-references the device's live hardware GPS coordinates against the reported location, rejecting submissions exceeding a 200m radius to eliminate remote fake reports.
- **Fine-Grained Threat Taxonomy:** Distinct categorization for Theft, Robbery, Snatching, Armed Assault, Extortion, Youth Gang Activity, Drug-Related Crime, Unlit Roads, and Road Accidents.
- **Categorical Severity Spectrum:**
  - *High (Red):* Active weapons, armed robberies, ongoing violent clashes, structural roadblocks.
  - *Medium (Orange):* Snatching, extortion rackets, drug peddling syndicates, severe road crashes.
  - *Low (Yellow):* Unlit streets, broken roads, non-violent theft, open hazards.
- **Privacy-Preserving Evidence Upload:** Media attachments are directly ingested into secure cloud storage; public display incorporates face and vehicle license plate blurring.

### 6.3 Automated News Ingestion & Cold-Start Threat Feed (`/feed`)
- **Continuous Domestic News Harvesting:** Free background crawler polling verified domestic feeds (Google News BD Crime, Google News Safety Bangla, The Daily Star Law & Crime).
- **Physical Ground-Truth Classification:** Rigorous multi-tier classification filtering that rejects political commentary, overseas news, historical court proceedings, and non-physical allegations.
- **Deduplication & Cross-Verification:** Ingested press reports within 500m and 24 hours of a citizen submission automatically award a **"Press Confirmed"** badge and elevate trust scores.

### 6.4 Safe-Haven Directory & Emergency Shelters (`/safe-zones`)
- **Comprehensive Geospatial Directory:** Live directory of verified hospitals, trauma centers, 24/7 pharmacies, police boxes, and 94+ verified national police stations.
- **Direct Dial & Distance Telemetry:** Displays real-time straight-line and walking distance with instant one-tap dialing to emergency desks.
- **Shield Cartography:** Verified blue and green shield markers distinguish official law enforcement and medical havens from civilian reports.

### 6.5 Hazard-Aware Safe Route Navigation (`/routes`)
- **Street-Network Navigation:** Replaces naive straight-line routing with genuine road-network geometry powered by OpenStreetMap and OSRM.
- **PostGIS Hazard Exposure Corridors:** Evaluates spatial buffer corridors (50m–150m) around travel routes, detecting every intersecting active hazard.
- **Multi-Route Safety Alternatives:** Generates distinct options:
  - *Safest Route:* Maximizes hazard bypass distance, avoiding active red zones even if travel time increases.
  - *Fastest Route:* Direct path with explicit hazard disclosure warnings.
  - *Alternative Route:* Secondary thoroughfares balancing distance against risk.
- **Explainable Safety Scoring (15–95):** Transparent scores showing exactly why a route is recommended (e.g., *"Bypasses 3 High-Severity Armed Clashes; adds 4 minutes"*).

### 6.6 Emergency SOS & Tactical Distress Telemetry
- **Panic Action Suite:** Omnipresent floating SOS button available across all pages.
- **One-Tap 999 Connection:** Launches the phone dialer while displaying the user's exact latitude, longitude, and nearby street landmarks on screen so the caller can read them clearly to emergency dispatchers.
- **Pre-Formatted WhatsApp & SMS Broadcast:** Generates an immediate distress message containing live coordinates and a direct map link to pre-configured trusted emergency contacts.

### 6.7 Community Moderation & Truth Engine
- **Unique Per-User Voting:** Authenticated upvoting and downvoting prevents crowd manipulation.
- **Automated Decay & Purging:**
  - Short-term acute threats (snatching, active robbery) expire automatically after 2–3 hours.
  - Mid-term threats (gang activity, recurring syndicate crime) expire after 72–168 hours.
  - Long-term infrastructure hazards (broken road, unlit alley) remain active for 14–30 days or until marked "Resolved".
  - Reports reaching a community downvote threshold (e.g., -5 votes) are automatically purged from the live map.
- **Dynamic User Trust Scores:** Accurate reporting elevates a user's hidden trust score; deliberate fake reporting or spam triggers silent shadow-banning.

---

## 7. Critical Product Philosophy & Non-Negotiable Principles

Every feature, interface element, and architectural decision must adhere to six non-negotiable principles:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SIX PILLARS OF DANGERZONEBD                          │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Real-World Value Over Technical Vanity                              │
│    Every line of code must contribute directly to saving life or limb.  │
│    Never add features merely to demonstrate technology.                 │
├─────────────────────────────────────────────────────────────────────────┤
│ 2. Physical Ground Truth Over News Scrapes                              │
│    The map represents physical, active, localized threats—not court     │
│    trials, political mudslinging, or non-actionable headlines.          │
├─────────────────────────────────────────────────────────────────────────┤
│ 3. Absolute Privacy & Non-Retaliation by Design                         │
│    Public clients never receive reporter PII. Coordinates are fuzzed    │
│    to protect the eyewitness's exact hiding spot.                       │
├─────────────────────────────────────────────────────────────────────────┤
│ 4. Zero-Budget Civic Sustainability                                     │
│    The architecture must run reliably on free-tier infrastructure       │
│    without requiring venture capital, donor funds, or user fees.        │
├─────────────────────────────────────────────────────────────────────────┤
│ 5. Calmness & Usability Under Acute Duress                              │
│    Interfaces must be legible on cracked screens, in rain, under poor   │
│    lighting, on 2G/3G connections, and by panicking users.              │
├─────────────────────────────────────────────────────────────────────────┤
│ 6. Transparent Honesty & No False Safety Guarantees                    │
│    DangerZoneBD does not replace emergency 999 services or police.      │
│    Unverified reports must be honestly labeled as unverified.           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Detailed Philosophy

#### 1. Physical Ground Truth vs. News Aggregation
A map covered with irrelevant headlines induces panic and destroys trust. DangerZoneBD strictly enforces that:
- An incident must represent a **physical, active, geographically localized threat**.
- Political speeches, financial scams, defamation suits, celebrity legal battles, and overseas accidents (even involving Bangladeshi expatriates) are **strictly filtered out**.
- The map must never display an incident without an actionable geographical anchor.

#### 2. Privacy as a Safety Precondition
In Bangladesh, reporting extortion, youth gang violence, or corrupt syndicates carries severe risks of physical retaliation or legal harassment under the Cyber Security Act. Therefore:
- Public endpoints **never** transmit reporter names, phone numbers, email addresses, or user IDs.
- Public incident markers display generalized danger zones rather than exact building or alleyway coordinates.
- Reporting must be possible anonymously.

#### 3. Zero-Budget Civic Sustainability
The platform must remain operational indefinitely without paid third-party dependencies:
- Direct OpenStreetMap cartography instead of commercial Google Maps APIs.
- Self-hosted Socket.IO real-time delivery over paid PaaS channels.
- Public OSRM routing instances instead of per-query billing services.
- Resilient client reconnection strategies that gracefully handle free-tier server sleeping.

#### 4. Low Cognitive Load Under Stress
When escaping a mob or navigating a dark road, users cannot navigate complex menus:
- Touch targets must be at least 44×44px.
- Critical actions (SOS, Safe Zones, Live Map) must be reachable in a single tap.
- Color palettes must maintain high contrast (WCAG AAA for critical indicators) and avoid disorienting flashing animations.
- Bilingual localization must be natural, culturally authentic, and complete.

---

## 8. Expected User Experience & Mental Models

### 8.1 The 5-Second Test (Immediate Awareness)
Within 5 seconds of opening DangerZoneBD, a user must understand:
1. Where their blue location dot is on the map.
2. Whether they are currently standing inside or near a red/orange danger zone.
3. The nearest safe haven indicated by green/blue shield markers.
4. The prominent red SOS trigger for emergency dialing.

### 8.2 The 30-Second Task (Reporting an Incident)
A citizen witnessing an incident must be able to complete a report in under 30 seconds:
1. Tap the floating **Report Hazard** CTA.
2. Select a category (e.g., *Snatching*).
3. Confirm severity (auto-suggested based on category).
4. Review auto-detected GPS position (or adjust pin if needed).
5. Submit anonymously without mandatory registration or personal data forms.

### 8.3 The 2-Minute Workflow (Safe Navigation)
A commuter preparing to travel after dark must be able to:
1. Navigate to `/routes`.
2. Enter their destination or tap a target location on the map.
3. Compare the **Safest Route** against the **Fastest Route**.
4. Review the explicit hazard trade-off breakdown (e.g., *"Choosing Route A avoids 2 active snatching spots on Old Airport Road"*).
5. Begin navigation with clear turn-by-turn alerts.

---

## 9. Quality Expectations & System Standards

DangerZoneBD operates in a safety-critical domain. The platform must adhere to the following operational standards:

### 9.1 Data Integrity & Verification Standards
- **Zero Hallucinated Incidents:** The platform must never inject synthetic or fabricated incident data into production databases.
- **Fail-Closed Security Middleware:** Automated endpoints (such as cron ingestion triggers and administrative webhooks) must strictly fail closed (`401 Unauthorized`) if security tokens are missing or mismatched.
- **Transparent Verification Badges:** Every incident card must clearly display its verification state:
  - `Unverified` (Citizen report awaiting community confirmation)
  - `Community Confirmed` (Upvoted by multiple local residents)
  - `Press Confirmed` (Corroborated by verified national news publications)
  - `Authority Verified` (Confirmed by law enforcement or platform administrators)

### 9.2 Cartographic & Geolocation Standards
- **Territorial Sovereignty:** All incident coordinates, search geocoding results, and safe routes must fall strictly within the sovereign territorial bounding box of Bangladesh:
  - Latitude: `20.3000° N` to `26.8000° N`
  - Longitude: `87.8000° E` to `92.9000° E`
- **Progressive Accuracy Refinement:** The system must gracefully report GPS precision tiers (`HIGH`, `GOOD`, `MODERATE`, `LOW`, `VERY_LOW`, `EXTREMELY_POOR`), guiding users to calibrate manually if hardware accuracy is poor.

### 9.3 Accessibility & Localization Standards
- **Authentic Bilingualism:** 100% feature and label parity between English and Bengali (`bn-BD`). Bengali typography must render crisply without layout clipping or truncated text strings.
- **Vestibular & Motion Safety:** Map animations, danger pulses, and radar waves must strictly honor `prefers-reduced-motion` settings to prevent disorientation.
- **Network Resilience:** Service workers must cache core application assets, map markers, and safe haven directories so users retain map readability during cellular network dropouts.

---

## 10. Instructions for AI Agents & Developers

This section contains **mandatory instructions** for every AI agent, autonomous assistant, and software engineer working on this repository.

### 10.1 Cardinal Rules of Engagement
1. **Read `product.md` First:** Before planning, refactoring, or authoring code for any feature, read this document to understand the product context and user impact.
2. **Technical Choices Must Serve Product Objectives:** Do not introduce architectural complexity, third-party services, paid APIs, or design frameworks unless they directly advance the core public safety mission.
3. **Never Silently Change Product Goals:** If a proposed engineering change alters how incidents are reported, verified, expired, or displayed, you must explain the product impact and seek explicit approval from the project owner.
4. **Preserve the Core Identity:** DangerZoneBD is a **civic emergency utility for Bangladesh**. Do not pivot the product into a generic social feed, an advertising-driven directory, or a global international news tracker.
5. **No Hallucinated Requirements:** If documentation does not specify a business rule, do not guess or silently invent requirements. Ask the product owner for clarification.
6. **Protect Zero-Budget Viability:** Never introduce dependencies requiring paid monthly subscriptions (such as paid Google Maps APIs, commercial Mapbox plans, or paid notification gateways) without explicit authorization.
7. **Maintain this Document:** When product requirements, strategic directions, or core user archetypes genuinely evolve through confirmed product decisions, update `product.md` to reflect those changes.

### 10.2 Conflict Resolution Protocol
When an engineering proposal conflicts with a product principle:
- **Safety over Convenience:** If an optimization reduces reporter privacy, reject it.
- **Accuracy over Engagement:** If a feature increases engagement by sensationalizing unverified crimes, reject it.
- **Resilience over Polish:** If an elaborate visual animation degrades performance on low-end Android devices running 3G connections, simplify the visual treatment.

---

## 11. Document Evolution & Maintenance Log

| Version | Date | Author / Agent | Changes Summary |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-11-19 | Antigravity AI | Initial authoritative creation of `product.md` establishing project identity, motivation, civic philosophy, core capabilities, and agent operating instructions. |

---

*This document serves as the permanent compass for DangerZoneBD. Frameworks, libraries, server hosts, and UI trends may change, but the mission—to protect human lives through reliable, real-time civic intelligence across Bangladesh—remains constant.*
