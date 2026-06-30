// src/hooks/useAdminRoutes.js
// ---------------------------------------------------------------------------
// TanStack Query v5 hooks that wrap the admin service layer.
// Import these in AdminPage.jsx instead of calling `api` directly so the
// data-fetching logic stays out of the component.
// ---------------------------------------------------------------------------
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAdminStats,
  getAdminRoutes,
  getAdminRatingMessages,
  createRoute,
  updateRoute,
  restoreRoute,
  deleteRoute,
  generateRoutePath,  // ← add
  clearRoutePath,     // ← add
} from '../services/admin.service'

// ── Query keys ────────────────────────────────────────────────────────────────
export const ADMIN_KEYS = {
  stats: ['admin-stats'],
  routes: (page) => ['admin-routes', page],
  ratingMessages: ['admin-rating-messages'],
}

// ── useAdminStats ─────────────────────────────────────────────────────────────
/**
 * Fetches dashboard statistics.
 * Returns TanStack Query result; access data via result.data?.stats
 */
export function useAdminStats() {
  return useQuery({
    queryKey: ADMIN_KEYS.stats,
    queryFn: getAdminStats,
  })
}

// ── useAdminRoutes ────────────────────────────────────────────────────────────
/**
 * Fetches paginated routes list.
 * @param {number} page  Current page number (1-based).
 * Returns TanStack Query result; access data via:
 *   result.data?.routes  → [{ route, accuracyStats }]
 *   result.data?.pages   → total page count
 */
export function useAdminRoutes(page = 1) {
  return useQuery({
    queryKey: ADMIN_KEYS.routes(page),
    queryFn: () => getAdminRoutes(page),
    placeholderData: (prev) => prev, // keeps previous page data while next page loads (replaces keepPreviousData in v5)
  })
}

// ── useCreateRoute ────────────────────────────────────────────────────────────
/**
 * Mutation to add a new route.
 * Invalidates both the routes list and stats on success.
 *
 * Usage:
 *   const { mutate, isPending } = useCreateRoute()
 *   mutate(body, { onSuccess: () => setAddOpen(false) })
 */
export function useCreateRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createRoute,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-routes'] })
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.stats })
    },
  })
}

// ── useUpdateRoute ────────────────────────────────────────────────────────────
/**
 * Mutation to edit an existing route.
 * Invalidates the routes list on success.
 *
 * Usage:
 *   const { mutate, isPending } = useUpdateRoute()
 *   mutate({ id: route._id, body }, { onSuccess: () => setEditRoute(null) })
 */
export function useUpdateRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }) => updateRoute(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-routes'] })
    },
  })
}

// ── useRestoreRoute ───────────────────────────────────────────────────────────
export function useRestoreRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: restoreRoute,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-routes'] })
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.stats })
    },
  })
}

// ── useDeleteRoute ────────────────────────────────────────────────────────────
/**
 * Mutation to soft-delete a route.
 * Invalidates both the routes list and stats on success.
 *
 * Usage:
 *   const { mutate, isPending } = useDeleteRoute()
 *   mutate(route._id, { onSuccess: () => setDeleteRoute(null) })
 */
export function useDeleteRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteRoute,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-routes'] })
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.stats })
    },
  })
}

export function useGenerateRoutePath() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, waypoints }) => generateRoutePath(id, waypoints),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-routes'] })
    },
  })
}

export function useClearRoutePath() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => clearRoutePath(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-routes'] })
    },
  })
}

export function useAdminRatingMessages(limit = 50) {
  return useQuery({
    queryKey: [...ADMIN_KEYS.ratingMessages, limit],
    queryFn: () => getAdminRatingMessages(limit),
  })
}
