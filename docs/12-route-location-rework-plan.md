# Route + Location Full Rework Plan

> Archived note: this plan reflects an earlier stage of the rework.
> The later geometry rollout removed the old `isSearchable` idea entirely.

## Goal

Rework the project so that:

- `Route` is the only route-shape record.
- `Location` replaces `Place`.
- `Route` stores `origin`, `destination`, ordered `stops`, bidirectional behavior, fare/hours, and other route-operational data.
- Different shapes between the same visible terminals are represented as different `Route` records.
- Search supports:
  - direct A -> B
  - reverse travel for bidirectional routes
  - one-transfer smart routing
  - transfer by same location or nearby walkable locations when direct travel is not available
- UI and map use the new data model correctly.
- Seed data and tests are updated to the new structure.

## Chronological Checklist

- [x] Review current backend models, search logic, seed flow, route formatting, map rendering, and admin/search UI surface area.
- [x] Replace the `Place` / `Path` model design with the new `Location` + single-record `Route` design.
- [x] Rewrite the route-network utility layer to sync route stops into shared `Location` records and persist route `origin` / `destination` / ordered stop refs directly on `Route`.
- [x] Rename all backend imports, exports, and model registry usage from `Place` / `Path` to `Location` / `Route`.
- [x] Refactor admin validation and admin service logic to create, update, list, delete, and restore routes using the new single-record route schema.
- [x] Refactor route search logic to use ordered `Route.stops` instead of `Path` documents.
- [x] Implement bidirectional reverse-search behavior so a bidirectional route can serve B -> A by reversing its stored stop order at runtime.
- [x] Implement direct route ranking across multiple route records that share the same visible terminals.
- [x] Implement smart one-transfer routing:
  - same-stop transfer
  - nearby-stop walking transfer
  - ranking by transfer quality, stop distance, and route simplicity
- [x] Refactor near-me and destination-based search to use `Location` and the new route shape.
- [x] Refactor route formatting for API responses so UI gets:
  - user-visible stops
  - full map path points
  - selected travel direction
  - transfer metadata
- [x] Refactor AI route-context generation to consume the new search result shape.
- [x] Replace seed migration logic so the database is rebuilt into `Route` + `Location` only.
- [x] Remove obsolete `Path` code and dead compatibility logic.
- [x] Refactor backend tests to the new schema and new search behavior.
- [x] Refactor frontend search UI to consume the new direct/transfer result contract.
- [x] Refactor route cards to display the new route shape, visible stops, direction, and transfer details correctly.
- [x] Refactor the map page to draw full route geometry while only displaying user-visible locations as markers/sidebar stops.
- [x] Refactor admin UI to edit the new route model, including:
  - bidirectional flag
  - route ordered stops
  - route fare/hours
- [x] Run backend tests and frontend build, fix all regressions, and iterate until green.
- [x] Perform a full post-rework production-level code review and tighten any weak spots found during implementation.
- [x] Write a separate audit markdown file covering remaining issues, refactor opportunities, code smells, and production-readiness gaps across the whole project.

## Deferred Decisions To Revisit Later

These will not block implementation now.

- [x] Confirm pickup/dropoff permissions are route-specific stop metadata, not global `Location` data.
- [x] Route names are terminal-based only and are generated from the first and last stop.

## Working Assumptions For This Rework

- Each `Route` record represents one concrete ordered shape.
- If two shapes go from the same visible terminals, they are stored as two separate route records.
- `Route.origin` and `Route.destination` store the canonical forward direction terminals.
- If `Route.isBidirectional === true`, reverse travel is generated at search/render time by reversing the ordered stops.
- Search fallback after no direct route will attempt one-transfer routing using same-location transfer first and nearby walkable transfer second.
