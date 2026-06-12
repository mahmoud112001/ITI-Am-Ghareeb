# Project Audit After Route + Location Rework

## Scope

This audit was done after the `Route + Location` rework was completed, backend tests passed, and the client production build succeeded.

## High-Priority Issues

- `server/app.js`
  - `adminRouter` is mounted on both `/api/admin` and `/api/admin/routes`.
  - This creates two overlapping API surfaces for the same handlers.
  - Risk: duplicated contracts, confusing docs, and future client drift.
  - Recommended fix: choose one canonical admin base path and remove the duplicate mount.

- `server/src/services/routes.service.js`
  - Current-location-to-destination search only ranks direct route boarding options.
  - It does not try one-transfer itineraries starting from the user’s live coordinates.
  - Risk: “current location” search is weaker than typed origin search.
  - Recommended fix: add a current-location transfer search pass using nearest boardable stops plus walking-transfer logic.

- `server/src/services/ai.service.js`
  - OpenAI model name is hardcoded to `gpt-4o-mini`.
  - The catch block returns a generic SSE error without structured logging of the real cause.
  - Risk: hard to change models per environment, hard to debug production failures.
  - Recommended fix: move the model to env/config and log structured server-side AI errors with request context.

## Medium-Priority Issues

- `client/src/pages/AdminPage.jsx`
  - The admin editor supports route-stop searchability and route-specific `allowPickup` / `allowDropoff`, but still does not expose `aliases` or `district`.
  - Risk: backend model is richer than the admin tool, so some location data can only be changed manually or via seed code.
  - Recommended fix: extend the stop editor or add a dedicated location-management UI.

- `client/src/pages/AdminPage.jsx`
  - Nominatim reverse/forward geocoding is called directly from the browser.
  - Risk: third-party rate limits, usage-policy issues, and no server-side caching.
  - Recommended fix: proxy geocoding through the backend with caching and explicit request headers.

- `server/src/services/routes.service.js`
  - The walking transfer threshold is hardcoded to `500` meters.
  - Risk: hidden behavior, hard to tune, and no environment-specific control.
  - Recommended fix: move it to config, document it, and consider different thresholds for same-stop vs walk-transfer ranking.

- `server/src/routes/routes.routes.js`
  - `optionalProtect` manually parses and verifies JWTs instead of reusing a shared optional-auth middleware.
  - Risk: duplicated auth logic and drift from the main auth middleware.
  - Recommended fix: extract a reusable optional-auth middleware beside `protect`.

- `server/src/services/routes.service.js`
  - Search results return both `stops` and `mapPoints`, and `stations` is a filtered view of the same route geometry.
  - Risk: response payload inflation and contract duplication.
  - Recommended fix: settle on one canonical geometry field plus one user-visible stops field.

## Low-Priority Issues

- `docs/11-api-model-review.md`
  - The content still describes the superseded `Place + Path` direction.
  - Risk: developer confusion when reading old docs next to the new implementation.
  - Recommended fix: rewrite it to reflect `Route + Location` or add a clear “historical/superseded” banner.

- `client/src/services/admin.service.js`
  - Comments describe `/api/admin` as the working contract, while the server currently also exposes `/api/admin/routes` because of the duplicate mount.
  - Risk: docs/comments reinforce the API duplication problem.
  - Recommended fix: align comments after the canonical admin base path is chosen.

- Frontend coverage
  - Backend coverage is solid for the rework, but there are still no high-value tests around the new admin form flow, transfer-route card rendering, or reverse-direction map rendering.
  - Risk: UI regressions will be caught only manually.
  - Recommended fix: add focused React tests for the reworked search/admin/map surfaces.

## Architectural Follow-Up Opportunities

- Add a dedicated `Location` admin screen.
  - Useful for aliases, hidden/internal points, district cleanup, and canonical name correction.

- Add route-search telemetry fields.
  - Example: `selectedItineraryType`, `selectedRouteId`, `selectedTransferDistance`, `usedCurrentLocation`.
  - This would make search-quality tuning much easier later.

- Consider route DTO versioning.
  - The route response shape is growing richer.
  - A DTO mapper layer or explicit API serializer would reduce accidental contract drift.

- Add seed validation before insert.
  - A validation/report pass would catch malformed station order, duplicate route IDs, and empty fares before writing to MongoDB.

## Summary

The rework itself is functionally complete and verified:

- backend tests passed
- frontend production build passed

The biggest remaining quality risks are not broken features. They are contract cleanup, stronger current-location transfer search, and developer-facing clarity around the new model.
