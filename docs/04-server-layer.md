# 4. Server Layer — Node.js + Express MVC

---

## 4.1 Entry Points

### server.js — Bootstrap

Handles MongoDB connection with retry logic (3 attempts, 3-second delay between each). Imports the Express app from `app.js`, then calls `app.listen()` only after the database confirms connection. Includes process-level safety nets:

```js
process.on('uncaughtException', ...)
process.on('unhandledRejection', ...)
```

Both terminate the process with `process.exit(1)` to prevent a zombie server.

### app.js — Express Application Factory

Defines the middleware stack in this exact order:

```
1. helmet()                          — secure HTTP headers
2. cors({ origin: CLIENT_URL })      — allow frontend origin only
3. morgan('dev')                     — HTTP request logging
4. express.json()                    — JSON body parser
5. express.urlencoded()              — form body parser
6. passport.initialize()             — stateless JWT mode (no sessions)
7. configurePassport(passport)       — register Google OAuth strategy
8. app.use('/api/auth', ...)         — auth router
9. app.use('/api/routes', ...)       — routes router
10. app.use('/api/ai', ...)          — AI router
11. app.use('/api/ratings', ...)     — ratings router
12. app.use('/api/admin', ...)       — admin router
13. 404 handler                      — Arabic JSON response
14. errorMiddleware                  — must be LAST
```

> ⚠️ `passport.initialize()` must come **before** route mounts. `errorMiddleware` must be **last**. Both are hard requirements.

---

## 4.2 Models (MongoDB / Mongoose)

### User.model.js

| Field | Type | Notes |
|-------|------|-------|
| `name` | String | Required, 2–50 chars |
| `email` | String | Required, unique, lowercase, validated by regex |
| `passwordHash` | String | `null` for Google OAuth users. Pre-save hook bcrypts with salt 12 |
| `googleId` | String | Sparse index — `null` for email users |
| `role` | String | Enum: `user` \| `admin`. Default: `user` |
| `refreshToken` | String | Single stored token — nullified on logout |
| `savedRoutes` | `[ObjectId]` | References to Route documents |

**Pre-save hook:** only fires when `passwordHash` is modified and non-null. Uses `bcryptjs` (not `bcrypt`) to avoid native bindings.

**Instance method:** `comparePassword(plaintext)` — returns boolean.

**Static method:** `findByEmail(email)` — lowercases and trims before query.

---

### Route.model.js

Core data entity. Key fields:

| Field | Type | Notes |
|-------|------|-------|
| `routeId` | String | Unique identifier e.g. `ALEX-MICRO-01` |
| `type` | String | Enum: `microbus` \| `bus` \| `tram` \| `university_shuttle` |
| `nameAr` / `nameEn` | String | Bilingual route name |
| `origin` | Object | `{ nameAr, nameEn, coords: { lat, lng } }` |
| `destination` | Object | Same shape as origin |
| `stations` | Array | `[{ order, nameAr, nameEn, coords }]` |
| `fare` | Object | `{ min, max, currency, lastVerified }` |
| `operatingHours` | Object | `{ start, end }` |
| `peakHours` | `[String]` | e.g. `["8:00-9:00", "17:00-18:00"]` |
| `tips` | `[String]` | Arabic driver tips |
| `isActive` | Boolean | `false` = soft-deleted |

**Text search index** on `stations.nameAr`, `stations.nameEn`, `nameAr`.

**Static method:** `getAccuracyStats(routeId)` — performs a late `require('./Rating.model')` inside the method body to avoid circular dependency between Route and Rating.

```js
// Accuracy label thresholds
>= 80%  → 'دقيق جداً'
>= 60%  → 'دقيق نسبياً'
<  60%  → 'غير موثوق'
< 3 ratings → 'غير مقيّم بعد'
```

---

### Rating.model.js

| Field | Type | Notes |
|-------|------|-------|
| `user` | ObjectId → User | Required |
| `route` | ObjectId → Route | Required |
| `isAccurate` | Boolean | Required — the binary vote |
| `comment` | String | Optional, max 280 chars |

**Unique index** on `{ user, route }` — prevents double-voting at the database level.

---

### SearchHistory.model.js

| Field | Type | Notes |
|-------|------|-------|
| `user` | ObjectId → User | Required |
| `originQuery` | String | What the user typed for origin |
| `destinationQuery` | String | What the user typed for destination |
| `routesFound` | Number | Count of results returned |

**Index** on `{ user: 1, createdAt: -1 }` for fast recency queries.

---

## 4.3 Middleware

### auth.middleware.js

**`protect`** — extracts `Bearer <token>` from the `Authorization` header, verifies with `JWT_SECRET`, attaches `{ userId, role }` to `req.user`. Calls `next(err)` on failure — caught and formatted by `errorMiddleware`.

**`requireAdmin`** — must be chained after `protect`. Checks `req.user.role === 'admin'`. Returns 403 with Arabic message on failure.

