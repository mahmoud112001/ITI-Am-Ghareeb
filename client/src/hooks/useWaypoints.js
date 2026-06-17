// src/hooks/useWaypoints.js
// ---------------------------------------------------------------------------
// Local state for the waypoint list in the admin route editor.
// Keeps the list in React state until the admin hits "Generate Route",
// at which point the waypoints are sent to the server alongside the OSRM call.
// ---------------------------------------------------------------------------

import { useState, useCallback } from 'react'

function isValidWaypoint(wp) {
  return Number.isFinite(Number(wp?.lat)) && Number.isFinite(Number(wp?.lng))
}

function cloneWaypoint(wp) {
  return { lat: Number(wp.lat), lng: Number(wp.lng) }
}

/**
 * useWaypoints
 *
 * @param {Array<{lat, lng}>} initialWaypoints  Waypoints already stored on the route.
 *
 * Returns:
 *   waypoints     — current list (local state, not yet saved to DB)
 *   isDirty       — true when local waypoints differ from the server's copy
 *   addWaypoint   — append a new {lat, lng} (called from map click)
 *   updateWaypoint— replace waypoint at index (called from drag end)
 *   removeWaypoint— remove waypoint at index (called from right-click)
 *   resetWaypoints— replace entire list (call with [] to clear, or with
 *                   route.waypoints when discarding unsaved edits)
 */
export function useWaypoints(initialWaypoints = []) {
  const [waypoints, setWaypoints] = useState(() =>
    // Clone so we don't mutate the route prop
    initialWaypoints.filter(isValidWaypoint).map(cloneWaypoint)
  )

  // Track whether local state diverges from what's on the server
  const [serverWaypoints, setServerWaypoints] = useState(() =>
    initialWaypoints.filter(isValidWaypoint).map(cloneWaypoint)
  )

  const isDirty =
    waypoints.length !== serverWaypoints.length ||
    waypoints.some(
      (wp, i) =>
        wp.lat !== serverWaypoints[i]?.lat ||
        wp.lng !== serverWaypoints[i]?.lng
    )

  const addWaypoint = useCallback((coord) => {
    if (!isValidWaypoint(coord)) return
    setWaypoints((prev) => [...prev, cloneWaypoint(coord)])
  }, [])

  const updateWaypoint = useCallback((index, coord) => {
    if (!isValidWaypoint(coord)) return
    setWaypoints((prev) =>
      prev.map((wp, i) =>
        i === index ? cloneWaypoint(coord) : wp
      )
    )
  }, [])

  const removeWaypoint = useCallback((index) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index))
  }, [])

  /**
   * resetWaypoints — replace the entire local list.
   * Call after a successful generatePath / clearPath to sync with server state,
   * or with the original route.waypoints to discard unsaved edits.
   *
   * @param {Array<{lat,lng}>} newWaypoints
   */
  const resetWaypoints = useCallback((newWaypoints = []) => {
    const cloned = newWaypoints.filter(isValidWaypoint).map(cloneWaypoint)
    setWaypoints(cloned)
    setServerWaypoints(cloned)
  }, [])

  return {
    waypoints,
    isDirty,
    addWaypoint,
    updateWaypoint,
    removeWaypoint,
    resetWaypoints,
  }
}
