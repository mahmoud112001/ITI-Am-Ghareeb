import { Fragment, useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../lib/axios'

// ── Fix Leaflet default icon URLs (broken by Vite asset hashing) ──────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Auto-fit map bounds when a route loads ────────────────────────────────────
function FitBounds({ coords }) {
  const map = useMap()
  useEffect(() => {
    if (coords.length >= 2) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] })
    }
  }, [coords, map])
  return null
}

function getPointMarkerStyle({ isEndpoint, isMatchedOrigin, isMatchedDestination }) {
  if (isMatchedOrigin) {
    return {
      outerRadius: 18,
      innerRadius: 10,
      outerFill: '#FDE7BF',
      outerStroke: '#F4A833',
      innerFill: '#F4A833',
      innerStroke: '#FFFFFF',
    }
  }

  if (isMatchedDestination) {
    return {
      outerRadius: 18,
      innerRadius: 10,
      outerFill: '#DBEAFE',
      outerStroke: '#1B2A4A',
      innerFill: '#1B2A4A',
      innerStroke: '#FFFFFF',
    }
  }

  if (isEndpoint) {
    return {
      outerRadius: 14,
      innerRadius: 8,
      outerFill: '#EEF2FF',
      outerStroke: '#1B2A4A',
      innerFill: '#5B6B8C',
      innerStroke: '#FFFFFF',
    }
  }

  return {
    outerRadius: 10,
    innerRadius: 5,
    outerFill: '#FFFFFF',
    outerStroke: '#94A3B8',
    innerFill: '#64748B',
    innerStroke: '#FFFFFF',
  }
}

function distanceSquared(point, target) {
  return (point.coords.lat - target.coords.lat) ** 2 + (point.coords.lng - target.coords.lng) ** 2
}

function findNearestGeometryIndex(geometryPoints, target) {
  if (!target?.coords || !geometryPoints.length) return -1

  let bestIndex = -1
  let bestDistance = Number.POSITIVE_INFINITY

  geometryPoints.forEach((point, index) => {
    const score = distanceSquared(point, target)
    if (score < bestDistance) {
      bestDistance = score
      bestIndex = index
    }
  })

  return bestIndex
}