**`optionalProtect`** (defined inline in `routes.routes.js`) — same JWT verification as `protect` but does not call `next(err)` on missing/invalid token. Allows the search endpoint to be public while still logging history for authenticated users.

---

### error.middleware.js

Centralised error handler — registered last in `app.js`. Maps known error types to HTTP status codes and Arabic messages:

| Error Type | Status | Arabic Message |
|-----------|--------|---------------|
| Mongoose `ValidationError` | 400 | بيانات غير صحيحة |
| MongoDB duplicate key (`11000`) | 409 | هذا البريد الإلكتروني مسجل بالفعل |
| `JsonWebTokenError` | 401 | جلسة غير صالحة |
| `TokenExpiredError` | 401 | انتهت صلاحية الجلسة |
| Joi validation (`isJoi: true`) | 400 | بيانات غير صحيحة |
| Custom `{ statusCode, message }` | statusCode | message as-is |
| Default | 500 | حدث خطأ في الخادم |

Includes `err.stack` in response body only when `NODE_ENV === 'development'`.

---

### rateLimit.middleware.js

| Limiter | Window | Max | Key | Applied To |
|---------|--------|-----|-----|-----------|
| `authLimiter` | 15 min | 10 req | IP | POST /register, POST /login |
| `apiLimiter` | 15 min | 100 req | IP | All /api/routes/* |
| `aiLimiter` | 60 min | 20 req | userId or IP | POST /api/ai/ask |

`aiLimiter` uses a custom `keyGenerator` that prefers `req.user.userId` (post-auth) over IP, so authenticated users get their own independent quota.

---

### validate.middleware.js

Higher-order function:

```js
validate(joiSchema) → Express middleware
```

Runs `schema.validate(req.body, { abortEarly: false })` to collect all validation errors at once. On failure, calls `next({ statusCode: 400, isJoi: true, details: [...] })`. `errorMiddleware` then formats the `details` array into per-field messages.

---

## 4.4 Services (Business Logic)

### auth.service.js

| Function | Description |
|----------|-------------|
| `generateTokens(userId, role)` | Creates 15-min access token (JWT_SECRET) + 7-day refresh token (JWT_REFRESH_SECRET). Exported for use by googleCallback controller. |
| `register(name, email, password)` | Checks for duplicate email (throws 409 if found), creates user, generates tokens, stores refresh token on user document. |
| `login(email, password)` | Finds user by email, runs `bcrypt.compare()`, rotates tokens. Same error message for wrong email or wrong password to prevent user enumeration. |
| `refreshTokens(token)` | Verifies refresh token signature AND compares against the value stored in DB (single-use rotation — prevents replay). Issues new pair. |
| `logout(userId)` | Sets `user.refreshToken = null` in DB — invalidates all outstanding refresh tokens for that user. |
| `getMe(userId)` | Returns user document with `passwordHash` and `refreshToken` excluded. |

---

### routes.service.js

| Function | Description |
|----------|-------------|
| `searchRoutes(origin, destination, userId)` | Case-insensitive regex on `stations.nameAr`, `stations.nameEn`, `origin.nameAr`, `destination.nameAr`. Saves `SearchHistory` record if userId present. Attaches `accuracyStats` to each result. |
| `getStations()` | Aggregates all `stations.nameAr` values across active routes, deduplicates, sorts alphabetically for autocomplete. |
| `getRouteById(routeId)` | Finds one route by `routeId` string, attaches `accuracyStats`. |
| `saveRoute(userId, routeId)` | Adds to `user.savedRoutes` with `$addToSet` (no duplicates). |
| `unsaveRoute(userId, routeId)` | Removes from `user.savedRoutes` with `$pull`. |
| `getHistory(userId)` | Last 20 `SearchHistory` records sorted by `createdAt` desc. |
| `getSavedRoutes(userId)` | Populates `savedRoutes` from User document, attaches `accuracyStats` to each. |

---

### ai.service.js — RAG Pipeline

`streamTransitAdvice(origin, destination, message, res)` executes in four steps:

**Step 0 — SSE headers (before try block)**
```js
res.setHeader('Content-Type', 'text/event-stream')
res.setHeader('Cache-Control', 'no-cache')
res.setHeader('Connection', 'keep-alive')
res.flushHeaders()
```

**Step 1 — DB lookup**
Regex query on station names for both origin and destination, `limit(5)` routes.

**Step 2 — Arabic context string**
Each route formatted as:
```
خط: {nameAr}
محطات: {station1} ← {station2} ← ...
تعريفة: {fare.min}–{fare.max} جنيه
أوقات الذروة: ...
نصائح: ...
```

**Step 3 — OpenAI stream**
```js
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })  // inside try
const stream = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  stream: true,
  temperature: 0.7,
  max_tokens: 600,
  messages: [
    { role: 'system', content: buildSystemPrompt(context) },
    { role: 'user',   content: userMessage },
  ],
})
```

**Step 4 — Forward chunks**
```
data: {"text":"...chunk..."}\n\n   ← one per OpenAI delta
data: [DONE]\n\n                   ← stream end sentinel
data: {"error":"..."}\n\n          ← error (if catch fires)
```

> ⚠️ `new OpenAI()` is instantiated **inside** the `try` block. If it were outside, an invalid API key would throw at module load time and crash the entire server instead of sending a graceful SSE error.

---

### rating.service.js

| Function | Description |
|----------|-------------|
| `submitRating(userId, routeId, isAccurate, comment)` | Upserts a Rating document. MongoDB unique index on `{user, route}` enforces one vote per user per route. |
| `getRatingStats(routeId)` | Calls `Route.getAccuracyStats()`, returns `{ percentage, label, total, accurate }`. |

---

### admin.service.js

| Function | Description |
|----------|-------------|
| `getStats()` | `Promise.all` for `totalRoutes`, `totalUsers`, `totalRatings`, and a `SearchHistory` aggregation for `topSearched: [{ origin, destination, count }]`. |
| `listRoutes(page, limit)` | Paginated route list with `accuracyStats` per route. |
| `createRoute(data)` | Creates new `Route` document. |
| `updateRoute(id, data)` | `findByIdAndUpdate` with `{ new: true }`. |
| `deleteRoute(id)` | Soft-delete — sets `isActive: false`. |

> ⚠️ `topSearched` returns `{ origin, destination, count }` objects — **not** `.nameAr`. The AdminPage displays them as `` `${origin} ← ${destination}` ``.

---

## 4.5 Routes (Express Routers)

### Route Ordering Rules

Express uses first-match routing. Two ordering rules are critical:

1. In `routes.routes.js`: `/history`, `/saved`, `/save/:routeId` must all appear **before** `/:routeId` — otherwise Express treats them as route ID values.
2. In `admin.routes.js`: `/stats` must appear **before** `/:id` for the same reason.

### Full Endpoint Table

| # | Method | Path | Middleware | Description |
|---|--------|------|-----------|-------------|
| 1 | POST | `/api/auth/register` | authLimiter, validate | Create account |
| 2 | POST | `/api/auth/login` | authLimiter, validate | Email + password login |
| 3 | POST | `/api/auth/refresh` | — | Rotate JWT pair |
| 4 | POST | `/api/auth/logout` | protect | Nullify refresh token |
| 5 | GET | `/api/auth/me` | protect | Current user profile |
| 6 | GET | `/api/auth/google` | passport | Start Google OAuth |
| 7 | GET | `/api/auth/google/callback` | passport | Google OAuth callback |
| 8 | GET | `/api/routes/search` | apiLimiter, optionalProtect | Search by origin + destination |
| 9 | GET | `/api/routes/stations` | apiLimiter | All stations for autocomplete |
| 10 | GET | `/api/routes/history` | apiLimiter, protect | Last 20 user searches |
| 11 | GET | `/api/routes/saved` | apiLimiter, protect | User's saved routes |
| 12 | POST | `/api/routes/save/:routeId` | apiLimiter, protect | Save a route |
| 13 | DELETE | `/api/routes/save/:routeId` | apiLimiter, protect | Unsave a route |
| 14 | GET | `/api/routes/:routeId` | apiLimiter | Single route detail |
| 15 | POST | `/api/ai/ask` | protect, aiLimiter | AI chat (SSE stream) |
| 16 | POST | `/api/ratings` | protect | Submit accuracy rating |
| 17 | GET | `/api/ratings/:routeId/stats` | — | Accuracy stats for a route |
| 18 | GET | `/api/admin/stats` | protect, requireAdmin | Dashboard statistics |
| 19 | GET | `/api/admin` | protect, requireAdmin | Paginated route list |
| 20 | POST | `/api/admin` | protect, requireAdmin, validate | Create route |
| 21 | PUT | `/api/admin/:id` | protect, requireAdmin | Update route |
| 22 | DELETE | `/api/admin/:id` | protect, requireAdmin | Soft-delete route |

---

## 4.6 Config — Passport Google OAuth

`configurePassport(passport)` registers a `GoogleStrategy`. The callback implements three-step user resolution:

1. Find existing user by `googleId` (returning Google user)
2. Find existing user by `email`, then link `googleId` to it (existing email account connecting Google for the first time)
3. Create brand-new user with `passwordHash: null` (first-time Google signup)

On success, Passport attaches the user to `req.user`. The `googleCallback` controller then:

```js
const { accessToken } = generateTokens(_id, role)
res.redirect(`${CLIENT_URL}/dashboard?token=${accessToken}`)
```

The client's `AuthContext` picks up `?token=` on mount and stores it in memory.

---

## 4.7 Database Seeder

`npm run seed` runs `src/scripts/seed.js`:

1. Connects to `MONGODB_URI`
2. Deletes all existing `Route` documents and admin `User` documents
3. Inserts 10 routes: `ALEX-MICRO-01` through `ALEX-MICRO-10`
4. Creates admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars

All seeded routes represent real Alexandria microbus lines. Routes 03–07 cover the Abu Qir corridor after the coastal train suspension in March 2024.
