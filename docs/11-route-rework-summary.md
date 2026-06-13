# 11. Route Rework Summary

This document summarizes the full branch rework that replaced the old flat route shape with a location-backed route graph, added geometry-aware map rendering, improved admin tooling, and closed the remaining correctness issues before review.

---

## 11.1 Scope of This Branch

The branch delivers four connected changes:

- Route data was normalized around shared `Location` records.
- Route search was upgraded from simple text match to ordered-stop routing.
- Maps and admin tools were upgraded to support real route geometry.
- Final hardening fixes were applied so tests, API contracts, and edge cases are stable.

---

## 11.2 Backend Model Changes

### New Route Shape

`Route` is no longer centered around duplicated embedded station text only. It now stores:

| Field | Purpose |
|-------|---------|
| `origin` / `destination` | References to canonical `Location` documents |
| `stops` | Ordered route stops, each referencing a `Location` plus pickup/dropoff flags |
| `geometry` | GeoJSON `LineString` used for real map drawing |
| `isBidirectional` | Indicates whether reverse travel is supported |
| `fare`, `operatingHours`, `frequency`, `peakHours`, `tips` | Operational metadata |
| `verified`, `isActive` | Trust and lifecycle flags |

### New Location Model

`Location` is now the shared place entity for route stops:

| Field | Purpose |
|-------|---------|
| `canonicalKey` | Deduplication key for Arabic + English names |
| `nameAr` / `nameEn` | Canonical display names |
| `aliases` | Alternate Arabic/English spellings |
| `location` | GeoJSON `Point` |
| `district` | Optional area metadata |

### Supporting Utility Layer

`server/src/utils/routeNetwork.js` now handles:

- route name derivation from the first and last stop
- geometry normalization and reverse-direction geometry
- stop-to-location synchronization
- route DTO shaping for public and admin responses
- compatibility transformation from older seed-style route fixtures

---

## 11.3 Search and Routing Improvements

### Ordered Direct Search

Direct route search now:

- resolves user input against `Location`
- ensures the origin appears before the destination in the selected travel direction
- respects `allowPickup` and `allowDropoff`
- supports reverse rendering for bidirectional routes

### Transfer Routing

Transfer routing is no longer limited to one handoff. The backend now builds arbitrary ordered leg chains by:

- indexing active route directions by valid boarding points
- exploring same-stop and short walking transfers between consecutive legs
- returning direct itineraries only whenever any direct route exists
- returning exactly one best one-transfer itinerary only when no direct route exists
- falling back to exactly one deeper itinerary at the first successful depth from 2-transfer through 5-transfer only when no direct or one-transfer options exist
- stopping at the first deeper transfer depth that yields valid results
- deduplicating and ranking itineraries by leg span, walking cost, and stable itinerary identity

### Current-Location Search

Searching from live coordinates now ranks routes by the nearest valid boarding geometry point instead of relying only on old straight-line station assumptions.

### Search Output Contract

Public search results now use a unified itinerary contract:

- direct results still expose `route` for compatibility
- every result returns `legs[]`
- each leg includes the matched route DTO, `boardAt`, `alightAt`, and accuracy stats
- transfer itineraries return `itineraryId`, `transferCount`, `transferWalks[]`, `transferPlaces[]`, `totalFare`, and origin walking-distance metadata when relevant
- route DTOs still include `stops`, compatibility alias `stations`, `geometry`, `geometryPoints`, `selectedDirection`, and `matchedSegment`

---

## 11.4 Map and UI Changes

### Admin Route Editor

The admin page was upgraded to support:

- editing route stops with pickup/dropoff rules
- bidirectional route flag
- automatic route name generation from terminals
- geometry creation from stop coordinates
- interactive geometry editing on a Leaflet map
- reordering, clearing, and resetting geometry points

### Search Results

Search results now distinguish between:

- direct routes
- generalized transfer itineraries with any supported leg count

Transfer itineraries now expose the same three actions as direct cards:

- rate
- save
- map

Matched boarding, transfer, and destination stops are highlighted in cards and passed into the map page through the generalized `legs[]` contract.

### Map Rendering

The map page now:

- draws real route geometry instead of connecting stops with a naive straight line
- supports reverse direction rendering
- renders dynamic itineraries from `legs[]` instead of hardcoded first-leg/second-leg params
- highlights only the traveled segment for each leg and grays out irrelevant path portions
- collapses shared transfer pickup/dropoff points into one switch marker with mixed route colors
- keeps user-visible stops and route geometry separated cleanly

