# 9. Environment Variables Reference

---

## server/.env

Copy from `server/.env.example` before first run:

```bash
cp server/.env.example server/.env
```

> ⚠️ `server/.env` is listed in `.gitignore` and must **never** be committed.

### Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Express server port |
| `NODE_ENV` | No | `development` | Set to `production` in production. Controls error stack exposure and logging verbosity. |
| `MONGODB_URI` | **YES** | — | Full MongoDB Atlas connection string including the database name. Format: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>` |
| `JWT_SECRET` | **YES** | — | At least 64 characters. Used to sign and verify **access tokens** (15-minute expiry). Generate with `openssl rand -hex 32`. |
| `JWT_REFRESH_SECRET` | **YES** | — | Must be **different** from `JWT_SECRET`. Signs **refresh tokens** (7-day expiry). Generate separately with `openssl rand -hex 32`. |
| `OPENAI_API_KEY` | **YES** | — | Your OpenAI secret key (`sk-...`). Must have access to `gpt-4o-mini`. Get from [platform.openai.com](https://platform.openai.com). |
| `GOOGLE_CLIENT_ID` | For Google login | — | From Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs |
| `GOOGLE_CLIENT_SECRET` | For Google login | — | From the same Google Cloud Console credential entry |
| `GOOGLE_CALLBACK_URL` | For Google login | — | Must **exactly** match the Authorized Redirect URI configured in Google Console. Dev value: `http://localhost:5000/api/auth/google/callback` |
| `CLIENT_URL` | **YES** | — | Frontend origin. Used for: CORS `origin` allowlist, and as the base for Google OAuth redirect. Dev: `http://localhost:5173` |
| `ADMIN_EMAIL` | **YES** | — | Email address for the seeded admin account |
| `ADMIN_PASSWORD` | **YES** | — | Password for the seeded admin account. **Change immediately** from the default. Must satisfy the password policy: min 8 chars, at least one uppercase letter, at least one digit. |

---

## client/.env.local

```
VITE_API_URL=http://localhost:5000
```

This is used by `useAIChat.js` to build the SSE endpoint URL for the native `fetch` call. The Axios instance in `axios.js` does **not** use this variable — it uses `baseURL: ''` and relies on the Vite proxy instead.

> ⚠️ In Vite, only variables prefixed with `VITE_` are exposed to browser code. Never put secrets in `client/.env.local`.

---

## How Variables Are Used

```
MONGODB_URI       → server.js   (mongoose.connect)
JWT_SECRET        → auth.service.js, auth.middleware.js
JWT_REFRESH_SECRET → auth.service.js
OPENAI_API_KEY    → ai.service.js (new OpenAI({ apiKey }))
GOOGLE_CLIENT_ID  → config/passport.js
GOOGLE_CLIENT_SECRET → config/passport.js
GOOGLE_CALLBACK_URL → config/passport.js
CLIENT_URL        → app.js (CORS), auth.controller.js (OAuth redirect)
ADMIN_EMAIL       → src/scripts/seed.js
ADMIN_PASSWORD    → src/scripts/seed.js
PORT              → server.js (app.listen)
NODE_ENV          → error.middleware.js (stack exposure)
```

---

## Google Cloud Console Setup

To enable Google login:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable the **Google+ API** (or People API)
4. Navigate to APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
5. Application type: **Web application**
6. Authorized JavaScript origins: `http://localhost:5173`
7. Authorized redirect URIs: `http://localhost:5000/api/auth/google/callback`
8. Copy Client ID → `GOOGLE_CLIENT_ID`
9. Copy Client Secret → `GOOGLE_CLIENT_SECRET`

---

## Generating Secure Secrets

```bash
# Generate JWT_SECRET
openssl rand -hex 32

# Generate JWT_REFRESH_SECRET (run again — must be different)
openssl rand -hex 32
```

Or use Node.js:
```js
require('crypto').randomBytes(64).toString('hex')
```
