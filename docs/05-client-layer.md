# 5. Client Layer — React 18 + Vite

---

## 5.1 Entry Point — main.jsx

React 18 `createRoot` with `StrictMode`. Imports `App.jsx` and `index.css`.

`index.css` contains:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```
Plus global `box-sizing: border-box` and the Cairo Arabic font as the default body font.

---

## 5.2 App.jsx — Root Component

Wraps the entire app in three providers (outermost to innermost):

1. `QueryClientProvider` — @tanstack/react-query, staleTime 5 minutes, retry: 1
2. `AuthProvider` — global auth state
3. `BrowserRouter` — react-router-dom v6

All 8 pages are lazy-loaded with `React.lazy()` + `Suspense`. The fallback is a centred amber spinner with Arabic loading text and RTL layout.

The entire app has `dir="rtl"` and `fontFamily: 'Cairo, sans-serif'` on the root div.

### Route Map

| Path | Component | Access Level |
|------|-----------|-------------|
| `/` | HomePage | Public |
| `/search` | SearchPage | Public |
| `/map` | MapPage | Public |
| `/login` | LoginPage | Public |
| `/register` | RegisterPage | Public |
| `/chat` | AIChatPage | ProtectedRoute — any logged-in user |
| `/dashboard` | DashboardPage | ProtectedRoute — any logged-in user |
| `/admin` | AdminPage | ProtectedRoute — admin role only |
| `*` | Navigate to `/` | Catch-all redirect |

---

## 5.3 AuthContext.jsx

Global authentication state. Provides to the component tree:

| Value | Type | Description |
|-------|------|-------------|
| `user` | Object \| null | Current user `{ _id, name, email, role }` |
| `isLoading` | Boolean | True while restoring session on mount |
| `login(email, password)` | async function | POST /api/auth/login, sets tokens + user |
| `loginWithGoogle()` | function | Redirects browser to /api/auth/google |
| `register(name, email, password)` | async function | POST /api/auth/register, auto-login |
| `logout()` | async function | POST /api/auth/logout, clears tokens + user |
| `updateUser(data)` | function | Merge partial update into user state |

### Session Restoration on Mount

```
1. Check window.location.search for ?token= (Google OAuth callback)
   ↓ Found:
     setTokens(oauthToken, null)
     GET /api/auth/me → setUser(data.user)
     window.history.replaceState() → strip token from URL
   ↓ Not found:
     setIsLoading(false) immediately
     (no automatic restore — tokens are in-memory only)
