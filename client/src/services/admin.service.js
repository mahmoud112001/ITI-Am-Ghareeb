// src/services/admin.service.js
// ---------------------------------------------------------------------------
// All functions use the shared `api` axios instance from lib/axios.js.
// That instance already attaches  Authorization: Bearer <token>  on every
// request and handles 401 → refresh → retry automatically.
// The Vite proxy forwards /api/* → http://localhost:5000 in development.
// ---------------------------------------------------------------------------
import api from '../lib/axios'

/**
 * GET /api/admin/stats
 * Shape: { stats: { totalRoutes, totalUsers, totalRatings, topSearched[] } }
 */
export const getAdminStats = () =>
  api.get('/api/admin/stats').then((r) => r.data)

/**
 * GET /api/admin?page=N&limit=10
 * Shape: { routes: [{ route, accuracyStats }], pages: N }
 */
export const getAdminRoutes = (page = 1, limit = 10) =>
  api.get('/api/admin', { params: { page, limit } }).then((r) => r.data)

/**
 * POST /api/admin
 * Body: { routeId, nameAr, nameEn, type, fare: { min, max }, operatingHours: { start, end } }
 */
export const createRoute = (body) =>
  api.post('/api/admin', body).then((r) => r.data)

/**
 * PUT /api/admin/:id
 * Body: same shape as createRoute (partial updates accepted by the server)
 */
export const updateRoute = (id, body) =>
  api.put(`/api/admin/${id}`, body).then((r) => r.data)

/**
 * DELETE /api/admin/:id
 * Soft-delete — sets isActive: false on the server, does NOT remove the document.
 * The route will still appear in the admin table with status "محذوف".
 */
export const deleteRoute = (id) =>
  api.delete(`/api/admin/${id}`).then((r) => r.data)
