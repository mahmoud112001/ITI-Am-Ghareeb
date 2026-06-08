# 10. Glossary

| Term | Meaning |
|------|---------|
| **مشروع** (Mashrou') | Local Alexandrian name for a microbus — the informal shared minivan transit system that forms the backbone of Alexandria's public transport |
| **عم غريب** (Am Ghareeb) | Literally "Uncle Stranger/Foreigner" — the AI persona, an old Alexandrian man in white galabiya and tarboush who knows every bus route |
| **يا فنان** | Alexandrian term of address roughly meaning "hey chief" or "hey buddy" — used by Am Ghareeb in responses |
| **أحيه** | Alexandrian exclamation of agreement or acknowledgment |
| **بحر / جوه** | Alexandrian directional terms: بحر = north (toward the sea), جوه = south (inland toward Cairo) |
| **RAG** | Retrieval-Augmented Generation — the AI pattern of fetching relevant database records and injecting them into an LLM prompt as context, so the model can answer questions about your specific data |
| **SSE** | Server-Sent Events — a one-way HTTP streaming protocol. The server sends `data: ...\n\n` events over a persistent HTTP connection. Used here to stream AI response chunks to the browser in real time |
| **JWT** | JSON Web Token — a signed, base64-encoded token used for stateless authentication. The server verifies the signature without needing to look up a session in the database |
| **Access Token** | Short-lived JWT (15 minutes). Sent in the `Authorization: Bearer` header with every API request |
| **Refresh Token** | Long-lived JWT (7 days). Stored in the database. Used only to get a new access token when the old one expires |
| **Token Rotation** | Issuing a brand-new refresh token each time the old one is used. The old token is invalidated in the database. Prevents replay attacks |
| **optionalProtect** | Middleware that tries to verify a Bearer token but does not reject the request if no token is present. Used on the search endpoint to allow both anonymous and authenticated access |
| **Soft-delete** | Setting `isActive: false` on a Route document instead of permanently removing it from MongoDB. Preserves historical data and ratings while hiding the route from public queries |
| **MVC** | Model-View-Controller — the architectural pattern used on the server. Models (Mongoose schemas) → Services (business logic) → Controllers (HTTP handlers) → Routes (Express routers). The "View" is the React client |
| **Vite Proxy** | A development-only feature in `vite.config.js` that forwards requests matching `/api/*` from the frontend dev server (`:5173`) to the backend (`:5000`). Eliminates CORS issues in development |
| **In-memory Tokens** | Tokens stored in JavaScript module-level variables (not `localStorage`, not `sessionStorage`, not cookies). Lost on page reload — this is by design to avoid XSS token theft |
| **`bcryptjs`** | Pure-JavaScript bcrypt implementation. Used instead of native `bcrypt` because it requires no native bindings and works in all Node.js environments |
| **mongodb-memory-server** | An npm package that downloads and runs a real MongoDB binary in memory. Used in tests to avoid needing a running MongoDB instance |
| **`supertest`** | Node.js HTTP assertion library. Wraps an Express app and lets you make test requests against it without starting a real TCP server |
| **ALEX-MICRO-01..10** | The 10 seed route IDs. Real Alexandria microbus lines loaded by `npm run seed`. Routes 03–07 cover the Abu Qir corridor after the coastal train suspension in March 2024 |
| **Abu Qir train** | A historic coastal electric tram/train line running along Alexandria's northern coast. Suspended March 2024. The seed data includes 5 microbus replacement routes for this corridor |
| **`[DONE]`** | The SSE stream end sentinel. Sent as the literal string `data: [DONE]\n\n` by the server. The client checks `payload === '[DONE]'` — never `JSON.parse('[DONE]')` which would throw a `SyntaxError` |
| **Barrel export** | A pattern where `index.js` re-exports everything from multiple modules. Used in `server/src/models/index.js` so controllers and services can write `require('../models')` instead of individual paths |
| **Late require** | Requiring a module inside a function body instead of at the top of the file. Used in `Route.model.js`'s `getAccuracyStats` method to require `Rating.model.js`, avoiding a circular dependency that would prevent both modules from loading |
| **`flushHeaders()`** | Express/Node.js method that immediately sends the HTTP response headers to the client without waiting for the body. Required for SSE — the client must receive the `Content-Type: text/event-stream` header before the server starts streaming events |
| **DXA** | Twentieths of a typographic point — the unit used in Word/OOXML documents. 1440 DXA = 1 inch. Not used in this project (Markdown docs only) but included for reference |
