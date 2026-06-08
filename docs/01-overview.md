# 1. Project Overview

**عم غريب — Am Ghareeb** is a bilingual Arabic-first web application that helps Alexandria residents navigate the city's informal microbus network. The app combines a real-time MongoDB route database with an AI character — an old Alexandrian man named Am Ghareeb — who responds in authentic Alexandrian dialect.

---

## What It Does

- Route search between any two Alexandria stations with fuzzy Arabic/English matching
- Interactive Leaflet map with GPS-pinned station markers
- AI chat with real-time streaming responses powered by gpt-4o-mini (RAG pipeline)
- Community accuracy ratings (thumbs up/down per route)
- Personal dashboard: search history + saved routes
- Admin panel: full CRUD on routes + live statistics
- Google OAuth + email/password auth with silent JWT rotation

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Client | React + Vite + Tailwind CSS | 18.2.0 / 5.x / 3.x |
| Routing | react-router-dom | 6.22.1 |
| Data Fetching | @tanstack/react-query | 5.18.1 |
| HTTP Client | Axios | 1.6.7 |
| Maps | react-leaflet + leaflet | 4.2.1 / 1.9.4 |
| Server | Node.js + Express | ≥18 / 4.18.2 |
| Database | MongoDB + Mongoose | 8.0.3 |
| Auth | JWT + Passport Google OAuth | 9.0.2 / 0.7.0 |
| AI | OpenAI gpt-4o-mini (SSE streaming) | 4.28.0 |
| Validation | Joi | 17.12.1 |
| Security | Helmet + CORS + Rate Limiting | 7.1.0 / 2.8.5 / 7.2.0 |
| Testing | Jest + Supertest + mongodb-memory-server | 29.7.0 |

---

## Design Tokens

| Token | Hex | Used For |
|-------|-----|----------|
| Navy / الكحلي | `#1E3A5F` | Primary brand, Navbar, headings |
| Amber / العنبري | `#F59E0B` | CTA buttons, accents, active states |
| Cream / الكريمي | `#FEF9EF` | Page backgrounds |
| White / الأبيض | `#FFFFFF` | Cards, modals, table rows |

---

## File Counts

| Group | Files | Notes |
|-------|-------|-------|
| `server/` root | 7 | app.js, server.js, package.json, jest/babel config, .env files |
| `server/src/` | 30 | Models, services, routes, middleware, controllers, tests |
| `client/` root | 6 | package.json, index.html, vite/tailwind/postcss config, .env.local |
| `client/src/` | 24 | Pages, components, hooks, context, lib |
| Root | 2 | README.md, .gitignore |
| **Total** | **69** | |
