// services/osrm.service.js
// ---------------------------------------------------------------------------
// Thin wrapper around the OSRM HTTP API.
// Self-host OSRM with Egypt OSM data for production (see README).
// Falls back to the public demo server for local development only.
// ---------------------------------------------------------------------------

const axios = require('axios')

const OSRM_BASE_URL = process.env.OSRM_URL || 'http://router.project-osrm.org'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the OSRM /route/v1/driving URL.
 * OSRM expects coordinates as lng,lat — the opposite of Leaflet's lat,lng.
 */
function buildOsrmUrl(coords) {
  const coordString = coords.map((c) => `${c.lng},${c.lat}`).join(';')
  return (
    `${OSRM_BASE_URL}/route/v1/driving/${coordString}` +
    `?overview=full&geometries=geojson&steps=false`
  )
}

/**
 * Decode GeoJSON LineString coordinates (lng,lat pairs) into [{lat, lng}].
 */
function decodeGeojsonGeometry(geometry) {
  return geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
}

/**
 * Validate a single coordinate object.
 * Returns true if both lat and lng are numbers in valid ranges.
 */
function isValidCoord(coord) {
  return (
    coord &&
    typeof coord.lat === 'number' &&
    typeof coord.lng === 'number' &&
    coord.lat >= -90 && coord.lat <= 90 &&
    coord.lng >= -180 && coord.lng <= 180 &&
    !(coord.lat === 0 && coord.lng === 0) // reject unset zero-placeholders
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * generatePath — calls OSRM and returns the decoded geometry.
 *
 * @param {Array<{lat: number, lng: number}>} coords  Ordered routing points.
 *   Must be at least 2 valid, non-zero coordinates.
 * @returns {Promise<Array<{lat: number, lng: number}>>}
 */
async function generatePath(coords) {
  if (!Array.isArray(coords) || coords.length < 2) {
    throw Object.assign(
      new Error('يجب تحديد نقطة بداية ونهاية على الأقل'),
      { statusCode: 400 }
    )
  }

  const invalidCoord = coords.find((c) => !isValidCoord(c))
  if (invalidCoord) {
    throw Object.assign(
      new Error(`إحداثيات غير صالحة: ${JSON.stringify(invalidCoord)}`),
      { statusCode: 400 }
    )
  }

  if (coords.length > 27) {
    // OSRM supports up to 25 waypoints + origin + destination = 27 total
    throw Object.assign(
      new Error('الحد الأقصى 25 نقطة تحديد مسار'),
      { statusCode: 400 }
    )
  }

  const url = buildOsrmUrl(coords)

  let response
  try {
    response = await axios.get(url, { timeout: 15_000 })
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      throw Object.assign(
        new Error('خدمة OSRM غير متاحة حالياً. تحقق من تشغيل الخادم.'),
        { statusCode: 502 }
      )
    }
    if (err.response?.status === 400) {
      throw Object.assign(
        new Error('OSRM: لا يوجد طريق بين هذه الإحداثيات'),
        { statusCode: 422 }
      )
    }
    throw err
  }

  const { code, routes } = response.data

  if (code !== 'Ok') {
    const osrmMessages = {
      NoRoute:   'OSRM: لا يوجد طريق بين هذه النقاط',
      NoSegment: 'OSRM: إحدى النقاط بعيدة عن أي طريق',
      InvalidUrl: 'OSRM: طلب غير صالح',
    }
    throw Object.assign(
      new Error(osrmMessages[code] || `OSRM error: ${code}`),
      { statusCode: 422 }
    )
  }

  const route = routes?.[0]
  if (!route?.geometry) {
    throw Object.assign(
      new Error('OSRM: لم يتم إرجاع أي مسار'),
      { statusCode: 502 }
    )
  }

  return decodeGeojsonGeometry(route.geometry)
}

/**
 * buildRoutingCoords — assembles the ordered coordinate list for a route:
 *   origin → waypoints → destination
 *
 * Stations are NOT included as forced via-points here; they remain
 * display-only markers. If you want OSRM to route through every station,
 * replace this with: [origin, ...stations.sorted, ...waypoints, destination]
 *
 * @param {object} route  Mongoose route document or plain object
 * @returns {Array<{lat, lng}>}
 */
function buildRoutingCoords(route) {
  const points = []

  if (isValidCoord(route.origin?.coords)) {
    points.push(route.origin.coords)
  }

  for (const wp of route.waypoints || []) {
    if (isValidCoord(wp)) points.push(wp)
  }

  if (isValidCoord(route.destination?.coords)) {
    points.push(route.destination.coords)
  }

  return points
}

module.exports = { generatePath, buildRoutingCoords, isValidCoord }