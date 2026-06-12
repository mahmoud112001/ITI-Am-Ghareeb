# Route Geometry Rework Plan

## Execution Checklist

- [x] Review current route, location, admin, search, and map code paths affected by route geometry.
- [x] Add route geometry schema to backend route model.
- [x] Remove searchable-flag support from location and route-stop normalization/public payloads.
- [x] Update backend route transformation helpers to read/write geometry and reverse it at runtime for bidirectional routes.
- [x] Update route search, route details, nearest-route, and stations autocomplete services to work without searchable flags.
- [x] Update admin validation and service layer to accept geometry coordinates on create and update.
- [x] Add admin UI support for drawing, previewing, editing, clearing, and reordering route geometry on the map.
- [x] Keep existing ordered stops workflow for pickup/dropoff/search logic.
- [x] Update map page rendering to use route geometry instead of straight lines between stops.
- [x] Keep stop markers on top of geometry and preserve matched boarding/destination highlighting.
- [x] Update transfer and direct route map links if any geometry-specific params are needed.
- [x] Update seed generation so every route stores geometry separately from stops.
- [x] Remove obsolete searchable-field expectations from tests and assertions.
- [x] Reseed the live database and migrate existing location data to remove obsolete searchable flags.
- [x] Run targeted backend tests, frontend build, and live endpoint checks.
- [x] Review the touched code for cleanup gaps and finish any remaining production-quality fixes.

## Decisions Deferred

- [x] No deferred decisions currently. Implement the geometry rollout with the confirmed rules from chat.
