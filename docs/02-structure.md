# 2. Project Structure

The repository is split into two independent npm workspaces under a single root.

```
am-ghareeb/
├── .gitignore
├── README.md
├── docs/                           ← this documentation
│   ├── 01-overview.md
│   ├── 02-structure.md
│   ├── 03-how-to-run.md
│   ├── 04-server-layer.md
│   ├── 05-client-layer.md
│   ├── 06-architecture-flows.md
│   ├── 07-testing.md
│   ├── 08-gamma-integration.md
│   ├── 09-environment.md
│   └── 10-glossary.md
├── server/                         ← Express API
│   ├── app.js                      ← Express app factory (no listen)
│   ├── server.js                   ← DB connect + bootstrap + listen
│   ├── package.json
│   ├── jest.config.js
│   ├── babel.config.js
│   ├── .env.example
│   ├── .env                        ← NOT committed — fill from .env.example
│   └── src/
│       ├── ai/
│       │   └── promptBuilder.js    ← Am Ghareeb persona + context injector
│       ├── config/
│       │   └── passport.js         ← Google OAuth 2.0 strategy
│       ├── controllers/
│       │   ├── auth.controller.js  ← Thin HTTP handlers for auth
│       │   └── routes.controller.js← Thin HTTP handlers for routes
│       ├── middleware/
│       │   ├── auth.middleware.js  ← protect + requireAdmin
│       │   ├── error.middleware.js ← Central error handler
│       │   ├── rateLimit.middleware.js ← authLimiter / apiLimiter / aiLimiter
│       │   └── validate.middleware.js  ← Joi schema validator factory
│       ├── models/
│       │   ├── User.model.js
│       │   ├── Route.model.js
│       │   ├── Rating.model.js
│       │   ├── SearchHistory.model.js
│       │   └── index.js            ← Barrel export for all models
│       ├── routes/
│       │   ├── auth.routes.js
│       │   ├── routes.routes.js
│       │   ├── rating.routes.js
│       │   ├── admin.routes.js
│       │   └── ai.routes.js
│       ├── scripts/
│       │   └── seed.js             ← 10 routes + admin user
│       ├── services/
│       │   ├── auth.service.js     ← Token generation, login, register
│       │   ├── routes.service.js   ← Search, history, saved routes
│       │   ├── rating.service.js   ← Submit + stats
│       │   ├── admin.service.js    ← CRUD + stats
│       │   └── ai.service.js       ← RAG pipeline + SSE stream
│       └── tests/
│           ├── models.test.js      ← 19 tests
│           ├── auth.test.js        ← 13 tests
│           ├── routes.test.js      ← 11 tests
│           ├── rating.test.js      ← 8 tests
│           ├── admin.test.js       ← 9 tests
│           └── ai.test.js          ← 7 tests
└── client/                         ← React SPA
    ├── package.json
    ├── index.html
    ├── vite.config.js              ← Proxy /api → :5000 in dev
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── .env.example
    ├── .env.local                  ← VITE_API_URL
    └── src/
        ├── main.jsx                ← React 18 createRoot entry
        ├── index.css               ← @tailwind directives + global styles
        ├── App.jsx                 ← Providers + lazy routes
        ├── context/
        │   └── AuthContext.jsx     ← Global auth state
        ├── lib/
        │   └── axios.js            ← Axios instance + token interceptors
        ├── hooks/
        │   └── useAIChat.js        ← SSE streaming hook
        ├── components/
        │   ├── AmGhareebAvatar.jsx ← SVG character illustration
        │   ├── ProtectedRoute.jsx  ← Auth guard wrapper
        │   ├── RouteCard.jsx       ← Route result card + AccuracyBadge
        │   ├── RatingModal.jsx     ← Submit accuracy vote
        │   └── layout/
        │       └── Navbar.jsx      ← Sticky top navigation
        └── pages/
            ├── HomePage.jsx
            ├── SearchPage.jsx
            ├── MapPage.jsx
            ├── AIChatPage.jsx
            ├── LoginPage.jsx
            ├── RegisterPage.jsx
            ├── DashboardPage.jsx
            └── AdminPage.jsx
```

---

## Why Two Entry Points in server/?

`app.js` exports the Express application object without calling `app.listen()`. This allows the test suites to import the app and bind it to a supertest agent without starting a real TCP server. `server.js` is the only file that connects to MongoDB and calls `app.listen()` — it is never imported by tests.
