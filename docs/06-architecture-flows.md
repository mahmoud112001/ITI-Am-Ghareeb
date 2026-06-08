# 6. Architecture & Data Flows

---

## 6.1 System Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Browser / المتصفح                       │
│  React 18 + Vite + Tailwind CSS                          │
│  react-router-dom 6  │  @tanstack/react-query 5          │
│  react-leaflet (MapPage)  │  useAIChat (SSE hook)        │
└─────────────────┬───────────────────────────────────────┘
                  │  HTTP /api/*  (Vite proxy → :5000 in dev)
                  │  SSE stream   /api/ai/ask
                  ▼
┌─────────────────────────────────────────────────────────┐
│              Node.js + Express Server (:5000)            │
│  Helmet │ CORS │ Morgan │ Rate Limiting                  │
│  Passport (JWT stateless + Google OAuth 2.0)            │
│  MVC: controllers → services → models                   │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
               ▼                      ▼
┌──────────────────────┐   ┌──────────────────────────┐
│    MongoDB Atlas      │   │      OpenAI API           │
│    (Mongoose 8)       │   │      gpt-4o-mini          │
│    5 collections:     │   │      SSE streaming        │
│    Users              │   │      max_tokens: 600      │
│    Routes             │   │      temperature: 0.7     │
│    Ratings            │   └──────────────────────────┘
│    SearchHistory      │
└──────────────────────┘
```

---

## 6.2 Email/Password Authentication Flow

```
Client                              Server                        MongoDB
──────                              ──────                        ───────
POST /api/auth/login
  { email, password }
        │
        ├─ authLimiter (10 req/15min)
        ├─ validate(loginSchema)
        ▼
                              auth.controller.login()
                              auth.service.login()
                                User.findByEmail(email)  ──────► find by email
                                                         ◄────── user document
                                user.comparePassword()
                                  bcrypt.compare()
                                generateTokens(userId, role)
                                  accessToken  (15 min, JWT_SECRET)
                                  refreshToken (7 days, JWT_REFRESH_SECRET)
                                user.refreshToken = refreshToken  ──► save
                              ◄──────────────────────────────────────────
        ◄────────────────────
  { success, user, accessToken, refreshToken }
        │
  setTokens(accessToken, refreshToken)
  setUser(user)
        │
  Axios request interceptor:
    Authorization: Bearer <accessToken>
```

---

## 6.3 Token Refresh Flow

```
Client (Axios interceptor)          Server
──────────────────────────          ──────
Request → 401 received
_retry not set + refreshToken exists
        │
POST /api/auth/refresh              auth.service.refreshTokens(token)
  { refreshToken }                    jwt.verify(token, JWT_REFRESH_SECRET)
        │                             User.findById(decoded.userId)
        │                             Compare token === user.refreshToken
        │                             generateTokens() → new pair
        │                             user.refreshToken = newRefreshToken → save
        ◄──────────────────────────
  { accessToken, refreshToken }
        │
  setTokens(new pair)
  Retry original request with new accessToken
        │
  If refresh also fails:
    setTokens(null, null)
    window.location.href = '/login'
```

---

## 6.4 Google OAuth Flow

```
Client                    Server                    Google
──────                    ──────                    ──────
loginWithGoogle()
window.location.href = /api/auth/google
                          passport.authenticate()
                          ──────────────────────────────►
                                              consent screen shown
                          ◄──────────────────────────────
                          GET /api/auth/google/callback
                          passport strategy callback:
                            1. find by googleId
                            2. find by email → link googleId
                            3. create new user
                          googleCallback controller:
                            generateTokens(_id, role)
                            res.redirect(CLIENT_URL/dashboard?token=ACCESS_TOKEN)
◄─────────────────────────
/dashboard?token=eyJ...
        │
AuthContext.useEffect (mount):
  params.get('token') → oauthToken
  setTokens(oauthToken, null)
  GET /api/auth/me → setUser()
  window.history.replaceState() → /dashboard (clean URL)
```

> Note: Google OAuth only provides an access token (no refresh token stored). The user will need to re-authenticate after the 15-minute access token expires. This is by design — the in-memory token model means page reload already requires re-login.

---

## 6.5 AI Chat (RAG) Flow

```
Client                         Server                     OpenAI
──────                         ──────                     ──────
useAIChat.sendMessage(
  origin, destination, text)
        │
native fetch POST /api/ai/ask
  Authorization: Bearer <token>
  { origin, destination, message }
        │
        ├─ protect (verify JWT)
        ├─ aiLimiter (20 req/hr per userId)
        ├─ validate body (origin, destination, message required)
        ▼
                        streamTransitAdvice()
                          SSE headers flushed ◄─── BEFORE try block
                          try {
                            new OpenAI() ◄────────── INSIDE try
                            MongoDB regex query
                              origin OR destination
                              in station names, limit 5
                            Build Arabic context string
                            openai.chat.completions.create({
                              model: 'gpt-4o-mini',
                              stream: true,
                              messages: [system+context, user]
                            })
                          ──────────────────────────────────────►
                                                     stream chunks
                          ◄──────────────────────────────────────
                            for await chunk:
                              res.write('data: {"text":"..."}\n\n')
                            res.write('data: [DONE]\n\n')
                            res.end()
                          } catch (err) {
                            res.write('data: {"error":"..."}\n\n')
                            res.end()
                          }
        ◄────────────────────────────────────────────────────────
ReadableStream reader
  buffer += decoded chunk
  split on '\n'
  for each 'data: <payload>':
    if payload === '[DONE]' → isStreaming: false
    else JSON.parse(payload)
      .text  → append to assistant message
      .error → display error
```

---

## 6.6 Vite Proxy (Development Only)

```
Browser request:  GET localhost:5173/api/routes/search?origin=...
                          │
                  Vite Dev Server
                  vite.config.js proxy rule:
                    '/api' → 'http://localhost:5000'
                          │
                  Forwarded: GET localhost:5000/api/routes/search?origin=...
                          │
                  Express handles request
```

This is why `axios.js` uses `baseURL: ''` — the request stays on the same origin (`:5173`), avoiding CORS entirely in development. A `baseURL` of `http://localhost:5000` would make the browser send a cross-origin request, triggering CORS preflight.

---

## 6.7 Accuracy Rating Flow

```
Client                              Server                    MongoDB
──────                              ──────                    ───────
User clicks ✓ or ✗ in RatingModal
POST /api/ratings
  { routeId, isAccurate, comment }
        │
        ├─ protect
        ▼
                              rating.service.submitRating()
                                Route.findOne({ routeId })
                                Rating.create({
                                  user: req.user.userId,
                                  route: route._id,
                                  isAccurate,
                                  comment
                                })
                                ─── unique index { user, route } ──►
                                    duplicate → 409 error
        ◄─────────────────────────────────────────────────────────
  queryClient.invalidateQueries(['ratings', routeId])
  RouteCard AccuracyBadge re-fetches GET /api/ratings/:routeId/stats
        │
                              Route.getAccuracyStats(routeId)
                                Rating.countDocuments({ route, isAccurate: true })
                                Rating.countDocuments({ route })
                                percentage = accurate/total * 100
                                label = 'دقيق جداً' | 'دقيق نسبياً' | 'غير موثوق'
        ◄─────────────────────────────────────────────────────────
  AccuracyBadge updates with new percentage + label
```
