// services/osrm.service.js
// ---------------------------------------------------------------------------
// Thin wrapper around routing APIs.
// Uses OSRM for driving/transport route shapes and optional OpenRouteService
// for walking paths. Keep secret provider keys on the server only.
// ---------------------------------------------------------------------------

const axios = require('axios')

const OSRM_BASE_URL = process.env.OSRM_URL || 'http://router.project-osrm.org'
const ORS_BASE_URL = process.env.OPENROUTESERVICE_URL || 'https://api.openrouteservice.org'
const ORS_API_KEY = process.env.OPENROUTESERVICE_API_KEY
const OSRM_PROFILES = {
  car: 'driving',
  driving: 'driving',
  transport: 'driving',
  walk: 'foot',
  walking: 'foot',
  foot: 'foot',
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the OSRM /route/v1/:profile URL.
 * OSRM expects coordinates as lng,lat — the opposite of Leaflet's lat,lng.
 */
function normalizeProfile(profile) {
  return OSRM_PROFILES[String(profile || '').toLowerCase()] || 'driving'
}

function buildOsrmUrl(coords, profile = 'driving') {
  const coordString = coords.map((c) => `${c.lng},${c.lat}`).join(';')
  const osrmProfile = normalizeProfile(profile)
  return (
    `${OSRM_BASE_URL}/route/v1/${osrmProfile}/${coordString}` +
    `?overview=full&geometries=geojson&steps=false`
  )
}

function isWalkingProfile(profile) {
  return ['walk', 'walking', 'foot'].includes(String(profile || '').toLowerCase())
}

function decodeOrsGeometry(geometry) {
  return (geometry?.coordinates || []).map(([lng, lat]) => ({ lat, lng }))
}

async function generateWalkingPath(coords) {
  if (!ORS_API_KEY) {
    return coords
  }

  try {
    const response = await axios.post(
      `${ORS_BASE_URL}/v2/directions/foot-walking/geojson`,
      {
        coordinates: coords.map((coord) => [coord.lng, coord.lat]),
      },
      {
        headers: {
          Authorization: ORS_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 15_000,
      },
    )

    const path = decodeOrsGeometry(response.data?.features?.[0]?.geometry)
    return path.length >= 2 ? path : coords
  } catch {
    return coords
  }
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

function distanceSq(pointA, pointB) {
  return (pointA.lat - pointB.lat) ** 2 + (pointA.lng - pointB.lng) ** 2
}

function dedupeConsecutiveCoords(points) {
  return points.filter((point, index) => {
    if (index === 0) return true
    return distanceSq(point, points[index - 1]) > 1e-12
  })
}

function waypointSegmentPosition(waypoint, start, end) {
  const dx = end.lng - start.lng
  const dy = end.lat - start.lat
  const lenSq = dx * dx + dy * dy

  if (lenSq === 0) {
    return { t: 0, distanceSq: distanceSq(waypoint, start) }
  }

  const rawT = ((waypoint.lng - start.lng) * dx + (waypoint.lat - start.lat) * dy) / lenSq
  const t = Math.max(0, Math.min(1, rawT))
  const projected = {
    lat: start.lat + t * dy,
    lng: start.lng + t * dx,
  }

  return { t, distanceSq: distanceSq(waypoint, projected) }
}

function insertWaypointsByNearestSegment(points, waypoints) {
  if (points.length < 2 || waypoints.length === 0) return points

  const segmentBuckets = Array.from({ length: points.length - 1 }, () => [])

  for (const waypoint of waypoints) {
    let best = { segmentIndex: 0, t: 0, distanceSq: Number.POSITIVE_INFINITY }

    for (let i = 0; i < points.length - 1; i += 1) {
      const candidate = waypointSegmentPosition(waypoint, points[i], points[i + 1])
      if (candidate.distanceSq < best.distanceSq) {
        best = { segmentIndex: i, ...candidate }
      }
    }

    segmentBuckets[best.segmentIndex].push({ ...waypoint, t: best.t })
  }

  const ordered = [points[0]]
  for (let i = 0; i < segmentBuckets.length; i += 1) {
    segmentBuckets[i]
      .sort((a, b) => a.t - b.t)
      .forEach(({ lat, lng }) => ordered.push({ lat, lng }))
    ordered.push(points[i + 1])
  }

  return dedupeConsecutiveCoords(ordered)
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
async function generatePath(coords, options = {}) {
  const cleanCoords = Array.isArray(coords)
    ? coords.filter(isValidCoord)
    : []

  if (cleanCoords.length < 2) {
    throw Object.assign(
      new Error('يجب تحديد نقطة بداية ونهاية على الأقل'),
      { statusCode: 400 }
    )
  }

  if (cleanCoords.length > 100) {
    // OSRM supports up to 25 waypoints + origin + destination = 27 total
    throw Object.assign(
      new Error('الحد الأقصى 25 نقطة تحديد مسار'),
      { statusCode: 400 }
    )
  }

  if (isWalkingProfile(options.profile)) {
    return generateWalkingPath(cleanCoords)
  }

  const url = buildOsrmUrl(cleanCoords, options.profile)

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
 * The manually drawn geometry is the source of truth when available. OSRM
 * routes through that shape, while extra OSRM waypoints are inserted into the
 * closest geometry segment. Stations stay display/search data; forcing exact
 * station coordinates can create side-street loops when points are slightly
 * offset from the intended road.
 *
 * @param {object} route  Mongoose route document or plain object
 * @returns {Array<{lat, lng}>}
 */
function buildRoutingCoords(route) {
  const coordsFromGeoPoint = (location) => {
    const coordinates = location?.coordinates || location?.location?.coordinates
    if (!Array.isArray(coordinates) || coordinates.length !== 2) return null
    const [lng, lat] = coordinates
    return { lat, lng }
  }

  const coordsFromStop = (stop) => {
    if (isValidCoord(stop?.coords)) return stop.coords
    return coordsFromGeoPoint(stop?.location)
  }

  const stationPoints = (route.stations || route.stops || [])
    .map(coordsFromStop)
    .filter(isValidCoord)

  const geometryPoints = (route.geometry?.coordinates || [])
    .map((point) => {
      if (!Array.isArray(point) || point.length !== 2) return null
      const [lng, lat] = point
      return { lat, lng }
    })
    .filter(isValidCoord)
  const waypointPoints = (route.waypoints || []).filter(isValidCoord)

  if (geometryPoints.length >= 2) {
    return insertWaypointsByNearestSegment(geometryPoints, waypointPoints)
  }

  if (stationPoints.length >= 2) {
    return insertWaypointsByNearestSegment(stationPoints, waypointPoints)
  }

  const points = []
  const originCoords = isValidCoord(route.origin?.coords)
    ? route.origin.coords
    : coordsFromGeoPoint(route.origin)
  const destinationCoords = isValidCoord(route.destination?.coords)
    ? route.destination.coords
    : coordsFromGeoPoint(route.destination)

  if (isValidCoord(originCoords)) {
    points.push(originCoords)
  }

  if (isValidCoord(destinationCoords)) {
    points.push(destinationCoords)
  }

  if (points.length < 2 && waypointPoints.length >= 2) {
    return dedupeConsecutiveCoords(waypointPoints)
  }

  return insertWaypointsByNearestSegment(points, waypointPoints)
}

module.exports = { generatePath, buildRoutingCoords, isValidCoord }