### Search Actions for Itineraries

Multi-leg results now support the missing UI and API needed to behave like first-class search results:

- save and unsave transfer itineraries as first-class journeys
- itinerary-level rating flow for transfer results without affecting per-route accuracy stats
- map navigation for any itinerary length

---

## 11.5 Admin API Cleanup

The admin API surface was standardized to avoid overlapping route mounts.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/admin/stats` | Admin dashboard statistics |
| `GET /api/admin/routes` | Paginated route list |
| `POST /api/admin/routes` | Create route |
| `PUT /api/admin/routes/:id` | Update route |
| `PATCH /api/admin/routes/:id/restore` | Restore soft-deleted route |
| `DELETE /api/admin/routes/:id` | Soft-delete route |

Client admin services and hooks were updated to use the canonical route paths only.

---

## 11.6 Final Correctness Fixes

Before review, the branch was hardened with the following fixes:

### Test Command Reliability

- Removed duplicate Jest configuration so `npm test` works normally from `server/`.

### Test Stability

- Rate limits now use relaxed limits in `NODE_ENV=test` so authentication tests do not fail from limiter pollution.

### Search Input Safety

- User search strings are now regex-escaped before Mongo regex construction.
- This prevents malformed inputs such as `[` from crashing the endpoint.

### Station Autocomplete Accuracy

- `/api/routes/stations` now returns stop names only from active routes.
- Inactive or orphaned locations no longer leak into autocomplete.

### Admin Route ID Validation

- Route updates now check `routeId` uniqueness before save.
- Duplicate-key handling now returns route-specific conflict messages instead of email-only wording.

### Itinerary Action API Support

- Added protected saved-itinerary endpoints so transfer journeys are stored and restored as complete itineraries rather than loose saved route legs.

### AI Transit Context

- AI route advice now formats transfer results from `legs[]` and `transferWalks[]` instead of assuming exactly two legs.

### Transfer-Itinerary Rating Semantics

- Transfer-result ratings are now stored as itinerary-level feedback, separate from route accuracy ratings.

---

## 11.7 Test Coverage Added or Updated

The branch updated backend tests to cover the reworked routing behavior, including:

- direct search with ordered-stop validation
- reverse-direction behavior
- direct routes suppress one-transfer alternatives when both exist
- one-transfer fallback returns only the single best itinerary
- multi-leg itinerary generation
- fallback-depth behavior through deeper transfer counts with a single best deeper itinerary
- first-class saved-itinerary endpoints and hydration
- pickup/dropoff constraints
- geometry reversal in route detail responses
- active-only station autocomplete
- duplicate `routeId` protection during admin updates

---

## 11.8 Files With Major Work

| Area | Key Files |
|------|-----------|
| Route model and DTO logic | `server/src/models/Route.model.js`, `server/src/utils/routeNetwork.js` |
| Location model | `server/src/models/Location.model.js` |
| Route search | `server/src/services/routes.service.js` |
| Admin backend | `server/src/routes/admin.routes.js`, `server/src/routes/admin.stats.routes.js`, `server/src/services/admin.service.js` |
| AI context | `server/src/services/ai.service.js` |
| Admin UI | `client/src/pages/AdminPage.jsx`, `client/src/services/admin.service.js`, `client/src/hooks/useAdminRoutes.js` |
| Search and cards | `client/src/pages/SearchPage.jsx`, `client/src/pages/DashboardPage.jsx`, `client/src/components/RouteCard.jsx`, `client/src/components/ItineraryCard.jsx`, `client/src/components/ItineraryRatingModal.jsx` |
| Map page | `client/src/pages/MapPage.jsx` |
| Itinerary map contract | `client/src/utils/itineraryMap.js` |
| Tests and seed | `server/src/tests/*.test.js`, `server/src/scripts/seed.js` |

---

## 11.9 Verification Status

Validation performed after the branch fixes:

- frontend production build passes
- backend Jest command runs from the standard `npm test` script
- route search tests cover direct-priority behavior, one-transfer fallback, and deeper multi-leg fallback behavior
- auth, routes, admin, AI, rating, and model tests pass

This branch is now documented as a completed implementation summary rather than a planning or audit trail.
