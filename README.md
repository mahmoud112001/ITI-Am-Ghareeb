# عم غريب — Deep-Dive Architecture Documentation
> شرح مفصل لكل layer في المشروع: مسؤوليتها، مع مين بتتكلم، ليه موجودة، وإيه البدايل.

---

## فهرس المحتويات

1. [Architecture — Monolithic MVC / N-Tier](#1-architecture)
2. [Frontend & Foundation](#2-frontend--foundation)
3. [API & Backend Logic — Endpoints](#3-api--backend-logic)
4. [Database & Storage](#4-database--storage)
5. [Auth & Permissions](#5-auth--permissions)
6. [Hosting & Deployment](#6-hosting--deployment)
7. [Cloud & Computing](#7-cloud--computing)
8. [Version Control & CI/CD](#8-version-control--cicd)
9. [Security & Row-Level Security](#9-security--row-level-security)
10. [Unit Testing & Jest](#10-unit-testing--jest)
11. [RAG & AI Pipeline](#11-rag--ai-pipeline)
12. [Rate Limiting](#12-rate-limiting)
13. [Caching & CDN](#13-caching--cdn)
14. [Error Tracking & Logs](#14-error-tracking--logs)
15. [Availability & Recovery](#15-availability--recovery)

---

## 1. Architecture

### النوع: Monolithic MVC مع N-Tier Separation

المشروع مش microservices ومش pure monolith — هو **Monolithic Layered MVC** أو اللي بيتسمى أحياناً **N-Tier**.

```
┌─────────────────────────────────────────────┐
│           Tier 1: Presentation              │
│     React SPA (client/) — يشتغل في Browser │
├─────────────────────────────────────────────┤
│           Tier 2: Application               │
│     Express Server (server/) — Node.js      │
│     ┌─────────────────────────────────────┐ │
│     │  Routes → Controllers → Services   │ │
│     │         (MVC Pattern)              │ │
│     └─────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│           Tier 3: Data                      │
│     MongoDB Atlas — Mongoose ODM            │
│     OpenAI API (external service)           │
└─────────────────────────────────────────────┘
```

### ليه MVC وليه مش غيره؟

**MVC (Model-View-Controller)** بيقسم المسؤوليات بالشكل ده:

| Layer | في مشروعنا | مسؤوليتها |
|-------|------------|-----------|
| **Model** | `server/src/models/*.model.js` | تعريف شكل البيانات والعلاقات بينها |
| **View** | `client/src/` (React) | عرض البيانات للمستخدم |
| **Controller** | `server/src/controllers/*.controller.js` | استقبال الـ HTTP request وبعتها للـ service |

**ليه مش Microservices؟**
- المشروع صغير ومحتاج deployment بسيط
- team صغيرة (أنت لوحدك أو تيم صغير)
- Microservices بتضيف overhead في الـ networking والـ DevOps مش محتاجاه دلوقتي

**ليه مش Pure MVC (بدون services layer)؟**
- لو حطينا الـ business logic في الـ controllers هتبقى ضخمة وصعبة اختبار
- الـ services layer خليت الـ controllers مجرد thin HTTP handlers، والـ logic كلها في Services قابلة للاختبار بشكل مستقل

### تدفق الـ Request من البداية للنهاية

```
Browser
  │
  ▼
React Component (مثلاً SearchPage)
  │  يعمل axios.get('/api/routes/search?origin=...')
  ▼
Vite Dev Server (يعمل proxy للـ /api → localhost:5000)
  │
  ▼
Express app.js — Middleware Stack
  │  helmet → cors → morgan → body parser → passport
  ▼
Router (routes.routes.js)
  │  GET /api/routes/search → apiLimiter → optionalProtect
  ▼
Controller (routes.controller.js)
  │  يسحب req.query.origin و req.query.destination
  │  يعمل validation بسيطة
  ▼
Service (routes.service.js → searchRoutes())
  │  يعمل MongoDB query
  │  يحسب accuracy stats
  │  يحفظ search history لو فيه user
  ▼
Model (Route.model.js + Rating.model.js)
  │  Mongoose query → MongoDB Atlas
  ▼
البيانات بترجع back نفس الطريق
  │
  ▼
res.json({ success: true, data: results })
  │
  ▼
React: بتعرض النتائج في RouteCard components
```

---

## 2. Frontend & Foundation

### الـ Stack

```
React 18.2.0
Vite 5.0.12
Tailwind CSS 3.4.1
react-router-dom 6.22.1
@tanstack/react-query 5.18.1
axios 1.6.7
leaflet 1.9.4 + react-leaflet 4.2.1
lucide-react
```

### React 18 — المحرك الأساسي

**مسؤوليتها:** بناء الـ UI كـ component tree، إدارة الـ state، وعرض البيانات.

**بتتكلم مع مين؟**
- الـ Express server عن طريق Axios و native fetch (للـ SSE)
- الـ Browser APIs (localStorage, navigator.geolocation, EventSource)

**ليه React وليه مش Angular أو Vue؟**

| Library | المميزات | العيوب |
|---------|----------|--------|
| **React (اللي بنستخدمه)** | Ecosystem ضخم، Hooks بسيطة، جتمع كبير | مش opinionated — لازم تختار كل حاجة بنفسك |
| Angular | Opinionated، كل حاجة موجودة فيه | Verbose، learning curve أكبر |
| Vue | سهل التعلم، syntax واضح | Ecosystem أصغر شوية |

**في مشروعنا:** React اتاخد لأنه الأشهر في الـ MERN stack.

### Vite — الـ Build Tool

**مسؤوليتها:** بناء الـ React app للـ production، وتشغيل الـ dev server.

**بتتكلم مع مين؟**
- الـ Browser: بتقدم الـ files
- الـ Express server في development عن طريق الـ proxy

**الـ Proxy في vite.config.js — ليه مهم؟**

```js
// vite.config.js
server: {
  proxy: {
    '/api': 'http://localhost:5000'
  }
}
```

بدون الـ proxy ده، لو الـ React شغال على port 5173 وبيبعت request لـ localhost:5000، المتصفح هيرفض الـ request بسبب **CORS** (Cross-Origin Resource Sharing).

الـ proxy بيخلي المتصفح يعتقد إن الـ request بتروح لنفس الـ origin (5173)، وـالـ Vite هو اللي بيوديها لـ localhost:5000 في الـ background.

**في Production:**
- مفيش Vite dev server — الـ React app بيتبني لـ static files
- الـ Express ممكن يقدم الـ static files ده، أو ممكن تحطهم على Nginx/Vercel

### Tailwind CSS — الـ Styling System

**مسؤوليتها:** utility-first CSS. بدل ما تكتب CSS class اسمها `.btn-primary` وتعرّف فيها style، بتحط classes زي `bg-blue-500 px-4 py-2 rounded` مباشرة في الـ JSX.

**بتتكلم مع مين؟** الـ Browser فقط — بتولّد CSS classes.

**في مشروعنا:** لاحظ إن معظم الـ styles مش Tailwind خالص — فيه `style={{ backgroundColor: '#1B2A4A' }}` inline styles كتير. ده بيحصل لأن الـ design tokens (الألوان الخاصة بالمشروع) مش معرّفة في `tailwind.config.js`.

**البديل:** Styled-components، CSS Modules، أو تعريف custom colors في tailwind.config.

### @tanstack/react-query — الـ Server State Manager

**مسؤوليتها:** إدارة الـ API calls، الـ caching، والـ loading/error states بشكل تلقائي.

**بتتكلم مع مين؟** الـ Express API عن طريق Axios.

```js
// بدون react-query — كود معقد
const [data, setData] = useState(null)
const [loading, setLoading] = useState(false)
const [error, setError] = useState(null)
useEffect(() => {
  setLoading(true)
  api.get('/api/routes/stations')
    .then(r => setData(r.data))
    .catch(e => setError(e))
    .finally(() => setLoading(false))
}, [])

// مع react-query — بسيط جداً
const { data, isLoading, error } = useQuery({
  queryKey: ['stations'],
  queryFn: () => api.get('/api/routes/stations').then(r => r.data.stations),
  staleTime: Infinity,  // لا تعيد الـ fetch أبداً — البيانات مش بتتغير
})
```

**المميزات المهمة:**
- **Caching:** نفس الـ query مش بيتعمل أكتر من مرة لحد ما الـ staleTime يخلص
- **Background refetch:** لما المستخدم يرجع للتاب بيعمل refresh تلقائي
- **`invalidateQueries`:** لما المستخدم يعمل rating، بنعمل invalidate لـ cache الـ ratings عشان تتحدث

**في مشروعنا:**
- `/api/routes/stations` — `staleTime: Infinity` لأن الـ stations مش بتتغير
- الـ ratings — `invalidateQueries` بعد كل vote عشان الـ badge يتحدث

### react-router-dom v6 — الـ Client-Side Routing

**مسؤوليتها:** الانتقال بين الصفحات بدون reload للصفحة.

**بتتكلم مع مين؟** الـ Browser history API.

```
/ → HomePage
/search → SearchPage
/map → MapPage
/chat → AIChatPage (Protected — محتاج login)
/dashboard → DashboardPage (Protected)
/admin → AdminPage (Protected + Admin only)
/login → LoginPage
/register → RegisterPage
* → Redirect to /
```

**Lazy Loading:**

```js
const SearchPage = lazy(() => import('./pages/SearchPage'))
```

بدل ما يحمّل كل الـ pages مع بعض عند أول فتح، بيحمّل كل page لما المستخدم يطلبها. ده بيقلل الـ initial bundle size.

### axios.js — الـ HTTP Client Wrapper

**مسؤوليتها:** إرسال كل الـ API calls مع الـ token تلقائياً، والـ token refresh عند الـ 401.

**Token Management Pattern:**

```
localStorage ──► in-memory variable (accessTokenRef)
                         │
                 Axios request interceptor
                         │
                 Authorization: Bearer <token> header
```

**ليه in-memory variable وليه مش localStorage مباشرة؟**

الـ localStorage access بطيء نسبياً، والـ interceptor بيتشغل مع كل request. الأفضل نخزن الـ token في memory ونحدّث الـ localStorage كـ backup فقط.

**Token Refresh Flow:**

```
Request → 401 response
     │
Is it already retried? (_retry flag)  → yes → redirect to /login
     │ no
Has refresh token?  → no → redirect to /login
     │ yes
POST /api/auth/refresh
     │
Success → update tokens → retry original request
     │
Fail → clear tokens → redirect to /login
```

---

## 3. API & Backend Logic

### Express MVC Structure

**الـ Server entry points:**

```
server.js   ← يعمل mongoose.connect() ثم app.listen()
app.js      ← يعرّف Express app بدون listen() (عشان الـ tests)
```

**ليه file منفصلة لـ app.js وـserver.js؟**

الـ tests بتـimport الـ `app` وبتدير عليه supertest — مش محتاجة real TCP server. لو الـ DB connection كان في app.js، كل test suite كانت هتحاول تتصل بـ real MongoDB. الفصل ده خلى الـ tests سريعة ومستقلة.

### Middleware Stack (الترتيب مهم جداً)

```
app.use(helmet())              [1] Security headers
app.use(cors(...))             [2] CORS policy
app.use(morgan('dev'))         [3] HTTP logging
app.use(express.json())        [4] Parse JSON body
app.use(express.urlencoded())  [5] Parse form body
app.use(passport.initialize()) [6] Auth setup
app.use('/api/auth', ...)      [7] Routes
app.use('/api/routes', ...)    [8] Routes
app.use('/api/ai', ...)        [9] Routes
app.use('/api/ratings', ...)   [10] Routes
app.use('/api/admin/', ...)    [11] Routes
app.use(404 handler)           [12] Catch-all
app.use(errorMiddleware)       [13] MUST BE LAST
```

**ليه الترتيب مهم؟**

كل `app.use()` في Express بيشتغل بالترتيب. لو حطّيت `errorMiddleware` قبل الـ routes، هيشتغل على كل request حتى الـ successful ones. لو حطّيت `express.json()` بعد الـ routes، الـ body هيوصل undefined.

### الـ Controllers — Thin HTTP Handlers

```js
// auth.controller.js — مثال
const register = async (req, res, next) => {
  try {
    const result = await authService.register(
      req.body.name,
      req.body.email,
      req.body.password
    )
    res.status(201).json({ success: true, ...result })
  } catch (err) {
    next(err)  // يبعت الـ error للـ errorMiddleware
  }
}
```

الـ controller مسؤول فقط عن:
1. استخراج البيانات من `req`
2. استدعاء الـ service
3. تحويل النتيجة لـ HTTP response
4. تمرير الـ errors لـ `next(err)`

**مسؤولية صفر** في الـ business logic.

### الـ Services — Business Logic

ده قلب المشروع. كل الـ logic التجارية هنا:

**routes.service.js — الأضخم:**

```
searchRoutes(origin, destination, userId, originCoords)
│
├─ findMatchingLocations(originQuery)  → MongoDB regex
├─ findMatchingLocations(destinationQuery)  → MongoDB regex
├─ loadAllActiveRoutes()  → كل الـ routes الـ active
│
├─ buildRouteVariants()  → forward + reverse directions
├─ buildBoardableStopIndex()  → index by locationId
│
├─ searchTravelPlansBySegmentCount(exactCount=1)  → direct routes
│
├─ إذا مفيش direct:
│  searchTravelPlansBySegmentCount(exactCount=2)  → 1 transfer
│
├─ إذا مفيش:
│  يجرب من 2 لـ 5 transfers
│
└─ formatDirectTravelPlanResult() أو formatTransferTravelPlanResult()
   │
   └─ Route.getAccuracyStats()  → accuracy badge
```

**الـ BFS Transfer Search Algorithm:**

خوارزمية البحث عن الـ transfers شغالة بـ state machine:

```
State = { currentLocation, usedRoutes, visitedLocations, score }

للـ segment 1:
  جرب كل route تبدأ من origin
  لكل route: حدد الـ boarding stop
  لكل boarding: شوف ممكن تنزل فين

للـ segment 2 (transfer):
  من نقطة النزول السابقة
  ابحث عن routes قريبة (≤ 500 متر)
  جرب كل combination
  
Sort by score (عدد المحطات + مسافة المشي)
```

### الـ API Endpoints — الجدول الكامل

| Method | Path | Auth | Rate Limit | الوظيفة |
|--------|------|------|-----------|---------|
| POST | `/api/auth/register` | ❌ | authLimiter | تسجيل حساب |
| POST | `/api/auth/login` | ❌ | authLimiter | تسجيل دخول |
| POST | `/api/auth/refresh` | ❌ | — | تجديد الـ token |
| POST | `/api/auth/logout` | ✅ | — | تسجيل خروج |
| GET | `/api/auth/me` | ✅ | — | بيانات المستخدم |
| GET | `/api/auth/google` | ❌ | — | بدء Google OAuth |
| GET | `/api/auth/google/callback` | ❌ | — | callback بعد Google |
| GET | `/api/routes/search` | 🔶 Optional | apiLimiter | بحث عن خط |
| GET | `/api/routes/stations` | ❌ | apiLimiter | كل المحطات للـ autocomplete |
| GET | `/api/routes/history` | ✅ | apiLimiter | آخر 20 بحث |
| GET | `/api/routes/saved` | ✅ | apiLimiter | الخطوط المحفوظة |
| POST | `/api/routes/save/:id` | ✅ | apiLimiter | حفظ خط |
| DELETE | `/api/routes/save/:id` | ✅ | apiLimiter | إزالة خط محفوظ |
| POST | `/api/routes/save-plan` | ✅ | apiLimiter | حفظ رحلة متعددة |
| DELETE | `/api/routes/save-plan/:id` | ✅ | apiLimiter | إزالة رحلة |
| GET | `/api/routes/:routeId` | ❌ | apiLimiter | تفاصيل خط |
| POST | `/api/ai/ask` | ✅ | aiLimiter | سؤال عم غريب (SSE) |
| POST | `/api/ratings` | ✅ | — | تقييم خط |
| GET | `/api/ratings/:id/stats` | ❌ | — | إحصائيات التقييم |
| GET | `/api/admin/stats` | ✅ Admin | — | إحصائيات الادمن |
| GET | `/api/admin/routes` | ✅ Admin | — | قائمة الخطوط |
| POST | `/api/admin/routes` | ✅ Admin | — | إنشاء خط |
| PUT | `/api/admin/routes/:id` | ✅ Admin | — | تعديل خط |
| DELETE | `/api/admin/routes/:id` | ✅ Admin | — | حذف ناعم للخط |

**🔶 Optional Auth:** الـ search ممكن يشتغل بدون login، بس لو المستخدم logged in بيحفظ الـ search history.

---

## 4. Database & Storage

### MongoDB Atlas + Mongoose 8

**مسؤوليتها:** تخزين كل بيانات المشروع بشكل persistent.

**بتتكلم مع مين؟** الـ Express services فقط — الـ client مش بيتكلم مع الـ DB مباشرة أبداً.

### ليه MongoDB وليه مش SQL (PostgreSQL/MySQL)؟

| المعيار | MongoDB | PostgreSQL |
|---------|---------|------------|
| **Schema flexibility** | بيغير بسهولة — كل route ممكن يكون ليه fields مختلفة | Schema صارم — كل تغيير يحتاج migration |
| **Embedded documents** | ممتاز — الـ stops embedded في الـ route | لازم JOIN tables |
| **Geospatial queries** | 2dsphere index built-in | PostGIS extension |
| **JSON/Arabic data** | String storage سهل | نفس الشيء |
| **Transactions** | متوفرة في v4+ | متوفرة وأقوى |
| **MERN stack compatibility** | native | ممكن مع Sequelize/Prisma |

**للـ route data اللي فيها:**
- stops embedded array
- geometry LineString
- Arabic + English text
- nested fare object

MongoDB كان الاختيار الطبيعي في الـ MERN context.

### الـ Collections والـ Models

#### User

```js
{
  _id: ObjectId,
  name: String,          // 2-50 حرف
  email: String,         // unique, lowercase
  passwordHash: String,  // bcrypt-12, null لو Google OAuth
  googleId: String,      // sparse index — null لو email user
  role: 'user' | 'admin',
  refreshToken: String,  // null بعد logout
  savedRoutes: [ObjectId → Route],
  createdAt, updatedAt
}
```

**Pre-save hook:** قبل الحفظ لو `passwordHash` اتغير وليس null، بيعمله hash بـ bcrypt (cost 12).

**Static method:** `findByEmail(email)` — lowercase + trim قبل الـ query.

**Instance method:** `comparePassword(plain)` — bcrypt.compare.

#### Route

```js
{
  _id: ObjectId,
  routeId: String,       // unique — مثلاً 'ALEX-MICRO-01'
  type: 'microbus' | 'bus' | 'tram' | 'train' | 'university_shuttle',
  localName: String,     // 'مشروع'
  nameAr: String,        // required
  nameEn: String,        // required
  origin: ObjectId → Location,
  destination: ObjectId → Location,
  stops: [{
    location: ObjectId → Location,
    allowPickup: Boolean,
    allowDropoff: Boolean
  }],
  geometry: {            // GeoJSON LineString
    type: 'LineString',
    coordinates: [[lng, lat], ...]
  },
  waypoints: [{lat, lng}],
  path: [{lat, lng}],    // OSRM-computed path
  pathStale: Boolean,    // true لو الـ waypoints اتغيرت
  fare: { min, max, currency, lastVerified },
  operatingHours: { start, end },
  peakHours: [String],
  tips: [String],
  isBidirectional: Boolean,
  verified: Boolean,
  isActive: Boolean,     // false = soft-deleted
  createdAt, updatedAt
}
```

**Indexes:**
- Text index على `routeId, nameAr, nameEn` للبحث النصي
- Compound index على `origin, destination, isActive`
- Index على `stops.location, isActive`

**Static method:** `getAccuracyStats(routeId)` — يحسب نسبة الـ accurate ratings.

#### Location

```js
{
  _id: ObjectId,
  canonicalKey: String,  // unique — 'nameAr__nameEn'
  nameAr: String,        // required
  nameEn: String,        // required
  aliases: {
    ar: [String],        // أسماء بديلة عربي
    en: [String]         // أسماء بديلة إنجليزي
  },
  location: {            // GeoJSON Point (للـ 2dsphere queries)
    type: 'Point',
    coordinates: [lng, lat]
  },
  district: String
}
```

**Indexes:**
- 2dsphere index على `location` (للـ geospatial queries)
- Text index على `nameAr, nameEn, aliases.ar, aliases.en`

#### Rating

```js
{
  _id: ObjectId,
  user: ObjectId → User,
  route: ObjectId → Route,
  isAccurate: Boolean,   // required — الـ thumbs up/down
  comment: String        // max 280 حرف
}
```

**Unique compound index:** `{ user, route }` — منع التصويت أكتر من مرة على نفس الخط.

#### SearchHistory

```js
{
  _id: ObjectId,
  user: ObjectId → User,
  originQuery: String,
  destinationQuery: String,
  routesFound: Number,
  createdAt, updatedAt
}
```

#### SavedTravelPlan

للرحلات المتعددة الـ segments (الـ transfers). بيخزن كل الـ metadata عشان يقدر يـhydrate الرحلة من جديد لما المستخدم يفتح الـ dashboard.

### الـ Mongoose Connection Strategy

```js
// server.js
async function connectDB(attempt = 1) {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    })
  } catch (err) {
    if (attempt < 3) {
      await sleep(3000)
      return connectDB(attempt + 1)  // retry
    }
    process.exit(1)  // فشل نهائي
  }
}
```

الـ retry logic مهم لأن MongoDB Atlas ممكن يكون شوية بطيء في الـ cold start.

### ليه مفيش Caching على الـ DB؟

في المشروع الحالي مفيش Redis أو in-memory cache. ده معناه كل request بيروح للـ DB. للـ production الحقيقي، `GET /api/routes/stations` مثلاً ممكن يتـcache لأنه مش بيتغير كتير.

---

## 5. Auth & Permissions

### الـ Strategy: JWT Stateless + Google OAuth

**مسؤوليتها:** التحقق من هوية المستخدم (Authentication) وتحديد صلاحياته (Authorization).

**بتتكلم مع مين؟**
- الـ Client: بيستقبل الـ tokens
- الـ DB: بيخزن الـ refresh token ويتحقق منه
- Google OAuth servers: للـ social login

### JWT (JSON Web Token) — إزاي بيشتغل؟

```
Header.Payload.Signature

{
  "alg": "HS256",
  "typ": "JWT"
}
.
{
  "userId": "64a3b...",
  "role": "user",
  "iat": 1700000000,
  "exp": 1700000900  // 15 دقيقة من الـ iat
}
.
HMACSHA256(base64(header) + "." + base64(payload), JWT_SECRET)
```

**الـ Access Token:** عمره 15 دقيقة، signed بـ `JWT_SECRET`.

**الـ Refresh Token:** عمره 7 أيام، signed بـ `JWT_REFRESH_SECRET`، متخزن في الـ DB.

**ليه refresh token ومش access token طويل فقط؟**

لو الـ access token اتسرق وعمره يومين مثلاً، الهاكر معاه 2 يوم. لو عمره 15 دقيقة، حتى لو اتسرق، بـ 15 دقيقة يبطل.

**ليه الـ refresh token متخزن في الـ DB؟**

عشان نقدر نـrevoke الـ session. لو User عمل logout، بنمسح الـ refresh token من الـ DB. حتى لو حد عنده نسخة قديمة من الـ refresh token، الـ server هيشوف إنه مش موجود في الـ DB ويرفضه.

### الـ Two-Token Pattern — التدفق الكامل

```
Register/Login:
┌─────────┐          ┌──────────┐        ┌──────────┐
│ Client  │ ────────►│ Server   │───────►│ MongoDB  │
│         │ POST     │          │ save   │          │
│         │ /login   │          │ refresh│          │
│         │          │ generate │ token  │          │
│         │◄─────────│ tokens   │◄───────│          │
│ store   │ 200 +    │          │        │          │
│ tokens  │ tokens   │          │        │          │
└─────────┘          └──────────┘        └──────────┘

Authenticated Request:
Client → Authorization: Bearer <accessToken> → Server verifies → OK

Token Expired (401):
Client → POST /refresh { refreshToken } → Server:
  1. verify signature
  2. find user in DB
  3. compare token === user.refreshToken  ← هنا الـ security
  4. generate new pair
  5. save new refresh token → return new tokens
Client → retry original request with new access token
```

### auth.middleware.js — كيف بيحمي الـ Routes

```js
const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  // Authorization: Bearer eyJ...
  //                         ↑ هنا الـ token

  if (!token) return next({ statusCode: 401, message: 'لا يوجد توكن' })

  const decoded = jwt.verify(token, process.env.JWT_SECRET)
  // لو الـ token باطل أو منتهي → throw → caught by errorMiddleware

  req.user = { userId: decoded.userId, role: decoded.role }
  next()
}
```

### requireAdmin — Row-Level Security بسيطة

```js
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next({ statusCode: 403, message: 'غير مصرح لك بهذه العملية' })
  }
  next()
}
```

**في مشروعنا فيه مستويين فقط:**
- `user` — يقدر يبحث، يقيّم، يحفظ، يسأل عم غريب
- `admin` — كل حاجة + CRUD على الخطوط + الإحصائيات

**ليه مش Role-Based Access Control (RBAC) كامل؟**

RBAC الكامل بيكون فيه جدول منفصل للـ permissions وـrelations بين roles وـpermissions. مشروعنا صغير ومحتاج مستويين فقط — enum في الـ User model كافي.

### Google OAuth 2.0 — التدفق

```
1. User يضغط "ادخل بجوجل"
        ↓
2. Client: window.location.href = '/api/auth/google'
        ↓
3. Passport يعمل redirect لـ Google consent screen
        ↓
4. User يوافق
        ↓
5. Google يعمل callback على '/api/auth/google/callback'
   مع { id, emails, displayName }
        ↓
6. Passport Strategy:
   - ابحث عن user بـ googleId  → موجود؟ رجّع
   - ابحث عن user بـ email     → موجود؟ اربط الـ googleId
   - مش موجود؟ create new user مع passwordHash: null
        ↓
7. generateTokens(userId, role)
        ↓
8. res.redirect(`${CLIENT_URL}/dashboard?token=${accessToken}`)
        ↓
9. Client AuthContext على mount:
   const oauthToken = new URLSearchParams(window.location.search).get('token')
   setTokens(oauthToken, null)  // مفيش refresh token للـ Google OAuth
   window.history.replaceState({}, '', '/dashboard')  // تنضيف الـ URL
```

**نقطة مهمة:** Google OAuth users مش عندهم `refreshToken` — لما الـ access token ينتهي (15 دقيقة) لازم يعمل login تاني.

---

## 6. Hosting & Deployment

### الوضع الحالي: Local Development / ITI Demo

المشروع ده graduation project وبالتالي مش deployed على production بشكل رسمي. بس هنتكلم عن كيف المفروض يتـdeploy.

### خيارات الـ Deployment

#### Option A: الـ Simple (للـ MVP)

```
┌──────────────────────────────────────────┐
│           Render.com / Railway           │
│                                          │
│  Web Service (Node.js + Express)         │
│  ↕ connects to                           │
│  MongoDB Atlas (free tier M0)            │
│  ↕ calls                                 │
│  OpenAI API                              │
└──────────────────────────────────────────┘

Client (React):
  Vercel أو Netlify — Static Site Hosting
```

**ليه هو المثالي للـ graduation project؟**
- Render.com free tier كافي
- Zero configuration
- Automatic deploys من GitHub

**الـ Environment Variables المطلوبة على الـ Server:**

```
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://...atlas.mongodb.net/am-ghareeb
JWT_SECRET=...
JWT_REFRESH_SECRET=...
OPENAI_API_KEY=sk-...
CLIENT_URL=https://am-ghareeb.vercel.app
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://am-ghareeb.onrender.com/api/auth/google/callback
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=...
```

**الـ Client (Vite .env.local):**

```
VITE_API_URL=https://am-ghareeb.onrender.com
```

#### Option B: الـ Production-Grade

```
┌───────────────────────────────────────────────┐
│                AWS / GCP / Azure              │
│                                               │
│  Load Balancer                                │
│       ↓                                       │
│  EC2 / Cloud Run instances (Express)          │
│  Auto-scaling based on traffic                │
│       ↓                                       │
│  MongoDB Atlas (M10+ cluster, multi-region)   │
│       ↓                                       │
│  Redis (ElastiCache) — Caching                │
└───────────────────────────────────────────────┘

Client:
  CloudFront CDN → S3 bucket (React static files)
```

### الـ Build Process

```bash
# Server: مفيش build step — Node.js بيقرأ CommonJS مباشرة
cd server && npm start

# Client: لازم build
cd client && npm run build
# ينتج → client/dist/ (HTML + CSS + JS مضغوط)
# الملفات دي بترفعهم على Vercel/Netlify/S3
```

### الـ seed Script

```bash
cd server && npm run seed
```

بيعمل:
1. يمسح كل الـ routes و admin user الموجودين
2. يحشو 10 خطوط حقيقية إسكندرانية
3. ينشئ admin user من الـ env variables

---

## 7. Cloud & Computing

### الوضع الحالي: External Cloud Services

```
مشروعنا (Code)
      │
      ├── MongoDB Atlas ──── Cloud Database (MongoDB Inc.)
      │                      Free tier: 512MB
      │
      ├── OpenAI API ──────── Cloud AI (OpenAI)
      │                       gpt-4o-mini
      │
      └── (Future) Vercel ─── Static hosting
          + Render.com ────── Node.js hosting
```

### MongoDB Atlas

**الـ Free Tier (M0):**
- 512MB storage
- Shared cluster (بتشاركه مع ناس تانية)
- No dedicated RAM
- مناسب للـ development والـ demo

**الـ M10+ (الـ Production):**
- Dedicated cluster
- Auto-scaling
- Multi-region replication
- Point-in-time recovery

**OSRM Service:**

في `server/src/services/osrm.service.js` فيه integration مع OSRM (Open Source Routing Machine) لحساب الـ path بين الـ waypoints. ده external service للـ routing.

### OpenAI API

```js
// في ai.service.js
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const stream = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  stream: true,
  temperature: 0.7,
  max_tokens: 600,
  messages: [...]
})
```

**gpt-4o-mini اتاخد ليه؟**
- أرخص من gpt-4o (الفرق كبير في السعر)
- كافي للـ transit advice اللي مش محتاجة complex reasoning
- سريع — مناسب للـ streaming

**الـ Tokens:**
- `max_tokens: 600` — الـ response المصري مش بيكون طويل
- `temperature: 0.7` — شوية creativity للـ persona، مش صفر تماماً (روبوتي)

---

## 8. Version Control & CI/CD

### الوضع الحالي: Git + GitHub

المشروع على GitHub. مفيش CI/CD pipeline رسمي لكن المفروض يكون فيه.

### الـ .gitignore الأساسي

```
node_modules/
.env
.env.local
dist/
*.log
```

**لازم مش تـcommit:**
- `.env` (فيه secrets)
- `node_modules/` (كبير جداً)

### CI/CD المقترح للـ Graduation Project

**CI = Continuous Integration:** كل commit بيشغّل الـ tests تلقائياً.

**CD = Continuous Deployment:** لو الـ tests عدت، بيـdeploy تلقائي.

```yaml
# .github/workflows/ci.yml (مقترح)
name: Test & Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: cd server && npm ci
      - name: Run tests
        run: cd server && npm test
        env:
          NODE_ENV: test

  deploy:
    needs: test  # بيشتغل بس لو test عدت
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Render
        run: curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}
```

**الـ Flow:**
```
git push origin main
        ↓
GitHub Actions: npm test (67 tests)
        ↓
لو كلها عدت → Deploy to Render.com
        ↓
Render بيسحب الـ code الجديد ويعمل restart
```

### الـ Branching Strategy المقترحة

```
main ─────────────────────────────── Production
  │
  └─ feature/admin-panel ──── تطوير Admin page
  └─ fix/auth-refresh-bug ─── إصلاح bug في الـ refresh
  └─ feature/map-clustering ─ تطوير جديد على الـ Map
```

---

## 9. Security & Row-Level Security

### الطبقات الأمنية في المشروع

#### Layer 1: HTTP Security Headers (Helmet)

```js
app.use(helmet())
```

`helmet` بيضيف headers مهمة تلقائياً:

| Header | الوظيفة |
|--------|---------|
| `X-Content-Type-Options: nosniff` | يمنع المتصفح من تخمين الـ content type |
| `X-Frame-Options: SAMEORIGIN` | يمنع الموقع يتحط في iframe في موقع تاني |
| `Strict-Transport-Security` | يجبر HTTPS |
| `Content-Security-Policy` | يحدد من فين ممكن يجي scripts |
| `X-XSS-Protection` | حماية من XSS في المتصفحات القديمة |

#### Layer 2: CORS (Cross-Origin Resource Sharing)

```js
app.use(cors({
  origin: process.env.CLIENT_URL,  // مثلاً 'https://am-ghareeb.vercel.app'
  credentials: true,
}))
```

بيحدد إن الـ API يقبل requests بس من الـ CLIENT_URL — أي domain تاني هيتـblock.

#### Layer 3: Rate Limiting

راجع Section 12 للتفاصيل.

#### Layer 4: Input Validation (Joi)

```js
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[A-Z])(?=.*\d)/)
    .required(),
})
```

الـ Joi بيتحقق من كل input قبل ما يوصل للـ service. أي input غلطة بترجع 400 بـ Arabic error message.

#### Layer 5: MongoDB Injection Prevention

**Mongoose بيحمي تلقائياً** من MongoDB injection. بيعمل sanitize للـ queries.

مثال: لو حد بعت `{ "$gt": "" }` كـ email، Mongoose مش هيعتبره query operator.

#### Layer 6: Password Security

```js
// bcryptjs cost factor 12
this.passwordHash = await bcrypt.hash(this.passwordHash, 12)
```

**Cost factor 12** معناه الـ hashing بياخد ~500ms. ده مقصود — بيخلي الـ brute force attacks بطيئة جداً.

**User Enumeration Prevention:**

```js
// auth.service.js — نفس الـ error message للحالتين
if (!user || !(await user.comparePassword(password))) {
  throw { statusCode: 401, message: 'بيانات غير صحيحة' }
}
```

لو قلت "الإيميل مش موجود" الهاكر يعرف إن الإيميل ده مش مسجل. نفس الـ message للحالتين.

#### Layer 7: JWT Security

- **Short-lived access tokens (15 min):** يقلل نافذة السرقة
- **Refresh token rotation:** كل مرة تعمل refresh، بيولّد token جديد ويبطل القديم
- **Server-side refresh token storage:** نقدر نـrevoke أي session
- **Separate secrets:** `JWT_SECRET` ≠ `JWT_REFRESH_SECRET`

#### Row-Level Security

**في مشروعنا RLS بسيطة جداً:**

```js
// routes.service.js — كل user يشوف بس بياناته
const history = await SearchHistory.find({ user: userId })
// مش .find({}) — بتفلتر بالـ userId من الـ JWT
```

```js
// User لازم يكون هو نفسه اللي عمل الـ rating
await Rating.create({
  user: req.user.userId,  // من الـ JWT — مش من الـ body
  route: route._id,
  isAccurate
})
```

**Admin-only resources:**

```js
router.get('/stats', protect, requireAdmin, ...)
router.post('/', protect, requireAdmin, ...)
```

**مفيش الـ data من الـ users التانيين متاحة لـ regular users.**

---

## 10. Unit Testing & Jest

### الـ Stack

```
Jest 29.7.0              — test runner + assertion library
Supertest 6.3.4          — HTTP integration testing
mongodb-memory-server    — in-memory MongoDB (مفيش real DB)
@babel/preset-env        — transpile ES modules لـ Jest
```

### ليه Jest؟

| Feature | Jest | Mocha + Chai | Vitest |
|---------|------|-------------|--------|
| Zero config | ✅ | ❌ | ✅ |
| Built-in assertions | ✅ | ❌ | ✅ |
| Snapshot testing | ✅ | ❌ | ✅ |
| Mocking | ✅ | manual | ✅ |
| MERN ecosystem | شائع جداً | شائع | للـ frontend |

### ليه mongodb-memory-server؟

بدل ما نتصل بـ real MongoDB Atlas في كل test run:
- **سرعة:** الـ in-memory أسرع بكتير
- **Isolation:** كل test بيبدأ بـ DB نظيفة
- **No cost:** مش بيستهلك DB credits
- **CI/CD friendly:** يشتغل في أي environment بدون config

### الـ Test Pattern الأساسي

```js
// server/src/tests/auth.test.js

let mongoServer
let app

beforeAll(async () => {
  // ينشئ MongoDB في الـ memory
  mongoServer = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongoServer.getUri()
  
  // يتصل بيه
  await mongoose.connect(mongoServer.getUri())
  
  // يحمّل الـ Express app
  app = require('../../app')
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  // ينضف كل الـ collections قبل كل test
  await User.deleteMany({})
  await Route.deleteMany({})
})

// ── الـ Tests ───────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('يسجل مستخدم جديد بنجاح', async () => {
    const response = await supertest(app)
      .post('/api/auth/register')
      .send({
        name: 'محمود عوض',
        email: 'mahmoud@test.com',
        password: 'Password123'
      })
    
    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
    expect(response.body.accessToken).toBeDefined()
    expect(response.body.user.passwordHash).toBeUndefined()  // مش مفروض يتبعت
  })

  it('يرفض إيميل مكرر بـ 409', async () => {
    // ينشئ المستخدم أول مرة
    await User.create({ name: 'Test', email: 'dup@test.com', passwordHash: '...' })
    
    // يجرب ينشئه تاني
    const response = await supertest(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'dup@test.com', password: 'Password123' })
    
    expect(response.status).toBe(409)
  })
})
```

### الـ Test Suites والـ Coverage

| Suite | Tests | ما بيغطيه |
|-------|-------|----------|
| `models.test.js` | 19 | Schema validation، hooks، static methods، indexes |
| `auth.test.js` | 13 | Register، login، refresh، logout، Google OAuth |
| `routes.test.js` | 11 | Search، stations، save/unsave، history |
| `rating.test.js` | 8 | Submit، duplicate prevention، stats |
| `admin.test.js` | 9 | CRUD، soft-delete، stats، permissions |
| `ai.test.js` | 7 | SSE stream، validation، error format |
| **Total** | **67** | كل الـ 22 endpoints |

### تشغيل الـ Tests

```bash
cd server

# تشغيل كل الـ tests
npm test

# تشغيل suite معينة
npx jest auth.test.js

# مع coverage report
npx jest --coverage

# في watch mode (بيعيد التشغيل عند تغيير ملف)
npx jest --watch
```

**ليه `--runInBand`؟**

الـ flag ده في `jest.config.js` بيخلي الـ test suites تشتغل واحدة واحدة (sequential) مش parallel. لو اشتغلوا parallel، كل suite هتحاول تعمل `MongoMemoryServer.create()` في نفس الوقت وهيحصل port conflicts.

### SSE Testing Challenge

اختبار الـ SSE أصعب من REST لأن الـ response مش JSON عادي:

```js
// ai.test.js
it('يرجع content-type text/event-stream', async () => {
  const response = await supertest(app)
    .post('/api/ai/ask')
    .set('Authorization', `Bearer ${token}`)
    .send({ origin: 'محطة الرمل', destination: 'سيدي بشر', message: 'إيه السعر؟' })
  
  expect(response.headers['content-type']).toMatch(/text\/event-stream/)
  expect(response.text).toContain('data: [DONE]')
})
```

---

## 11. RAG & AI Pipeline

### RAG = Retrieval-Augmented Generation

بدل ما نعتمد على ChatGPT الـ general knowledge (اللي ممكن يكذب أو يختلق معلومات)، بنجيب البيانات الحقيقية من الـ DB ونحطها قدام الـ model.

```
User Question
      │
      ▼
Step 1: Retrieve — MongoDB Query
  بحث بـ origin + destination في database
      │
      ▼
Step 2: Build Context — Arabic Text
  تحويل الـ routes لـ نص عربي منظم
      │
      ▼
Step 3: Augment — System Prompt + Context
  حقن البيانات في الـ prompt مع الـ persona
      │
      ▼
Step 4: Generate — GPT-4o-mini Stream
  الـ model يجاوب بناءً على البيانات دي بس
      │
      ▼
Step 5: Stream — SSE to Client
  كل chunk يتبعت للـ browser فور ما بيجي
```

### الـ Prompt Engineering

```js
// promptBuilder.js
function buildSystemPrompt(context) {
  return `أنت عم غريب، راجل إسكندراني عجوز حكيم لابس جلابية بيضاء وطربوش...

بتتكلم بالعامية المصرية الإسكندرانية دايماً — مش فصحى، مش عامية قاهرية.
بتنادي الناس بـ "يا فنان" أو "أحيه" — مش "يا باشا".
بتستخدم "بحر" يعني شمال والبحر، و"جوه" يعني جنوب...

قواعد صارمة:
١. رد فقط من المعلومات الموجودة في السياق.
   لو مش موجودة قول: "والله يا عم معنديش معلومة دقيقة..."
٢. لا تخترع محطة أو تعريفة أبداً.
٣. لو حد قالك إن السواق طلب أكتر من التعريفة قوله يتصل على 114
٤. نبّه على تكتيك "تقطيع المسافات"...
٥. جمل قصيرة وعملية فقط.

السياق من قاعدة البيانات:
${context}`
}
```

**ليه هذا التصميم؟**

| قرار | السبب |
|------|-------|
| Persona محددة (عم غريب) | بتجعل الـ responses أكثر engagement وأقل robotics |
| "رد فقط من السياق" | يمنع الـ hallucination — مش هيخترع خطوط وهمية |
| قواعد المستهلك (114) | حماية المستخدم من السائقين المحتالين |
| جمل قصيرة | المستخدم بيسأل وهو في الشارع — مش محتاج essay |

### SSE (Server-Sent Events) — ليه مش WebSocket؟

**WebSocket:** two-way connection. المستخدم يبعت، السيرفر يرد.

**SSE:** one-way من السيرفر للـ client. المستخدم بعت مرة، السيرفر بيبعت continuous stream.

للـ AI chat — الـ interaction هي: user يبعت سؤال → server يـstream الرد. مفيش حاجة تحتاج two-way communication. SSE أسهل وأخف من WebSocket.

```
Server                      Client
  │                            │
  │ ← POST /api/ai/ask ────────│
  │                            │
  │ SSE headers flushed        │
  │                            │
  │ data: {"text":"أيه"}  ─────►│
  │ data: {"text":" الأخبار"}  ►│
  │ data: {"text":"؟"}    ─────►│
  │ data: [DONE]          ─────►│
  │                            │
```

### الـ Context Building — إزاي بنحوّل الـ Routes لـ نص

```js
// لو route مباشرة:
`خط: المنشية - سيدي بشر
محطات: المنشية ← محطة الرمل ← القبة ← سيدي بشر
تعريفة: 3–5 جنيه
أوقات الذروة: 8:00-9:00, 17:00-18:00
نصائح: اسأل السواق قبل ما تطلع`

// لو transfer:
`رحلة بعدد 1 تحويلة
الركوبة 1: المنشية - محطة الرمل
من: المنشية إلى: محطة الرمل
التحويل 1: انزل في محطة الرمل ثم امشِ إلى الموقف الجنوبي (150 متر)
الركوبة 2: محطة الرمل - سيدي بشر
إجمالي التعريفة: 6–10 جنيه`
```

### الـ Hallucination Prevention

**المشكلة:** GPT-4o-mini لو سألته عن خط في الإسكندرية ممكن يخترع محطات.

**الحل:** 
1. Rule واضحة في الـ system prompt: "رد فقط من المعلومات الموجودة في السياق"
2. لو مفيش context (مش لاقي خطوط): `context = 'لم يتم العثور على بيانات لهذا المسار'`
3. الـ model اتدرّب يقول "مش عارف" في الحالة دي

---

## 12. Rate Limiting

### ليه Rate Limiting؟

بدون rate limiting:
- حد يقدر يعمل flood للـ AI endpoint — يكلفك فلوس OpenAI كتير
- Brute force attacks على login
- DoS attacks عموماً

### الـ Implementation: express-rate-limit

```js
const rateLimit = require('express-rate-limit')
```

### الـ Three Limiters

#### authLimiter — Login/Register

```js
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 دقيقة
  max: 10,                    // 10 محاولات
  // key: IP address (default)
})
```

**لماذا 10 فقط؟** Brute force على password بيحتاج آلاف المحاولات. 10 محاولات كافية للاستخدام العادي.

#### apiLimiter — عام

```js
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 دقيقة
  max: 100,                   // 100 request
})
```

**لماذا 100؟** المستخدم العادي بيعمل بحثات — 100 في 15 دقيقة أكتر من كافي.

#### aiLimiter — الـ AI Chat

```js
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // ساعة
  max: 20,                    // 20 سؤال
  keyGenerator: (req) => req.user?.userId || req.ip,
  // بيـlimit بالـ userId مش بالـ IP
})
```

**لماذا userId وليس IP؟**

لو بـ IP — أسرة كاملة بيستخدموا نفس الـ IP (router) هيتـlimit مع بعض.

لو بـ userId — كل user معاه quota منفصل.

**ليه 20 فقط؟** كل request بتكلف tokens في OpenAI. 20 سؤال في الساعة كافي لأي مستخدم حقيقي، وبيحمي من abuse.

### الـ Test Environment Override

```js
const isTestEnv = process.env.NODE_ENV === 'test'

max: isTestEnv ? 1000 : 10,
```

لو كنا في test environment، الـ limits بترفع عالياً عشان الـ tests مش تفشل بسبب الـ rate limiting.

### الـ Headers المضافة

مع `standardHeaders: true`، كل response بيجي معاه:
```
RateLimit-Limit: 20
RateLimit-Remaining: 17
RateLimit-Reset: 1700003600
```

الـ client ممكن يستخدم دي يعرض لـ user "معاه كام سؤال باقي".

---

## 13. Caching & CDN

### الوضع الحالي: مفيش Caching رسمي

المشروع مش فيه Redis أو CDN كـ explicit layer. بس فيه caching في مستويات مختلفة:

### Level 1: react-query Client Cache

```js
const { data: stationsData } = useQuery({
  queryKey: ['stations'],
  queryFn: () => api.get('/api/routes/stations').then(r => r.data.stations),
  staleTime: Infinity,  // مش هيعمل refetch أبداً
})
```

`staleTime: Infinity` معناه الـ stations بتتحمل مرة واحدة وتتخزن في memory لطول الـ session. مناسب لأن الـ stations مش بتتغير كتير.

**Cache Invalidation:**

```js
// بعد إضافة route جديد في AdminPage:
queryClient.invalidateQueries(['stations'])
// الـ query هتعمل refetch automatically
```

### Level 2: HTTP Browser Cache

Express بيرجع response بدون explicit cache headers. لو أضفنا:

```js
// مثال — مش موجود في الكود الحالي
router.get('/stations', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600') // ساعة
  // ...
})
```

المتصفح كان هيخزن الـ stations لساعة ومش هيبعت request.

### Level 3: CDN (مقترح للـ Production)

```
User Request
      │
      ▼
CDN Edge (CloudFront/Vercel Edge)
      │ Hit? → serve from cache (fast)
      │ Miss? ↓
      ▼
Origin Server (Express/React Build)
```

**الـ React Build (Static Files):**

لو على Vercel/Netlify — بيستخدموا CDN تلقائياً. الـ JS/CSS/HTML files بيتخزنوا على edge servers حول العالم.

**الـ API:**

الـ dynamic API مش ممكن يتـcache بنفس الطريقة (مختلف لكل user). بس static endpoints زي `/api/routes/stations` ممكن يتـcache.

### Level 4: Redis (مقترح للـ Scale)

```
Client → Express → Redis →  Hit: return from cache
                          → Miss: MongoDB → save in Redis → return
```

```js
// مثال مقترح
const cached = await redis.get(`stations`)
if (cached) return res.json(JSON.parse(cached))

const stations = await getStations()
await redis.setex('stations', 3600, JSON.stringify(stations)) // يخزن ساعة
res.json(stations)
```

---

## 14. Error Tracking & Logs

### الوضع الحالي: Console Logging

المشروع بيستخدم:
1. `morgan('dev')` — HTTP request logging
2. `console.error()` في `errorMiddleware`

### Morgan — HTTP Request Logger

```js
app.use(morgan('dev'))
```

Output مثلاً:
```
POST /api/auth/login 200 23.456 ms - 234
GET /api/routes/search?origin=الرمل 200 156.789 ms - 1024
POST /api/ai/ask - - ms - -  ← SSE streams مش بيظهر الـ size
```

**الـ 'dev' format:** `METHOD URL STATUS RESPONSE_TIME SIZE`

**Formats تانية:**
- `'combined'` — Apache standard format مع IP وـuser agent
- `'tiny'` — أصغر
- Custom format ممكن

### errorMiddleware — Error Logging

```js
const errorMiddleware = (err, req, res, next) => {
  const timestamp = new Date().toISOString()
  console.error(`[${timestamp}] ${req.method} ${req.path} ${status} — ${err.message}`)
  
  // في development فقط: بيضيف الـ stack trace في الـ response
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack
  }
}
```

### ما ينقص: Error Tracking Platform

**للـ Production الحقيقية:**

#### Sentry (الـ أشهر)

```js
// npm install @sentry/node
const Sentry = require('@sentry/node')
Sentry.init({ dsn: process.env.SENTRY_DSN })
app.use(Sentry.Handlers.requestHandler())
// ... routes ...
app.use(Sentry.Handlers.errorHandler())  // قبل errorMiddleware
```

**بيوفر:**
- Alert فوري لما error بيحصل
- Stack trace كامل مع context
- User info اللي عمل الـ error
- Error frequency وـtrends
- Release tracking (أي deployment جاب الـ bug)

#### الـ Structured Logging (Winston)

```js
// بدل console.error:
const logger = winston.createLogger({
  format: winston.format.json(),  // JSON format سهل تحليله
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' })
  ]
})

logger.error('Auth failed', {
  userId: req.user?.userId,
  endpoint: req.path,
  error: err.message,
  timestamp: new Date().toISOString()
})
```

---

## 15. Availability & Recovery

### الوضع الحالي: Basic Resilience

#### Server Restart Recovery

```js
// server.js
process.on('uncaughtException', (err) => {
  console.error('خطأ غير متوقع:', err.message)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('وعد مرفوض:', reason)
  process.exit(1)
})
```

لو error غير متوقع حصل، الـ process بيعمل exit بدل ما يفضل شغال في حالة unknown.

#### DB Connection Retry

```js
async function connectDB(attempt = 1) {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    })
  } catch (err) {
    if (attempt < 3) {
      await sleep(3000)
      return connectDB(attempt + 1)
    }
    process.exit(1)
  }
}
```

3 محاولات، 3 ثواني بين كل محاولة. لو MongoDB Atlas كان slow في الـ start، الـ server بيصبر.

#### SSE Error Recovery

```js
// ai.service.js
try {
  // ... RAG pipeline ...
} catch (err) {
  // لو الـ SSE headers اتبعتوا بالفعل، مش نقدر نبعت HTTP 500
  // بنبعت الـ error كـ SSE event
  res.write(`data: ${JSON.stringify({ error: 'حدث خطأ، حاول مرة تانية' })}\n\n`)
  res.end()
}
```

**ليه ده مهم؟**

لو الـ error handler حاول يعمل `res.status(500).json(...)` بعد ما الـ SSE headers اتفلتوا، هيحصل error تاني لأنك مش تقدر تغير الـ headers بعد ما اتبعتوا. الحل: بعت الـ error كـ SSE event.

### ما ينقص للـ Production

#### Health Check Endpoint

```js
// مقترح
app.get('/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'ok' : 'error'
  res.json({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    db: dbStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})
```

Render.com و Kubernetes بيعملوا ping لـ `/health` بشكل منتظم عشان يعرفوا الـ app شغال.

#### Process Manager (PM2)

```bash
# بدل node server.js:
pm2 start server.js --name "am-ghareeb" --restart-delay=1000

# لو الـ process مات: PM2 بيعيد تشغيله
# Cluster mode: يشغّل instance على كل CPU core
pm2 start server.js -i max
```

#### Graceful Shutdown

```js
// مقترح — مش موجود في الكود الحالي
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...')
  
  // امنع requests جديدة
  server.close(async () => {
    // أكمّل الـ requests الموجودة
    await mongoose.connection.close()
    process.exit(0)
  })
})
```

لما Render/Docker بيعمل restart، بيبعت `SIGTERM`. الـ graceful shutdown بيخلي الـ app يكمّل الـ requests الـ in-flight قبل ما يتوقف.

#### MongoDB Atlas Availability

**الـ Atlas Free Tier (M0):**
- مفيش SLA (Service Level Agreement)
- Shared infrastructure
- ممكن يكون downtime

**الـ Atlas M10+ (Production):**
- 99.95% uptime SLA
- Multi-AZ replication (نسخ في أكتر من data center)
- Automated backups
- Point-in-time recovery (ترجع لأي لحظة في الـ 7 أيام الأخيرة)

---

---

## 16. Architectural Decision Records (ADR)

> **"The code tells you WHAT. This section tells you WHY."**
>
> كل قرار هنا اتاخد في سياق معين، ليه بدايل واضحة، وليه اتستبعد.
> الهدف إنك لما تيجي تعدّل أو تتسع، تعرف إيه الـ constraints اللي خلّت الكود يبقى بالشكل ده.

---

### ADR-01 — ليه Monolithic وليه مش Microservices؟

**القرار:** تطبيق واحد (Monolith) مقسّم داخلياً بـ MVC layers.

**السياق:** مشروع graduation project، team صغيرة (1-2 أشخاص)، timeline محدود، الـ features واضحة ومش هتتغير جذرياً.

**البدايل اللي اتفكرنا فيها:**

| Option | المميزات | ليه اترفض |
|--------|----------|-----------|
| **Monolith (اخترنا)** | Deploy واحد، debugging بسيط، shared memory | تقدر تـscale بعدين |
| Microservices | كل service تـscale منفردة | Overhead ضخم: service discovery، inter-service auth، distributed tracing، مش مناسب لـ team صغيرة |
| Serverless Functions | Pay-per-request، zero infrastructure | Cold starts قاتلة للـ SSE streaming — الـ AI endpoint ممكن ياخد 10-30 ثانية، الـ serverless function هتـtimeout |

**ليه Monolith كان الصح:**
- الـ services عندنا محتاجة تتكلم مع بعض بسرعة (routes.service → ai.service → MongoDB) — في monolith ده function call، في microservices ده HTTP call بـ latency إضافي
- الـ SSE streaming بيحتاج connection مفتوح — الـ monolith يتعامل معاه بشكل طبيعي
- الـ ITI demo environment مش بيتحمل orchestration زي Kubernetes

**متى تراجع القرار ده؟** لو المستخدمين وصلوا 10k+ concurrent و الـ AI endpoint بيأثر على الـ search performance — وقتها تفصل الـ AI service.

---

### ADR-02 — ليه MongoDB وليه مش PostgreSQL؟

**القرار:** MongoDB Atlas مع Mongoose ODM.

**السياق:** بيانات الـ routes ليها structure متغير (بعض الخطوط عندها waypoints، بعضها لأ، بعضها عندها peakHours، بعضها لأ). الـ stops عبارة عن array of objects embedded جوه الـ route نفسه.

**البدايل:**

| Option | المميزات | ليه اترفض |
|--------|----------|-----------|
| **MongoDB (اخترنا)** | Embedded documents طبيعية، 2dsphere built-in، JSON-native | مفيش ACID transactions قوية زي Postgres |
| PostgreSQL + PostGIS | ACID كامل، powerful queries | الـ stops كانت هتبقى table منفصلة → JOIN في كل query بحث، وكل تغيير في schema يحتاج migration |
| PostgreSQL (بدون PostGIS) | Simple، مألوف | الـ geospatial queries (nearest stop) هتبقى manual حسابات |
| Firebase Firestore | Realtime، No backend needed | مش مفيد للـ BFS search اللي بيحتاج complex queries، وـpricelist غير متوقعة |

**القرار الحاسم:** بيانات الـ route مش tabular — هي document. خط واحد = document واحد فيه كل حاجة (stops, geometry, fare, tips, operating hours). استخراجه query واحدة. في PostgreSQL كانت هتبقى 5 tables وـ4 JOINs لنفس العملية.

**مثال concrete:**

```js
// MongoDB: استخراج خط مع كل محطاته وإحداثياتهم
const route = await Route.findById(id)
  .populate('stops.location', 'nameAr nameEn location.coordinates')

// PostgreSQL equivalent:
// SELECT r.*, s.order, l.name_ar, l.name_en, ST_AsGeoJSON(l.coords)
// FROM routes r
// JOIN route_stops s ON r.id = s.route_id
// JOIN locations l ON s.location_id = l.id
// WHERE r.id = $1
// ORDER BY s.order ASC
```

**Trade-off مقبول:** فقدنا الـ multi-document ACID transactions الكاملة. لكن عمليات الـ write عندنا (save route, submit rating) هي single-document operations — مش محتاجين transactions.

---

### ADR-03 — ليه انفصلنا Controllers عن Services؟

**القرار:** كل الـ business logic في `*.service.js`، الـ controllers مجرد HTTP adapters.

**السياق:** كان ممكن نكتب كل حاجة في الـ controller زي كتير من الـ MERN tutorials بتعمل.

**المشكلة لو حطينا الـ logic في الـ controller:**

```js
// ❌ الطريقة الـ naive — كل حاجة في controller
const searchRoutes = async (req, res) => {
  // validation
  // DB queries (50 سطر)
  // BFS algorithm (100 سطر)
  // formatting (50 سطر)
  // error handling
  res.json(result)
}
// مش تقدر تـtest الـ business logic بدون HTTP layer
// supertest.get('/api/routes/search') لكل test
```

```js
// ✅ الطريقة اللي اخترناها
// controller.js — 10 سطر
const search = async (req, res, next) => {
  try {
    const result = await routesService.searchRoutes(
      req.query.origin, req.query.destination, req.user?.userId
    )
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

// routes.service.js — 200 سطر من pure logic
// يتـtest بـ:
const result = await routesService.searchRoutes('الرمل', 'سيدي بشر', null)
// مش محتاج HTTP server ولا supertest
```

**الفايدة الحقيقية:** الـ 67 test عندنا — الـ service tests أسرع بـ 10x من الـ integration tests لأنها بتشتغل بدون HTTP layer.

---

### ADR-04 — ليه JWT وليه مش Sessions؟

**القرار:** Stateless JWT (access + refresh pair) بدلاً من server-side sessions.

**البدايل:**

| Option | كيف بيشتغل | ليه اترفض/اتختار |
|--------|-----------|-----------------|
| **JWT (اخترنا)** | Token في localStorage، Server ما بيخزنش session state | Stateless → سهل تـscale (أي server instance يقدر يـverify) |
| Express-session + MongoDB | Session ID في cookie، Server بيخزن session في DB | كل request يعمل DB query للـ session → latency إضافي |
| Redis Sessions | Session في Redis (سريع جداً) | يضيف Redis كـ dependency — overhead مش محتاجينه |

**ليه Stateless مهم؟**

لو عندك 3 server instances وراء load balancer:
- **Sessions:** Request 1 وصل لـ Server A وخزن session فيه. Request 2 وصل لـ Server B → مش لاقي الـ session → logout! (لازم sticky sessions أو shared session store)
- **JWT:** كل server instance بيـverify الـ token بنفسه بـ `JWT_SECRET` — مفيش shared state

**Trade-off:** JWT مش ممكن تـrevoke قبل انتهاء الـ expiry (إلا لو عندك blacklist). عشان كده عملنا:
- Access token عمره 15 دقيقة فقط (نافذة السرقة صغيرة)
- Refresh token متخزن في DB → ممكن نمسحه = logout حقيقي

---

### ADR-05 — ليه Dual-Token وليه مش Token واحد طويل؟

**القرار:** Access token (15 دقيقة) + Refresh token (7 أيام).

**المشكلة اللي حلّها:**

```
Token طويل (7 أيام):
  → لو اتسرق: الهاكر معاه 7 أيام
  → مش ممكن تـrevoke (JWT stateless)
  → الـ user مش هيعرف حصله حاجة

Token قصير جداً (5 دقايق):
  → كل 5 دقايق الـ user يعمل re-login
  → UX كارثي

الحل: Token قصير + طريقة تجدده automatically
  Access (15 دقيقة) + Refresh (7 أيام في DB)
  → لو access اتسرق: زوال في 15 دقيقة
  → لو refresh اتسرق: نقدر نمسحه من DB
  → UX مريح: الـ user مش بيحس بـ re-login
```

---

### ADR-06 — ليه SSE وليه مش WebSocket للـ AI Streaming؟

**القرار:** Server-Sent Events (SSE) عبر `res.write()` و `fetch()` ReadableStream.

**البدايل:**

| Option | الـ Protocol | ليه اترفض/اتختار |
|--------|-------------|-----------------|
| **SSE (اخترنا)** | HTTP/1.1 one-way stream | بسيط، نفس HTTP middleware، مدعوم في كل browser |
| WebSocket | TCP two-way persistent | يحتاج `ws` library وـ upgrade protocol — overhead مش محتاجه |
| Polling | HTTP request كل X ثواني | بطيء، مش real-time، بيحمّل الـ server بـ unnecessary requests |
| Long Polling | HTTP request مفتوح لحد ما في response | أصعب في التنفيذ، مش standard |

**ليه SSE كان الصح للـ use case ده:**

الـ AI chat interaction هي: User بيبعت سؤال **مرة واحدة** ← Server بيـstream الرد.

مفيش حاجة للـ two-way real-time — الـ user مش بيبعت messages وهو بيقرأ. لو كنا بنعمل collaborative whiteboard أو multiplayer game، وقتها WebSocket كان الصح.

**مشكلة practical:** OpenAI SDK بيرجع `AsyncIterable` — كل chunk بيجي كـ JavaScript async iteration. الـ SSE بيتناسب مع ده بشكل طبيعي:

```js
for await (const chunk of stream) {
  const text = chunk.choices[0]?.delta?.content || ''
  res.write(`data: ${JSON.stringify({ text })}\n\n`)
}
```

---

### ADR-07 — ليه gpt-4o-mini وليه مش gpt-4o أو غيره؟

**القرار:** `gpt-4o-mini` كـ LLM للـ AI persona.

**السياق:** المشروع بيحتاج model يجاوب على أسئلة transit محددة بناءً على context موجود — مش محتاج complex reasoning.

**البدايل:**

| Model | القوة | التكلفة (per 1M tokens) | ليه اترفض/اتختار |
|-------|-------|------------------------|-----------------|
| **gpt-4o-mini (اخترنا)** | كافي للـ RAG transit Q&A | $0.15 input / $0.60 output | رخيص + سريع + كافي |
| gpt-4o | أقوى بكتير | $5 input / $15 output | 33x أغلى — مش مبرر للـ use case |
| gpt-4-turbo | قوي | $10 input / $30 output | 66x أغلى — overkill |
| Claude claude-haiku-4-5 | سريع جداً | رخيص | مش في الـ OpenAI SDK الـ standard اللي اخترناه |
| Gemini Flash | سريع ورخيص | رخيص | API مختلفة، يحتاج integration تانية |
| Local LLM (Ollama) | مجاني بعد الـ setup | hardware cost | يحتاج GPU — مش متاح في الـ deployment environment |

**القرار الحاسم:** الـ task عندنا هو **RAG retrieval + persona roleplay** — مش mathematical reasoning أو code generation. الـ context بيجيله structured Arabic text عن خطوط المواصلات، وهو المفروض يـrephrase الكلام بـ Alexandrian dialect.

gpt-4o-mini بيعمل ده بكفاءة 100%. استخدام gpt-4o كان هيضاعف التكلفة من غير فايدة واضحة.

**الـ temperature: 0.7 — ليه؟**

```
temperature = 0:   الرد ثابت ومتوقع تماماً (robotic)
temperature = 0.7: شوية تنوع في الأسلوب (human-like)
temperature = 1.0: إبداعي أوي، ممكن يخرج عن الموضوع
```

الـ 0.7 بيخلي "عم غريب" يرد بأساليب مختلفة شوية على نفس السؤال — مش copy-paste نفس الجملة كل مرة.

**max_tokens: 600 — ليه؟**

المستخدم بيسأل وهو واقف في الشارع. رد من 600 token = ~450 كلمة عربية = 3-4 جمل عملية. لو حطينا 2000 token الـ user هيقرأ رواية وهو لازم يمشي.

---

### ADR-08 — ليه RAG وليه مش Fine-tuning؟

**القرار:** Retrieval-Augmented Generation (RAG) بدلاً من fine-tuning الـ model على بيانات الإسكندرية.

**البدايل:**

| Approach | كيف بيشتغل | ليه اترفض/اتختار |
|----------|-----------|-----------------|
| **RAG (اخترنا)** | جيب البيانات من DB في runtime وحطها في الـ prompt | البيانات ممكن تتحدث في أي وقت بدون re-training |
| Fine-tuning | ادرب الـ model على بيانات الخطوط | لو خط اتغير لازم تـretrain — مكلف وبطيء |
| Pure Prompt Engineering | حط كل الخطوط في الـ system prompt | 10 خطوط × بيانات كل خط = 50,000+ token في كل request = مكلف جداً |

**المزية الكبيرة للـ RAG:**

```
Admin يضيف خط جديد في MongoDB
           ↓
الخط متاح فوراً للـ AI بدون أي تغيير في الكود
           ↓
المستخدم يسأل عنه → بيتـretrieve ويتحط في الـ context
```

لو كنا اخترنا fine-tuning: كل إضافة خط جديد = cycle تدريب جديد (ساعات + دولارات).

**الـ RAG limitation عندنا:**

الـ retrieval بتاعنا بسيط — MongoDB text search. مش vector search. لو عدد الخطوط وصل 1000+، الـ semantic search (Pinecone, pgvector) هيكون أدق من الـ keyword match. لكن للـ 50-100 خط الحاليين، الـ MongoDB text index كافي.

---

### ADR-09 — ليه BFS للـ Route Search وليه مش Dijkstra أو A*؟

**القرار:** BFS-style search بـ state machine لـ multi-segment trip planning.

**السياق:** المستخدم بيدخل origin وـdestination بالاسم (مش إحداثيات). الـ search بيحتاج يلاقي خط مباشر أو مسار بـ transfers.

**البدايل:**

| Algorithm | مناسب لـ | ليه اترفض/اتختار |
|-----------|---------|-----------------|
| **BFS-style (اخترنا)** | عدد محدود من الـ transfers (1-5) | بسيط، واضح، يقف بدري |
| Dijkstra | الـ shortest path في weighted graph | يحتاج graph كامل في memory + edge weights دقيقة (وقت، مسافة، تعريفة) — بيانات مش متوفرة بالدقة دي |
| A* | Dijkstra مع heuristic للسرعة | نفس متطلبات Dijkstra + الـ heuristic محتاج geospatial distance الحقيقية |
| Google Maps API | الأدق | مدفوع + مش بيعرف خطوط الميكروباص الغير رسمية |

**ليه BFS كان الصح:**

شبكة الخطوط عندنا صغيرة (50-100 خط). الـ BFS بيجرب كل التركيبات الممكنة بـ 1 segment، لو مش لاقي يجرب 2، وهكذا. بياخد نتيجة في milliseconds.

الـ Dijkstra يفيد لما يكون عندك graph حقيقي فيه edge weights دقيقة (وقت السفر بالدقيقة). بياناتنا الحالية عندها fare range وـpeak hours بس — مش عندنا "الخط ده بياخد 23 دقيقة في الضغط". من غير data دقيقة، الـ Dijkstra هيدي نتائج مظبوطة على ورق بس مش في الواقع.

**الـ Scoring System:**

```js
score = numberOfStops + (walkDistanceMeters / 500)
```

بسيطة عمداً — عدد محطات أقل + مشي أقل = أحسن. ده بيلاقي "أسرع" رحلة مش "أرخص" ولا "أحسن نظرة". لو في المستقبل عايزين نضيف fare optimization، بيبقى easy to add هنا.

---

### ADR-10 — ليه قسّمنا الـ Endpoints بالطريقة دي؟

**القرار:** تقسيم الـ API على 5 routers منفصلة.

**السياق:** كان ممكن يبقى router واحد كبير بـ 22 endpoint.

```
/api/auth/*     ← كل حاجة متعلقة بالهوية
/api/routes/*   ← كل حاجة متعلقة بالخطوط والبحث
/api/ai/*       ← الـ AI chat (مفصولة عشان rate limit مختلف)
/api/ratings/*  ← التقييمات (مفصولة عشان future feature: تقييم driver)
/api/admin/*    ← الـ admin-only operations
```

**ليه الفصل ده؟**

**1. Rate Limiting Granularity:**
لو كل حاجة في router واحد، كل الـ endpoints بتاخد نفس الـ rate limit. الـ AI endpoint بيحتاج limit أكتر صرامة (20/hour) من الـ search (100/15min). الفصل بيخلي تطبيق مختلف limits على كل router بدون complexity.

**2. Middleware Chain:**
```js
router.use('/admin', protect, requireAdmin, adminRouter)
// protect + requireAdmin بيتطبق على كل الـ admin routes تلقائياً
// مفيش حاجة تحطهم على كل endpoint منفردة
```

**3. Future Scalability:**
لو قررنا نفصل الـ AI service لـ microservice منفصلة، `/api/ai/*` موجود في ملف واحد — refactor بسيط.

**4. Team Clarity:**
لو اشتغل عليه team أكبر، كل developer بيعرف أي ملف يفتح للـ feature اللي بيشتغل عليها.

---

### ADR-11 — ليه Soft Delete وليه مش Hard Delete للـ Routes؟

**القرار:** `isActive: false` بدلاً من `Route.deleteOne()`.

**السياق:** الـ admin لما بيحذف خط، بيعمل:

```js
route.isActive = false
await route.save()
// مش: await Route.deleteOne({ _id: id })
```

**ليه؟**

**1. Data Integrity:**
لو User عنده route محفوظة في `savedRoutes` وـRoute اتحذف فعلاً، الـ `savedRoutes` array هيبقى فيه orphan ObjectId بيشير لـ document مش موجود. بيعمل errors في الـ frontend.

**2. Audit Trail:**
الـ admin ممكن يحذف خط بالغلط. بـ soft delete ممكن يرجع يـactivate الخط من المنظور ده.

**3. Analytics:**
الخطوط القديمة ممكن تكون مهمة لإحصائيات "أكتر الخطوط بحثاً" حتى لو مش active دلوقتي.

**4. Referential Integrity في MongoDB:**
MongoDB مش بيعمل CASCADE DELETE تلقائياً زي SQL. لو حذفنا Route وعندنا Ratings وـSearchHistory بيشيروا ليه، هيبقى orphaned documents في الـ DB. الـ soft delete بيتجنب المشكلة دي بالكامل.

**Trade-off:** الـ queries كلها محتاجة `{ isActive: true }` filter. في Mongoose ممكن نحل ده بـ:

```js
// مش موجود في الكود الحالي — مقترح للمستقبل
routeSchema.pre(/^find/, function() {
  this.where({ isActive: true })
})
```

---

### ADR-12 — ليه انفصلنا `app.js` عن `server.js`؟

**القرار:** `app.js` بيعرّف Express app بدون `listen()`، و`server.js` بيعمل DB connection وبعدين `listen()`.

**السياق:** كان ممكن يبقى ملف واحد.

**السبب الوحيد والكافي: Testing.**

```js
// ❌ لو كل حاجة في server.js:
// كل مرة test بتعمل require للـ app:
//   → محاولة connection بـ MongoDB الحقيقية
//   → server بيـlisten على port حقيقي
//   → tests بتتعارض على نفس الـ port

// ✅ الطريقة الحالية:
// app.js: Express + Middleware + Routes (بدون DB وبدون listen)
const app = require('../../app')  // safe في tests
// mongodb-memory-server بيتولى الـ DB
// supertest مش محتاج real TCP listen
```

**الـ test setup:**

```js
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
  app = require('../../app')  // يشتغل لأنه مش بيعمل mongoose.connect()
})
```

لو `mongoose.connect()` كانت في `app.js`، الـ require ده كان هيحاول يتصل بـ real Atlas — يفشل في CI/CD environment.

---

### ADR-13 — ليه optionalProtect بدل protect في الـ Search؟

**القرار:** Search endpoint بيقبل الـ requests بدون token، ولو في token بيستخدمه.

```js
router.get('/search', apiLimiter, optionalProtect, searchRoutes)
// مش: router.get('/search', apiLimiter, protect, searchRoutes)
```

**ليه؟**

**الـ Product Decision:** مش عايزين نجبر الناس يعملوا account عشان يبحثوا عن خط. الـ core value proposition (البحث) محتاجة تكون accessible للكل.

**الـ Technical Benefit:** لو المستخدم logged in، بنحفظ الـ search history. لو مش logged in، الـ search بيشتغل بردو بس من غير تسجيل.

```js
// optionalProtect في auth.middleware.js
const optionalProtect = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      req.user = decoded
    }
  } catch {
    // Token غلط أو منتهي — مش مشكلة، بنكمل بدونه
  }
  next()  // دايماً بنكمل
}
```

---

### ADR-14 — ليه isBidirectional في الـ Route Model؟

**القرار:** Route document واحد بيمثل الخط في الاتجاهين لو `isBidirectional: true`.

**البديل:** إنشاء Route منفصلة لكل اتجاه.

**ليه `isBidirectional` كان أحسن:**

```
بدون isBidirectional:
  خط المنشية - سيدي بشر = 2 documents
  خط الرمل - محطة مصر = 2 documents
  50 خط = 100 documents
  الـ admin بيضيف خط = يضيف اتنين
  لو السعر اتغير = يعدّل في اتنين

مع isBidirectional:
  خط المنشية - سيدي بشر = document واحد (isBidirectional: true)
  لو السعر اتغير = تعديل في مكان واحد
  الـ search engine بيعمل flip للـ stops array لما يبحث عكس الاتجاه
```

**الـ Trade-off:** الـ search algorithm بيبقى أعقد شوية — لازم يولّد "route variants" (forward + reverse). لكن ده أفضل بكتير من data inconsistency لو نسيت تعدّل في الاتجاه التاني.

---

### ADR-15 — ليه Mongoose وليه MongoDB Native Driver؟

**القرار:** Mongoose 8 ODM بدلاً من MongoDB native driver مباشرة.

| Feature | Mongoose | Native Driver |
|---------|----------|---------------|
| Schema validation | ✅ Built-in | ❌ Manual |
| Pre/Post hooks | ✅ (password hash) | ❌ Manual |
| Populate (JOINs) | ✅ | ❌ Manual lookups |
| TypeScript types | ✅ auto-generated | ❌ Manual |
| Query building | ✅ chainable API | ❌ Raw objects |

**الـ Hook اللي بيستخدمه المشروع:**

```js
// بدون Mongoose pre-save hook:
// في كل مكان بنحفظ user لازم نتذكر نعمل hash
userService.register() → bcrypt.hash()  ← ممكن ننسى
userService.updatePassword() → bcrypt.hash()  ← ممكن ننسى
userService.resetPassword() → bcrypt.hash()  ← ممكن ننسى

// مع Mongoose:
userSchema.pre('save', async function() {
  if (this.isModified('passwordHash')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12)
  }
})
// بيحصل automatically في كل save — مفيش فرصة ننسى
```

---

### خلاصة الـ ADRs — الـ Core Principles

الـ 15 قرار فوق بيتحكم فيهم 4 مبادئ أساسية:

```
1. SIMPLICITY FIRST
   كل مرة كان في خيار أبسط وكافي، اخترناه.
   (Monolith لا Microservices، BFS لا Dijkstra، SSE لا WebSocket)

2. TEST-ABILITY
   كل قرار اتأثر بـ "هنقدر نـtest ده بسهولة؟"
   (app.js/server.js split، Services منفصلة عن Controllers)

3. DATA INTEGRITY
   البيانات محتاجة تكون صح حتى لو الكود اتغير.
   (Soft delete، isBidirectional، Mongoose hooks)

4. COST CONSCIOUSNESS
   المشروع ده على free tiers.
   (gpt-4o-mini مش gpt-4o، RAG مش fine-tuning، Rate limiting للـ AI)
```

---



```
┌──────────────────────────────────────────────────────────────────┐
│                        المستخدم                                  │
│                    Browser / Mobile                              │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    CDN / Vercel Edge                              │
│            Static Files: HTML, CSS, JS                           │
│                  React SPA (client/)                             │
│                                                                  │
│  react-router → Pages → Components → Hooks                      │
│  react-query (cache) + axios (HTTP) + useAIChat (SSE)           │
└────────────────────────────┬─────────────────────────────────────┘
                             │ /api/* (HTTPS)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                Express Server (server/)                          │
│                                                                  │
│  helmet → cors → morgan → body parser → passport                 │
│  rate limiting (auth/api/ai limiters)                            │
│  Joi validation                                                  │
│                                                                  │
│  Routers → Controllers → Services → Models                       │
│                                                                  │
│  auth.service    routes.service    ai.service                   │
│  (JWT/OAuth)     (BFS search)      (RAG+SSE)                    │
└────────┬────────────────────────────────┬───────────────────────┘
         │                                │
         ▼                                ▼
┌─────────────────────┐      ┌─────────────────────────────────┐
│    MongoDB Atlas     │      │         OpenAI API              │
│                      │      │         gpt-4o-mini             │
│  Users               │      │         SSE streaming           │
│  Routes              │      │                                 │
│  Locations           │      │  Context: Arabic route data    │
│  Ratings             │      │  Persona: عم غريب              │
│  SearchHistory       │      │  max_tokens: 600               │
│  SavedTravelPlans    │      └─────────────────────────────────┘
└─────────────────────┘
```

---

*Documentation version: 1.0 — Created for Am Ghareeb ITI Graduation Project*
*المشروع: عم غريب — مستشار مواصلات الإسكندرية الذكي*