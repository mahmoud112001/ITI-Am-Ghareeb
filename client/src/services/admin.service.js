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
 * GET /api/admin/routes?page=N&limit=10
 * Shape: { routes: [{ route, accuracyStats }], pages: N }
 */
export const getAdminRoutes = (page = 1, limit = 10) =>
  api.get('/api/admin/routes', { params: { page, limit } }).then((r) => r.data)

/**
 * POST /api/admin/routes
 * Body: { routeId, type, fare: { min, max }, operatingHours: { start, end }, stops[], geometry }
 * Route names are derived on the server from the first and last stop.
 */
export const createRoute = (body) =>
  api.post('/api/admin/routes', body).then((r) => r.data)

/**
 * PUT /api/admin/routes/:id
 * Body: same shape as createRoute, including geometry when the road path changes
 */
export const updateRoute = (id, body) =>
  api.put(`/api/admin/routes/${id}`, body).then((r) => r.data)

/**
 * PATCH /api/admin/routes/:id/restore
 * Restores a soft-deleted route back to active status.
 */
export const restoreRoute = (id) =>
  api.patch(`/api/admin/routes/${id}/restore`).then((r) => r.data)

/**
 * DELETE /api/admin/routes/:id
 * Soft-delete — sets isActive: false on the server, does NOT remove the document.
 * The route will still appear in the admin table with status "محذوف".
 */
export const deleteRoute = (id) =>
  api.delete(`/api/admin/routes/${id}`).then((r) => r.data)