// ── MapPage ───────────────────────────────────────────────────────────────────
export default function MapPage() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const routeId        = searchParams.get('routeId')
  const direction      = searchParams.get('direction') || 'forward'
  const matchedOriginId = searchParams.get('matchedOriginId')
  const matchedDestinationId = searchParams.get('matchedDestinationId')

  const [userLocation, setUserLocation] = useState(null)
  const [locError, setLocError]         = useState('')
  const [nearestRoute, setNearestRoute] = useState(null)

  // Fetch the selected route
  const { data, isLoading } = useQuery({
    queryKey: ['route', routeId, direction],
    queryFn:  () => api.get(`/api/routes/${routeId}`, { params: { direction } }).then((r) => r.data),
    enabled:  !!routeId,
  })

  const route = data?.route || null
  const geometryPoints = route?.geometryPoints || []
  const visibleStations = route?.stations || []

  // Stations with real GPS coordinates (filter zero-coord placeholders)
  const validStations = visibleStations.filter((s) => s.coords?.lat !== 0 && s.coords?.lng !== 0)

  const routePathCoords = (route?.path || [])
    .filter((p) => p?.lat && p?.lng)
    .map((p) => [p.lat, p.lng])

  const geometryPolylineCoords = geometryPoints
    .filter((s) => s.coords?.lat !== 0 && s.coords?.lng !== 0)
    .map((s) => [s.coords.lat, s.coords.lng])
  const polylineCoords = routePathCoords.length >= 2
    ? routePathCoords
    : geometryPolylineCoords

  const matchedOriginStation = validStations.find((station) => String(station._id) === matchedOriginId) || null
  const matchedDestinationStation = validStations.find((station) => String(station._id) === matchedDestinationId) || null
  const matchedOriginGeometryIndex = findNearestGeometryIndex(geometryPoints, matchedOriginStation)
  const matchedDestinationGeometryIndex = findNearestGeometryIndex(geometryPoints, matchedDestinationStation)
  const highlightGeometryCoords =
    matchedOriginGeometryIndex >= 0 &&
    matchedDestinationGeometryIndex >= 0 &&
    matchedOriginGeometryIndex !== matchedDestinationGeometryIndex
      ? geometryPoints
          .slice(
            Math.min(matchedOriginGeometryIndex, matchedDestinationGeometryIndex),
            Math.max(matchedOriginGeometryIndex, matchedDestinationGeometryIndex) + 1,
          )
          .map((point) => [point.coords.lat, point.coords.lng])
      : []

  // Nearest route (from user's location) computed stations/coords
  const nearestValidStations = nearestRoute ? (nearestRoute.stations || []).filter(s => s.coords?.lat && s.coords?.lng) : []
  const nearestPathCoords = (nearestRoute?.path || [])
    .filter((p) => p?.lat && p?.lng)
    .map((p) => [p.lat, p.lng])
  const nearestGeometryCoords = (nearestRoute?.geometryPoints || [])
    .filter((s) => s.coords?.lat && s.coords?.lng)
    .map((s) => [s.coords.lat, s.coords.lng])
  const nearestPolylineCoords = nearestPathCoords.length >= 2
    ? nearestPathCoords
    : nearestGeometryCoords

  function handleLocate() {
    setLocError('')
    if (!navigator.geolocation) {
      setLocError('المتصفح مش بيدعم تحديد الموقع')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coordsArr = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(coordsArr)
        // Fetch nearest route from backend (if available)
        try {
          const res = await api.get('/api/routes/near-me', { params: { lat: coordsArr[0], lng: coordsArr[1] } })
          const nearest = res.data.results?.[0]?.route || null
          setNearestRoute(nearest)
        } catch (err) {
          setNearestRoute(null)
        }
      },
      ()    => setLocError('تعذّر تحديد موقعك — تأكد من صلاحيات الموقع')
    )
  }

  return (
    <div
      className="flex"
      style={{ height: 'calc(100vh - 64px)', fontFamily: 'Cairo, sans-serif' }}
      dir="rtl"
    >
      {/* ── Sidebar (desktop only, right side in RTL) ───────────────────── */}
      <aside
        className="hidden md:flex flex-col w-72 overflow-y-auto"
        style={{
          backgroundColor: '#FFFFFF',
          borderLeft:      '1px solid #E5E7EB',
          flexShrink:      0,
        }}
      >
        {route ? (
          <>
            {/* Route header */}
            <div className="p-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
              <h2 className="font-bold text-base" style={{ color: '#1B2A4A' }}>
                {route.nameAr}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                {route.nameEn}
              </p>
              <span
                className="inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
              >
                التعريفة: {route.fare?.min}–{route.fare?.max} جنيه
              </span>
            </div>

            {/* All stations — including zero-coord ones (shown greyed out) */}
            <div className="p-4">
              <p className="text-xs font-semibold mb-3" style={{ color: '#6B7280' }}>
                محطات الخط ({visibleStations.length})
              </p>
              <ol className="flex flex-col gap-2.5">
                {visibleStations.map((s, i) => {
                  const hasCoords = s.coords?.lat !== 0 && s.coords?.lng !== 0
                  const stationId = s?._id ? String(s._id) : null
                  const isFirst   = i === 0
                  const isLast    = i === visibleStations.length - 1
                  const isMatchedOrigin = matchedOriginId && stationId === matchedOriginId
                  const isMatchedDestination = matchedDestinationId && stationId === matchedDestinationId
                  const isMatched = isMatchedOrigin || isMatchedDestination
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <span
                        className="text-xs font-bold mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: isMatchedOrigin ? '#F4A833' : isMatchedDestination ? '#1B2A4A' : isFirst ? '#FDE7BF' : isLast ? '#DBEAFE' : '#E5E7EB',
                          color:           isMatched || isFirst || isLast ? '#1B2A4A' : '#6B7280',
                          fontSize:        10,
                        }}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p
                          className="text-sm font-medium leading-tight"
                          style={{ color: hasCoords ? '#1B2A4A' : '#9CA3AF', fontWeight: isMatched ? 700 : 500 }}
                        >
                          {s.nameAr}
                        </p>
                        {isMatched && (
                          <span
                            className="inline-block text-xs px-1.5 py-0.5 rounded mt-0.5 ml-1"
                            style={{
                              backgroundColor: isMatchedOrigin ? '#FEF3C7' : '#DBEAFE',
                              color: isMatchedOrigin ? '#92400E' : '#1E3A8A',
                            }}
                          >
                            {isMatchedOrigin ? 'من هنا' : 'إلى هنا'}
                          </span>
                        )}
                        {!hasCoords && (
                          <span
                            className="inline-block text-xs px-1.5 py-0.5 rounded mt-0.5"
                            style={{ backgroundColor: '#F3F4F6', color: '#9CA3AF' }}
                          >
                            إحداثيات غير محددة
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          </>
        ) : (
          <div className="p-6 text-center">
            <p className="text-sm" style={{ color: '#9CA3AF' }}>
              اختار خط من البحث لتراه على الخريطة
            </p>
          </div>
        )}
      </aside>

      {/* ── Map area ────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <MapContainer
          center={[31.2001, 29.9187]}
          zoom={12}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Auto-fit when route loads */}
          {polylineCoords.length >= 2 && <FitBounds coords={polylineCoords} />}

          {/* Route polyline */}
          {polylineCoords.length >= 2 && (
            <Polyline
              positions={polylineCoords}
              pathOptions={{ color: '#1B2A4A', weight: 5, opacity: 0.85 }}
            />
          )}

          {highlightGeometryCoords.length >= 2 && (
            <Polyline
              positions={highlightGeometryCoords}
              pathOptions={{ color: '#F4A833', weight: 7, opacity: 0.95 }}
            />
          )}

          {/* Station circle markers — only for validStations (lat !== 0 && lng !== 0) */}
          {route && validStations.map((s, i) => {
            const stationId = s?._id ? String(s._id) : null
            const isEndpoint = i === 0 || i === validStations.length - 1
            const isMatchedOrigin = matchedOriginId && stationId === matchedOriginId
            const isMatchedDestination = matchedDestinationId && stationId === matchedDestinationId
            const isMatched = isMatchedOrigin || isMatchedDestination
            const markerStyle = getPointMarkerStyle({
              isEndpoint,
              isMatchedOrigin,
              isMatchedDestination,
            })
            return (
              <Fragment key={i}>
                <CircleMarker
                  center={[s.coords.lat, s.coords.lng]}
                  radius={markerStyle.outerRadius}
                  pathOptions={{
                    fillColor: markerStyle.outerFill,
                    color: markerStyle.outerStroke,
                    weight: isMatched ? 3 : 2,
                    fillOpacity: isMatched ? 0.92 : 0.85,
                    opacity: 1,
                  }}
                />
                <CircleMarker
                  center={[s.coords.lat, s.coords.lng]}
                  radius={markerStyle.innerRadius}
                  pathOptions={{
                    fillColor: markerStyle.innerFill,
                    color: markerStyle.innerStroke,
                    weight: 2,
                    fillOpacity: 1,
                    opacity: 1,
                  }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'Cairo, sans-serif', direction: 'rtl', textAlign: 'right', minWidth: 120 }}>
                      <strong style={{ color: '#1B2A4A', display: 'block' }}>{s.nameAr}</strong>
                      <span style={{ color: '#6B7280', fontSize: 12 }}>{s.nameEn}</span>
                      {isMatched && (
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: isMatchedOrigin ? '#92400E' : '#1E3A8A' }}>
                          {isMatchedOrigin ? 'نقطة الصعود المطلوبة' : 'نقطة النزول المطلوبة'}
                        </div>
                      )}
                      {!isMatched && isEndpoint && (
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                          {i === 0 ? 'بداية الخط' : 'نهاية الخط'}
                        </div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              </Fragment>
            )
          })}

          {/* Nearest route (dashed) — highlight when no explicit selected route or to emphasize nearest */}
          {nearestRoute && (!route || route.routeId !== nearestRoute.routeId) && nearestPolylineCoords.length > 0 && (
            <>
              {nearestPolylineCoords.length >= 2 && (
                <Polyline
                  positions={nearestPolylineCoords}
                  pathOptions={{ color: '#DC2626', weight: 3, dashArray: '8 6', opacity: 0.9 }}
                />
              )}
              {nearestValidStations.map((s, i) => {
                const isEndpoint = i === 0 || i === nearestValidStations.length - 1
                return (
                  <CircleMarker
                    key={`near-${i}`}
                    center={[s.coords.lat, s.coords.lng]}
                    radius={isEndpoint ? 10 : 6}
                    pathOptions={{
                      fillColor:   '#FEE2E2',
                      color:       '#DC2626',
                      weight:      2,
                      dashArray:   '6 4',
                      fillOpacity: 0.9,
                    }}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'Cairo, sans-serif', direction: 'rtl', textAlign: 'right', minWidth: 120 }}>
                        <strong style={{ color: '#1B2A4A', display: 'block' }}>{s.nameAr}</strong>
                        <span style={{ color: '#6B7280', fontSize: 12 }}>{s.nameEn}</span>
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
            </>
          )}

          {/* User location marker */}
          {userLocation && (
            <CircleMarker
              center={userLocation}
              radius={10}
              pathOptions={{
                fillColor:   '#DC2626',
                color:       '#991B1B',
                weight:      2,
                fillOpacity: 0.95,
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>
                  موقعك الحالي 📍
                </div>
              </Popup>
            </CircleMarker>
          )}
        </MapContainer>

        {/* No route selected — centered card overlay */}
        {!routeId && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 400 }}
          >
            <div
              className="rounded-2xl p-6 text-center shadow-xl pointer-events-auto"
              style={{ backgroundColor: '#FFFFFF', maxWidth: 280 }}
            >
              <p className="font-bold text-base mb-1" style={{ color: '#1B2A4A' }}>
                ابحث عن خط وشوفه على الخريطة
              </p>
              <p className="text-sm mb-4" style={{ color: '#9CA3AF' }}>
                اختار مسارك من صفحة البحث
              </p>
              <button
                onClick={() => navigate('/search')}
                className="px-5 py-2 rounded-xl text-sm font-bold"
                style={{ backgroundColor: '#F4A833', color: '#1B2A4A' }}
              >
                ابحث دلوقتي
              </button>
            </div>
          </div>
        )}

        {/* Loading spinner */}
        {isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 500 }}
          >
            <div
              className="w-10 h-10 rounded-full border-4 animate-spin"
              style={{ borderColor: '#F4A833', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {/* Floating user location button — bottom-left (visual left in RTL) */}
        <button
          onClick={handleLocate}
          className="absolute bottom-6 left-4 z-40 rounded-xl px-4 py-2.5 text-sm font-bold shadow-lg flex items-center gap-2 transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#1B2A4A', color: 'white', fontFamily: 'Cairo, sans-serif' }}
        >
          📍 موقعي الحالي
        </button>

        {/* Location error toast */}
        {locError && (
          <div
            className="absolute bottom-20 left-4 z-40 rounded-xl px-4 py-2 text-sm shadow"
            style={{ backgroundColor: '#FEE2E2', color: '#991B1B', fontFamily: 'Cairo, sans-serif' }}
          >
            {locError}
          </div>
        )}
      </div>
    </div>
  )
}
