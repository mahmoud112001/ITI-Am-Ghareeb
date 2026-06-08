# 3. How to Open & Run the Project

---

## Prerequisites

- Node.js ≥ 18.0.0
- A free MongoDB Atlas account (or local MongoDB 6+)
- An OpenAI API key with access to `gpt-4o-mini`
- A Google Cloud project with OAuth 2.0 credentials *(optional — only for Google login)*

---

## Step-by-Step Setup

### Step 1 — Clone the repository

```bash
git clone https://github.com/your-org/am-ghareeb.git
cd am-ghareeb
```

### Step 2 — Install server dependencies

```bash
cd server && npm install
```

### Step 3 — Install client dependencies

```bash
cd ../client && npm install
```

### Step 4 — Configure environment variables

```bash
cp server/.env.example server/.env
```

Open `server/.env` and fill in every value:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | No (default: 5000) | Express server port | `5000` |
| `NODE_ENV` | No (default: development) | Affects error stack exposure | `development` |
| `MONGODB_URI` | **YES** | Full MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.../am-ghareeb` |
| `JWT_SECRET` | **YES** | Min 64 chars — signs access tokens (15m) | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | **YES** | Different from JWT_SECRET — signs refresh tokens (7d) | `openssl rand -hex 32` |
| `OPENAI_API_KEY` | **YES** | Your OpenAI secret key | `sk-...` |
| `GOOGLE_CLIENT_ID` | For Google login | From Google Cloud Console | `123....apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | For Google login | From Google Cloud Console | `GOCSPX-...` |
| `GOOGLE_CALLBACK_URL` | For Google login | Must match Authorized redirect URI in Google Console | `http://localhost:5000/api/auth/google/callback` |
| `CLIENT_URL` | **YES** | Frontend origin for CORS + OAuth redirect | `http://localhost:5173` |
| `ADMIN_EMAIL` | **YES** | Email for the seeded admin account | `admin@amghareeb.com` |
| `ADMIN_PASSWORD` | **YES** | Password for the seeded admin account — change immediately | `ChangeMe123!` |

> ⚠️ Never commit `server/.env` — it is listed in `.gitignore`.

### Step 5 — Seed the database

```bash
cd server && npm run seed
```

Expected console output:

```
جاري الاتصال بقاعدة البيانات... (محاولة 1 من 3)
تم الاتصال بقاعدة البيانات بنجاح ✓
جاري حذف البيانات القديمة...
جاري إضافة الخطوط...
تم إضافة 10 خط بنجاح ✓
تم إنشاء المستخدم الإداري ✓
تم الانتهاء من الـ Seed بنجاح 🎉
```

### Step 6 — Start the server (Terminal 1)

```bash
cd server && npm run dev
```

Nodemon watches for file changes. Server starts on `http://localhost:5000`.

### Step 7 — Start the client (Terminal 2)

```bash
cd client && npm run dev
```

Vite starts on `http://localhost:5173` with HMR enabled.

### Step 8 — Open the app

```
http://localhost:5173
```

---

## Available npm Scripts

| Location | Script | Command | Description |
|----------|--------|---------|-------------|
| `server/` | `dev` | `nodemon server.js` | Development with auto-restart |
| `server/` | `start` | `node server.js` | Production start |
| `server/` | `test` | `jest --runInBand --detectOpenHandles` | Run all 67 tests |
| `server/` | `seed` | `node src/scripts/seed.js` | Seed 10 routes + admin user |
| `client/` | `dev` | `vite` | Development server with HMR |
| `client/` | `build` | `vite build` | Production build → `dist/` |
| `client/` | `preview` | `vite preview` | Preview the production build locally |

---

## Production Build

```bash
# Build client
cd client && npm run build
# Output goes to client/dist/ — serve with nginx, Vercel, or similar

# Run server in production
cd server
NODE_ENV=production node server.js
```

> ⚠️ In production, set `CLIENT_URL` to your actual frontend domain and update `GOOGLE_CALLBACK_URL` to match.
