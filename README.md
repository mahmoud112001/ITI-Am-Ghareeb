# عم غريب — Am Ghareeb

---

## عم غريب

عم غريب هو مساعد ذكاء اصطناعي متخصص في الإجابة عن أسئلة المواصلات العامة في مدينة الإسكندرية.
يساعدك في معرفة خطوط المشاريع والأتوبيسات والترام، ويوضح أفضل الطرق بين أي نقطتين في المدينة.
المشروع مفتوح المصدر، مبني بـ React وNode.js وMongoDB، ويستخدم GPT-4o-mini لمحادثات طبيعية باللغة العربية.

## Am Ghareeb

Am Ghareeb is an AI-powered transit advisor for Alexandria, Egypt, specializing in microbus, tram, and bus routes.
It helps residents and visitors find the right line between any two points in the city, with real-time AI chat in Arabic.
Built on React + Vite (client) and Node + Express + MongoDB (server), it uses OpenAI gpt-4o-mini for natural-language responses.

---

## Prerequisites

- Node.js ≥ 18
- MongoDB Atlas account (free tier works)
- OpenAI API key (gpt-4o-mini access)
- Google Cloud project with OAuth 2.0 credentials (for Google login)

---

## Quick Start / البدء السريع

**الخطوة ١ / Step 1 — Clone the repository**
```bash
git clone https://github.com/your-org/am-ghareeb.git
cd am-ghareeb
```

**الخطوة ٢ / Step 2 — Install server dependencies**
```bash
cd server && npm install
```

**الخطوة ٣ / Step 3 — Install client dependencies**
```bash
cd ../client && npm install
```

**الخطوة ٤ / Step 4 — Configure environment**
```bash
cp server/.env.example server/.env
# افتح server/.env وأدخل قيمك الفعلية
# Open server/.env and fill in all values (MongoDB URI, JWT secrets, OpenAI key, Google OAuth)
```

**الخطوة ٥ / Step 5 — Seed the database**
```bash
cd server && npm run seed
```
Expected Arabic output:
```
🌱 بدء تحميل البيانات...
✅ تم حذف البيانات القديمة
✅ تم إضافة 10 خطوط
✅ تم إنشاء حساب الأدمن
🎉 تم تحميل البيانات بنجاح
```

**الخطوة ٦ / Step 6 — Start the server (Terminal 1)**
```bash
cd server && npm run dev
# Server running on http://localhost:5000
```

**الخطوة ٧ / Step 7 — Start the client (Terminal 2)**
```bash
cd client && npm run dev
# Client running on http://localhost:5173
```

**الخطوة ٨ / Step 8 — Open the app**
```
http://localhost:5173
```

---

## Architecture / البنية

```
┌─────────────────────────────────────┐
│          Browser / المتصفح          │
│   React 18 + Vite + Tailwind CSS    │
│   react-router-dom 6  │  react-query│
│   react-leaflet (MapPage)           │
└──────────────┬──────────────────────┘
               │ HTTP /api/* (Vite proxy → :5000)
               │ SSE  /api/ai/ask
               ▼
┌─────────────────────────────────────┐
│     Node.js + Express Server        │
│   Passport (JWT + Google OAuth)     │
│   Helmet │ CORS │ Rate Limiting     │
│   MVC: controllers / services       │
└────────┬────────────────┬───────────┘
         │                │
         ▼                ▼
┌────────────────┐  ┌──────────────────┐
│  MongoDB Atlas │  │  OpenAI API      │
│  (Mongoose 8)  │  │  gpt-4o-mini     │
│  5 collections │  │  SSE streaming   │
└────────────────┘  └──────────────────┘
```

---

## API Endpoints / نقاط الـ API

| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 1 | POST | /api/auth/register | — | تسجيل مستخدم جديد |
| 2 | POST | /api/auth/login | — | تسجيل الدخول |
| 3 | POST | /api/auth/refresh | — | تجديد الـ access token |
| 4 | POST | /api/auth/logout | JWT | تسجيل الخروج |
| 5 | GET | /api/auth/me | JWT | بيانات المستخدم الحالي |
| 6 | GET | /api/auth/google | — | بدء OAuth مع Google |
| 7 | GET | /api/auth/google/callback | — | callback من Google |
| 8 | GET | /api/routes/search | optional | البحث عن خط |
| 9 | GET | /api/routes/stations | — | كل المحطات للـ autocomplete |
| 10 | GET | /api/routes/history | JWT | آخر 20 بحث للمستخدم |
| 11 | GET | /api/routes/saved | JWT | الخطوط المحفوظة مع إحصائيات |
| 12 | POST | /api/routes/save/:routeId | JWT | حفظ خط |
| 13 | DELETE | /api/routes/save/:routeId | JWT | إلغاء حفظ خط |
| 14 | GET | /api/routes/:routeId | — | تفاصيل خط واحد |
| 15 | POST | /api/ai/ask | JWT | محادثة AI (SSE stream) |
| 16 | POST | /api/ratings | JWT | إضافة تقييم |
| 17 | GET | /api/ratings/:routeId/stats | — | إحصائيات دقة خط |
| 18 | GET | /api/admin/stats | Admin | إحصائيات عامة |
| 19 | GET | /api/admin | Admin | كل الخطوط (admin view) |
| 20 | POST | /api/admin | Admin | إضافة خط جديد |
| 21 | PUT | /api/admin/:id | Admin | تعديل خط |
| 22 | DELETE | /api/admin/:id | Admin | حذف خط (soft delete) |

---

## Running Tests / تشغيل الاختبارات

```bash
cd server && npm test
```

Expected: **67 tests passing**

| Suite | Tests |
|-------|-------|
| models.test.js | 19 |
| auth.test.js | 13 |
| routes.test.js | 11 |
| rating.test.js | 8 |
| admin.test.js | 9 |
| ai.test.js | 7 |

---

## Design Tokens / ألوان التصميم

| Token | Hex | Usage |
|-------|-----|-------|
| Navy / الكحلي | `#1E3A5F` | Primary brand, navbar |
| Amber / العنبري | `#F59E0B` | Accent, CTA buttons |
| Cream / الكريمي | `#FEF9EF` | Page backgrounds |
| White / الأبيض | `#FFFFFF` | Cards, modals |

---

## Account Roles / أدوار الحسابات

| Role | Owner | Responsibilities |
|------|-------|-----------------|
| Alpha (A) | Client layer | React pages, components, hooks, Vite config |
| Beta (B) | Server src/ | Models, services, routes, middleware, tests |
| Gamma (C) | Integration | Merge A+B, contract verification, delivery |
| Admin (D) | Seed + scaffold | server/app.js, server.js, package configs |

---

## Known Limitations / القيود المعروفة

- **Token persistence** — Access tokens are stored in memory only; users must log in again after a page reload (by design — no localStorage).
- **Dashboard history/saved** — Tabs require seeded data and authenticated routes to show results; an empty DB returns empty arrays.
- **MapPage markers** — Only stations with verified GPS coordinates render as Leaflet markers; unverified stations are filtered out silently.
- **Abu Qir train suspended** — The Abu Qir coastal train line has been suspended since March 2024. Routes ALEX-MICRO-03 through ALEX-MICRO-07 are the active microbus replacements for that corridor.

---

*عم غريب — Intricate Engineering. Familiar Streets.*

---

## Documentation / التوثيق

Full technical documentation is in the `docs/` folder:

| # | Document | Contents |
|---|----------|----------|
| 1 | [Overview](docs/01-overview.md) | What the app does, tech stack, design tokens, file counts |
| 2 | [Project Structure](docs/02-structure.md) | Full directory tree with annotations |
| 3 | [How to Run](docs/03-how-to-run.md) | Step-by-step setup, env vars table, npm scripts |
| 4 | [Server Layer](docs/04-server-layer.md) | Express app, models, middleware, services, routes, seeder |
| 5 | [Client Layer](docs/05-client-layer.md) | React app, AuthContext, Axios, useAIChat hook, all pages |
| 6 | [Architecture & Flows](docs/06-architecture-flows.md) | Auth flow, OAuth flow, RAG/SSE flow, Vite proxy, rating flow |
| 7 | [Testing](docs/07-testing.md) | How to run tests, test infrastructure, all 67 tests documented |
| 8 | [Gamma Integration](docs/08-gamma-integration.md) | Audit results, merging work, bug fix log, final checklist |
| 9 | [Environment Variables](docs/09-environment.md) | Every env var explained, Google Console setup, secret generation |
| 10 | [Glossary](docs/10-glossary.md) | Arabic terms, technical terms, project-specific concepts |
