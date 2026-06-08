# 7. Testing

---

## 7.1 Running the Tests

```bash
cd server && npm test
```

Expected result: **67 tests passing** across 6 suites.

The `--runInBand` flag runs suites sequentially (not in parallel). This is required because each suite starts and stops an in-memory MongoDB instance — running them in parallel would cause port conflicts and race conditions.

`--detectOpenHandles` warns if any async handles (timers, DB connections) are left open after tests complete.

---

## 7.2 Test Infrastructure

| Tool | Version | Role |
|------|---------|------|
| Jest | 29.7.0 | Test runner and assertion library |
| Supertest | 6.3.4 | HTTP assertions against the Express app |
| mongodb-memory-server | 9.1.6 | Ephemeral in-memory MongoDB — no external DB needed |
| @babel/preset-env + babel-jest | 7.23.9 / 29.7.0 | Transpile ES modules for Jest (Node CJS runtime) |

---

## 7.3 Standard Test Pattern

Every suite follows the same lifecycle:

```js
// Before all tests in this suite
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
  // seed minimal test data
})

// After all tests in this suite
afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

// Before each individual test
beforeEach(async () => {
  await User.deleteMany({})
  await Route.deleteMany({})
  // etc. — ensures test isolation
})
```

Tests use `supertest(app)` where `app` is the imported Express app object (not a listening server). The test DB is the in-memory instance — the real MongoDB Atlas cluster is never touched during tests.

---

## 7.4 Test Suites

### models.test.js — 19 tests

| Test | What It Verifies |
|------|-----------------|
| User creation | Required fields, timestamps |
| Password hashing | Pre-save hook bcrypts `passwordHash` |
| comparePassword | Returns true for correct, false for wrong |
| findByEmail | Case-insensitive lookup |
| Duplicate email | Throws 11000 (unique index) |
| Google user | `passwordHash: null`, no bcrypt hook |
| Route creation | All required fields, default values |
| Route text index | Search index exists on station names |
| getAccuracyStats — no ratings | Returns `'غير مقيّم بعد'` |
| getAccuracyStats — < 3 ratings | Returns `percentage: null` |
| getAccuracyStats — ≥ 3 ratings | Calculates percentage and label correctly |
| Rating creation | Required fields |
| Rating duplicate | Unique index throws on second vote |
| SearchHistory creation | Required fields, user ref |
| SearchHistory index | `{ user, createdAt }` index exists |

### auth.test.js — 13 tests

| Test | What It Verifies |
|------|-----------------|
| POST /register — success | 201, returns `{ success, user, accessToken, refreshToken }` |
| POST /register — duplicate email | 409 |
| POST /register — invalid password | 400, Joi validation error |
| POST /login — success | 200, returns tokens |
| POST /login — wrong password | 401, generic message (no user enumeration) |
| POST /login — unknown email | 401, same message as wrong password |
| POST /refresh — success | Rotates token pair |
| POST /refresh — invalid token | 401 |
| POST /logout — success | 200, clears `refreshToken` in DB |
| GET /me — authenticated | Returns user without `passwordHash` |
| GET /me — no token | 401 |
| GET /google | Redirects to Google (302) |
| GET /google/callback — success | Redirects to `CLIENT_URL/dashboard?token=...` |

### routes.test.js — 11 tests

| Test | What It Verifies |
|------|-----------------|
| GET /search — anonymous | Returns results without saving history |
| GET /search — authenticated | Saves `SearchHistory` record |
| GET /search — no results | Returns empty array |
| GET /stations | Returns deduplicated, sorted Arabic station names |
| GET /:routeId — found | Returns route + `accuracyStats` |
| GET /:routeId — not found | 404 |
| POST /save/:routeId | Adds to `user.savedRoutes` |
| POST /save/:routeId — duplicate | `$addToSet` — no error, no duplicate |
| DELETE /save/:routeId | Removes from `user.savedRoutes` |
| GET /history | Returns last 20, sorted by date |
| GET /saved | Returns saved routes with `accuracyStats` |

### rating.test.js — 8 tests

| Test | What It Verifies |
|------|-----------------|
| POST /ratings — accurate | 201, `isAccurate: true` stored |
| POST /ratings — inaccurate | 201, `isAccurate: false` stored |
| POST /ratings — with comment | Comment stored, max 280 chars |
| POST /ratings — duplicate | 409 (unique index) |
| POST /ratings — no auth | 401 |
| GET /ratings/:routeId/stats — no ratings | `'غير مقيّم بعد'` |
| GET /ratings/:routeId/stats — few ratings | `percentage: null` |
| GET /ratings/:routeId/stats — enough ratings | Correct percentage + label |

### admin.test.js — 9 tests

| Test | What It Verifies |
|------|-----------------|
| GET /admin/stats — admin | Returns `{ totalRoutes, totalUsers, totalRatings, topSearched }` |
| GET /admin/stats — non-admin | 403 |
| GET /admin — paginated | Returns routes array + pagination meta |
| POST /admin — create route | 201, full route document returned |
| POST /admin — invalid data | 400 Joi error |
| PUT /admin/:id — update | Returns updated document |
| PUT /admin/:id — not found | 404 |
| DELETE /admin/:id — soft-delete | Sets `isActive: false` |
| GET /admin — excludes inactive | Soft-deleted routes not returned |

### ai.test.js — 7 tests

| Test | What It Verifies |
|------|-----------------|
| POST /ai/ask — valid request | Response is `text/event-stream` content type |
| POST /ai/ask — contains [DONE] | Stream ends with `data: [DONE]` |
| POST /ai/ask — missing origin | 400 before SSE headers flush |
| POST /ai/ask — missing destination | 400 before SSE headers flush |
| POST /ai/ask — missing message | 400 before SSE headers flush |
| POST /ai/ask — no auth | 401 |
| POST /ai/ask — error format | Error sent as `data: {"error":"..."}` SSE event |

---

## 7.5 Coverage Notes

The test suite does not use Jest's `--coverage` flag by default. To generate a coverage report:

```bash
cd server && npx jest --coverage
```

Critical paths covered:
- All 22 API endpoints have at least one test
- Auth edge cases: wrong password vs wrong email (same error message)
- Route ordering: tests verify `/history` and `/saved` resolve before `/:routeId`
- SSE error path: tests confirm errors arrive as SSE events, not HTTP 500s
- Soft-delete: tests verify deleted routes are excluded from public queries
