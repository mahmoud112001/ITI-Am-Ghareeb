# API Model Review

## Current mistakes

- The current `Route` model is too flat. One document with one `stations` array cannot represent the real transport problem in Alexandria, where the same line may have different paths by direction or branch.

- The search logic does not validate travel order. It only checks that both points exist somewhere in the same route, which means it can return a route even if the user cannot actually go from point A to point B in that direction.

- The `direction` field is under-modeled. `bidirectional` and `one_way` are not enough because the reverse direction may have a different ordered stop list, different streets, or different pickup points.

- Stops are duplicated as embedded text inside every route instead of being modeled as shared entities. Places like `سيدي بشر` and `المندرة` should exist once as stable records, not many times across different routes.

- `origin` and `destination` duplicate information already implied by the first and last stop. This creates two sources of truth with no guarantee that they stay consistent.

- Coordinates default to `0,0`, which is fake data. Unknown coordinates should not be stored as real coordinates because this damages map features and nearest-route calculations.

- The transport type enum is already too narrow. The project idea needs flexibility for `microbus`, `bus`, `train`, and possibly more later, but the current schema restricts that growth.

- The model does not support route paths well. A single route may have a short path, long path, rush-hour pattern, or branch path, and the current shape does not express that clearly.

- The model does not support transfer-based routing. Many useful trips from A to B in Alexandria are not direct and require one transfer, but the current structure is centered around direct routes only.

- Search history stores only raw text queries instead of resolved stop IDs, place IDs, or coordinates. That limits your ability to analyze real demand and improve search quality later.

- The AI service builds context from weak matching. It pulls routes matching origin or destination text, not true full-trip candidates, so the AI can answer confidently with wrong route suggestions.

- Route creation is validated, but route updates are not validated with the same contract. That allows invalid route shapes to enter the system later through admin edits.

- The tests focus mostly on CRUD and endpoint success cases, not routing correctness. They do not cover direction-specific behavior, invalid stop order, route paths, or transfer scenarios.

## Suggested solutions

- Split the domain into separate entities instead of one large `Route` document.

- Add a `Place` model:
  - Stable place ID
  - Arabic and English names
  - Aliases and spelling variations
  - GeoJSON location
  - Optional area or district metadata

- Keep `Route` as the line-level identity:
  - Public transport identity
  - Mode such as `microbus`, `bus`, `train`, `tram`
  - Operator or source if needed later
  - Display names in Arabic and English
  - Active or inactive status

- Add a `Path` model:
  - Belongs to one route
  - One exact ordered stop sequence
  - Explicit direction such as `outbound` and `inbound`
  - Optional branch or path label
  - Fare, operating hours, frequency, and notes specific to that path

- Make routing depend on ordered stop positions, not just text match:
  - Resolve the user input into place IDs
  - Find paths containing both places
  - Confirm that the origin stop index is before the destination stop index
  - Reject the path if the order is reversed

- Support transfers as a first-class routing feature:
  - First search for direct paths
  - If no direct result exists, search for one-transfer itineraries through a shared place
  - Rank results by total legs, fare, distance to first boarding point, and confidence

- Replace `lat/lng` objects with GeoJSON `Point` where possible:
  - Store `location: { type: "Point", coordinates: [lng, lat] }`
  - Add a `2dsphere` index
  - Use this for nearest-stop and near-me queries

- Remove duplicated `origin` and `destination` fields from route storage, or derive them from the first and last stop in each path. If you keep them for display, generate them from the stop sequence instead of letting them drift independently.

- Expand transport flexibility:
  - Add `train`
  - Consider `ferry`, `metro`, or `walk` later if multimodal routing is planned
  - Prefer a transport-mode enum that matches the actual roadmap of the project

- Improve search history:
  - Store raw query text
  - Store resolved origin place ID when found
  - Store resolved destination place ID when found
  - Store origin and destination coordinates when location search is used
  - Store whether the chosen result was direct or transfer-based

- Strengthen admin validation:
  - Validate create and update with the same schema rules
  - Validate stop order uniqueness and monotonic sequence
  - Reject paths with fewer than two stops
  - Reject impossible coordinates

- Strengthen tests:
  - Add tests for valid A to B ordering
  - Add tests that reject reversed or impossible direction results
  - Add tests for multiple paths of the same route
  - Add tests for one-transfer routing
  - Add tests for nearest-stop and geospatial search behavior

## Recommended target model

- `Place`
  - `_id`
  - `nameAr`
  - `nameEn`
  - `aliases`
  - `location`
  - `district`

- `Route`
  - `_id`
  - `routeId`
  - `type`
  - `nameAr`
  - `nameEn`
  - `isActive`

- `Path`
  - `_id`
  - `route`
  - `direction`
  - `pathCode`
  - `stops: [{ placeId, order, allowPickup, allowDropoff }]`
  - `fare`
  - `operatingHours`
  - `frequency`
  - `verified`

- `SearchHistory`
  - `_id`
  - `userId`
  - `originQuery`
  - `destinationQuery`
  - `resolvedOriginPlaceId`
  - `resolvedDestinationPlaceId`
  - `originCoords`
  - `destinationCoords`
  - `resultCount`
  - `selectedItineraryType`

## Practical implementation path

- Keep `Route` as route-level metadata only.

- Create a `Place` collection by deduplicating repeated station names and coordinates.

- Convert each route into:
  - one `Route`
  - at least one `Path`

- For routes that truly support reverse travel, create a separate inbound path instead of assuming the same stop order works both ways.

- Update search logic to work on `Path` instead of raw route documents.

- Remove direct dependency on the old embedded `stations` array.

## Priority order

- First: fix route search to respect stop order.

- Second: introduce shared `Place` entities.

- Third: split route identity from path direction and stop order.

- Fourth: add transfer search.

- Fifth: migrate history, AI context, and admin tools to the new structure.