```

Token rotation on expiry is handled silently by the Axios interceptor — `AuthContext` is not involved.

---

## 5.4 axios.js — HTTP Client

### Token Storage

Tokens are stored in module-level variables — **not localStorage**:

```js
let accessTokenRef = null
let refreshTokenRef = null
```

Exported utilities:
- `setTokens(access, refresh)` — store/clear both tokens
- `getAccessToken()` — used by `useAIChat` for native fetch calls

### Why `baseURL: ''`

The Axios instance uses an empty string as `baseURL`. This means requests target `localhost:5173` (the same origin as the frontend). Vite's proxy then intercepts `/api/*` and forwards it to `localhost:5000`. Using `http://localhost:5000` as `baseURL` would bypass the proxy and trigger CORS errors in development.

### Interceptors

**Request:** Attaches `Authorization: Bearer <accessToken>` if a token exists.

**Response (401 handling):**
```
401 received + not already retried + refreshToken exists
  → POST /api/auth/refresh (via plain axios with full BASE_URL — bypasses proxy intentionally)
  → Success: setTokens(new pair), retry original request
  → Failure: setTokens(null, null), redirect to /login
```

---

## 5.5 useAIChat.js — SSE Streaming Hook

Manages the AI chat state: `messages[]`, `isStreaming`, `error`.

### `sendMessage(origin, destination, text)`

```
1. Append user message + empty assistant placeholder to state
2. native fetch → POST /api/ai/ask
   Headers: Content-Type: application/json
            Authorization: Bearer <token>  (if available)
3. response.body.getReader() — ReadableStream
4. Decode chunks → accumulate in string buffer
5. Split buffer on '\n' to extract SSE lines
6. For each 'data: <payload>' line:
   - payload === '[DONE]'  → mark assistant message complete
   - JSON.parse(payload)
       .text  → append to assistant message content
       .error → display as assistant message, stop streaming
```

> ⚠️ `[DONE]` is a plain-string sentinel — **never** run `JSON.parse('[DONE]')` (throws SyntaxError).

### State Shape

```js
messages: [
  {
    id: string,          // random uid
    role: 'user' | 'assistant',
    content: string,     // text content (built up incrementally for streaming)
    isStreaming: boolean, // true while assistant message is receiving chunks
    timestamp: number,
  }
]
```

---

## 5.6 Components

### ProtectedRoute.jsx

Guards protected pages:

```
isLoading  → show spinner
no user    → <Navigate to="/login" />
requireAdmin + role !== 'admin' → <Navigate to="/" />
otherwise  → render children
```

### Navbar.jsx

Sticky top navigation in Navy (`#1E3A5F`). Links: Search / Map / Chat. Right side:
- Guest: Login + Register buttons
- Authenticated: user name + Logout
- Admin: additional Admin badge link

### RouteCard.jsx

Displays a route result. Key props:

| Prop | Type | Description |
|------|------|-------------|
| `route` | Object | Route document from API |
| `accuracyStats` | Object | `{ percentage, label, total }` — comes alongside route in search results |
| `onRateClick` | Function | Opens RatingModal with this route |
| `compact` | Boolean | Condensed layout for Dashboard saved-routes view |

**AccuracyBadge** reads `accuracyStats.percentage` and `accuracyStats.label`:
- ≥ 80% → green badge — دقيق جداً
- ≥ 60% → amber badge — دقيق نسبياً
- < 60% → red badge — غير موثوق
- < 3 ratings → grey badge — غير مقيّم بعد

### RatingModal.jsx

Modal overlay for accuracy voting:
- Two large buttons: ✓ دقيق / ✗ غير دقيق
- Optional comment textarea (max 280 chars)
- On successful POST `/api/ratings`: calls `queryClient.invalidateQueries(['ratings', routeId])` to refresh accuracy badges across the UI

### AmGhareebAvatar.jsx

SVG illustration of the Am Ghareeb character — an old Alexandrian man in white galabiya and tarboush. Used as the AI chat avatar and on the HomePage hero section.

---

## 5.7 Pages

### HomePage.jsx

Landing page with Am Ghareeb avatar, Arabic tagline, and a quick search form that navigates to `/search?origin=...&destination=...`. Also shows a grid of popular routes.

### SearchPage.jsx

Two-field search form (origin, destination) with autocomplete populated from `GET /api/routes/stations`. Results rendered as a list of `RouteCard` components. Destructures each result as `{ route, accuracyStats }` — both come from the same search response object. Manages `RatingModal` state with `routeId`.

### MapPage.jsx

Uses `react-leaflet` with OpenStreetMap tiles. Behaviour:
- Reads `routeId` from URL query params
- Fetches route via `GET /api/routes/:routeId`
- Filters stations: `s.coords?.lat !== 0 && s.coords?.lng !== 0`
- Valid stations → Leaflet `Marker` components
- Zero-coord stations → sidebar list only (no map pin)
- `FitBounds` auto-zooms to all valid markers
- Geolocation button shows user's current position

### AIChatPage.jsx

Chat interface using `useAIChat` hook. Features:
- Origin + destination context inputs (sent with each message for route context)
- Streaming response with per-character typing effect
- Clear conversation button (resets to welcome message)
- Am Ghareeb avatar displayed beside each assistant message

### LoginPage.jsx / RegisterPage.jsx

Standard auth forms calling `AuthContext.login()` and `AuthContext.register()`. Both include a Google OAuth button that calls `loginWithGoogle()` → redirects the entire page to the server's OAuth flow. Validation errors displayed inline below each field.

### DashboardPage.jsx

Three tabs:

| Tab | Endpoint | Response Key |
|-----|----------|-------------|
| History | `GET /api/routes/history` | `r.data.history` |
| Saved Routes | `GET /api/routes/saved` | `r.data.routes` |
| Profile | — | User from AuthContext |

History shows last 20 searches as text entries. Saved routes render compact `RouteCard` components with an unsave button that calls `DELETE /api/routes/save/:routeId`.

### AdminPage.jsx

Full CRUD admin panel:
- Stats row: `totalRoutes`, `totalUsers`, `totalRatings`, `topSearched` (displayed as `origin ← destination`)
- Paginated routes table with Edit and soft-delete buttons
- Add/Edit route via inline modal form
- All mutations call `queryClient.invalidateQueries(['admin-routes'])` and `queryClient.invalidateQueries(['admin-stats'])`

API paths: `GET/POST /api/admin` and `PUT/DELETE /api/admin/:id`.

> 🔧 **Gamma fix applied here** — original paths were `/api/admin/routes` and `/api/admin/routes/:id`. Corrected to match the server router mount point.
