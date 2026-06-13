// src/pages/AdminPage.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMapEvents, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import {
  useAdminStats,
  useAdminRoutes,
  useCreateRoute,
  useUpdateRoute,
  useDeleteRoute,
} from '../hooks/useAdminRoutes'

// ── Fix Leaflet default marker icon (Vite asset pipeline breaks it) ───────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Transport type config ─────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value: 'microbus',           label: 'مشروع'  },
  { value: 'bus',                label: 'أتوبيس' },
  { value: 'tram',               label: 'ترام'   },
  { value: 'train',              label: 'قطار'   },
  { value: 'university_shuttle', label: 'شاتل'   },
]
const TYPE_BADGE = {
  microbus:           { bg: '#FEF3C7', color: '#92400E' },
  bus:                { bg: '#DBEAFE', color: '#1E40AF' },
  tram:               { bg: '#D1FAE5', color: '#065F46' },
  train:              { bg: '#FCE7F3', color: '#9D174D' },
  university_shuttle: { bg: '#EDE9FE', color: '#5B21B6' },
}

// Alexandria centre — default map view
const ALEX_CENTER = [31.2001, 29.9187]

// ── Empty station factory ─────────────────────────────────────────────────────
const EMPTY_STATION = () => ({
  nameAr: '',
  nameEn: '',
  lat: '',
  lng: '',
  allowPickup: true,
  allowDropoff: true,
})

const EMPTY_GEOMETRY_POINT = () => ({
  lat: '',
  lng: '',
})

// ── Empty form ────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  routeId: '',
  type: 'microbus',
  isBidirectional: false,
  fareMin: '', fareMax: '',
  hoursStart: '', hoursEnd: '',
  stations: [EMPTY_STATION(), EMPTY_STATION()],
  geometry: [],
}

function buildRoutePreviewNames(stations = []) {
  if (!stations.length) return { nameAr: '', nameEn: '' }
  const first = stations[0] || {}
  const last = stations[stations.length - 1] || {}
  return {
    nameAr: first.nameAr && last.nameAr ? `${first.nameAr} ← ${last.nameAr}` : '',
    nameEn: first.nameEn && last.nameEn ? `${first.nameEn} → ${last.nameEn}` : '',
  }
}

// ── Nominatim reverse geocode ─────────────────────────────────────────────────
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`,
      { headers: { 'Accept-Language': 'ar' } }
    )
    const data = await res.json()
    // Prefer neighbourhood > suburb > road > city_district > county > display_name
    const a = data.address || {}
    const nameAr =
      a.neighbourhood ||
      a.suburb        ||
      a.road          ||
      a.city_district ||
      a.county        ||
      a.city          ||
      data.display_name?.split(',')[0] ||
      ''
    return nameAr.trim()
  } catch {
    return ''
  }
}

// ── Nominatim forward search (autocomplete) ───────────────────────────────────
async function searchPlaces(query) {
  if (!query || query.length < 2) return []
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&accept-language=ar&countrycodes=eg`,
      { headers: { 'Accept-Language': 'ar' } }
    )
    return await res.json()
  } catch {
    return []
  }
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label }) {
  return (
    <div className="rounded-2xl p-5 flex items-center gap-4 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-2xl font-black" style={{ color: '#1B2A4A' }}>{value ?? '—'}</p>
        <p className="text-xs font-semibold" style={{ color: '#9CA3AF' }}>{label}</p>
      </div>
    </div>
  )
}

// ── Reusable text input ───────────────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text', placeholder = '', readOnly = false }) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1" style={{ color: '#1B2A4A' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
        style={{
          borderColor: '#D1D5DB',
          fontFamily: 'Cairo, sans-serif',
          backgroundColor: readOnly ? '#F9FAFB' : 'white',
        }}
        onFocus={(e) => !readOnly && (e.target.style.borderColor = '#F4A833')}
        onBlur={(e)  => (e.target.style.borderColor = '#D1D5DB')}
      />
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="text-xs font-black uppercase tracking-widest pt-2 pb-1" style={{ color: '#9CA3AF' }}>
      {children}
    </p>
  )
}

// ── Map click handler (inside MapContainer) ───────────────────────────────────
function MapClickHandler({ onPick, onUndo }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
    contextmenu: (e) => {
      if (e.originalEvent?.preventDefault) e.originalEvent.preventDefault()
      onUndo?.()
    },
  })
  return null
}

// ── FlyTo controller (replaces MapUpdater, reacts to flyTo prop) ──────────────
function FlyToController({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 1 })
  }, [lat, lng]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function FitMapToPoints({ points }) {
  const map = useMap()

  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(points, { padding: [30, 30] })
      return
    }

    if (points.length === 1) {
      map.flyTo(points[0], Math.max(map.getZoom(), 15), { duration: 0.6 })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

function toNumberOrEmpty(value) {
  if (value === '' || value == null) return ''
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : ''
}

function toLatLngPoint(point) {
  const lat = toNumberOrEmpty(point?.lat)
  const lng = toNumberOrEmpty(point?.lng)
  if (lat === '' || lng === '') return null
  return { lat, lng }
}

function toPolylinePositions(points = []) {
  return points
    .map(toLatLngPoint)
    .filter(Boolean)
    .map((point) => [point.lat, point.lng])
}

function clonePoints(points = []) {
  return points.map((point) => ({ ...point }))
}

function arePointListsEqual(left = [], right = []) {
  if (left.length !== right.length) return false

  return left.every((point, index) => (
    point.lat === right[index]?.lat && point.lng === right[index]?.lng
  ))
}

function isTypingTarget(target) {
  const targetTag = target?.tagName?.toLowerCase()
  return targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select' || target?.isContentEditable
}

function buildGeometryFromStations(stations = []) {
  return stations
    .map((station) => toLatLngPoint(station))
    .filter(Boolean)
    .map((point) => ({
      lat: point.lat.toFixed(6),
      lng: point.lng.toFixed(6),
    }))
}

// ── Map picker modal (with reverse geocoding + place search) ──────────────────
function MapPickerModal({
  initialLat,
  initialLng,
  stationLabel,
  onConfirm,   // (lat, lng, nameAr) => void
  onClose,
}) {
  const startLat = initialLat && initialLat !== '' ? Number(initialLat) : ALEX_CENTER[0]
  const startLng = initialLng && initialLng !== '' ? Number(initialLng) : ALEX_CENTER[1]

  const [picked,        setPicked]        = useState({ lat: startLat, lng: startLng })
  const [resolvedName,  setResolvedName]  = useState('')   // Arabic name from reverse geocode
  const [isGeocoding,   setIsGeocoding]   = useState(false)

  // ── Search state ──────────────────────────────────────────────────────────
  const [searchQuery,   setSearchQuery]   = useState('')
  const [suggestions,   setSuggestions]   = useState([])
  const [isSearching,   setIsSearching]   = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchTimeout   = useRef(null)
  const searchRef       = useRef(null)

  // ── Fly-to trigger (only changes when user picks from suggestions) ────────
  const [flyTo, setFlyTo] = useState(null)

  // ── Reverse geocode whenever picked coords change ─────────────────────────
  useEffect(() => {
    setIsGeocoding(true)
    setResolvedName('')
    reverseGeocode(picked.lat, picked.lng).then((name) => {
      setResolvedName(name)
      setIsGeocoding(false)
    })
  }, [picked.lat, picked.lng])

  // ── Debounced place search ────────────────────────────────────────────────
  function handleSearchInput(value) {
    setSearchQuery(value)
    clearTimeout(searchTimeout.current)
    if (!value || value.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    setIsSearching(true)
    searchTimeout.current = setTimeout(async () => {
      const results = await searchPlaces(value)
      setSuggestions(results)
      setShowSuggestions(true)
      setIsSearching(false)
    }, 400)
  }

  function handleSuggestionPick(place) {
    const lat = parseFloat(place.lat)
    const lng = parseFloat(place.lon)
    setPicked({ lat, lng })
    setFlyTo({ lat, lng })
    setSearchQuery(place.display_name.split(',')[0])
    setSuggestions([])
    setShowSuggestions(false)
  }

  // ── GPS ───────────────────────────────────────────────────────────────────
  function getCurrentLocation() {
    if (!navigator.geolocation) { alert('المتصفح لا يدعم تحديد الموقع'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setPicked({ lat, lng })
        setFlyTo({ lat, lng })
      },
      () => alert('تعذر الحصول على الموقع الحالي'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // ── Map click/drag handler ────────────────────────────────────────────────
  function handleMapPick(lat, lng) {
    setPicked({ lat, lng })
    // Don't trigger FlyToController for manual clicks — map is already there
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-xl"
        style={{ backgroundColor: '#FFFFFF', fontFamily: 'Cairo, sans-serif' }}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: '#1B2A4A' }}>اختر الموقع من الخريطة</h3>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{stationLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Search box ── */}
        <div
          className="px-5 py-3"
          style={{ borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', position: 'relative' }}
          ref={searchRef}
        >
          <div className="relative">
            {/* Search icon */}
            <span className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400 pointer-events-none">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="ابحث عن مكان… (مثال: محطة مصر، الإسكندرية)"
              className="w-full rounded-lg border px-3 py-2 pr-9 text-sm outline-none"
              style={{ borderColor: '#D1D5DB', fontFamily: 'Cairo, sans-serif' }}
              onFocus={(e) => { e.target.style.borderColor = '#F4A833'; suggestions.length > 0 && setShowSuggestions(true) }}
              onBlur={(e)  => { e.target.style.borderColor = '#D1D5DB'; setTimeout(() => setShowSuggestions(false), 200) }}
            />
            {isSearching && (
              <span className="absolute top-1/2 -translate-y-1/2 left-3">
                <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: '#F4A833', borderTopColor: 'transparent' }} />
              </span>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute left-5 right-5 rounded-xl shadow-lg overflow-hidden z-10 mt-1"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', top: '100%', zIndex: 9999 }}
            >
              {suggestions.map((place) => (
                <button
                  key={place.place_id}
                  onMouseDown={() => handleSuggestionPick(place)}
                  className="w-full text-right px-4 py-2.5 text-sm hover:bg-amber-50 flex items-start gap-2 transition-colors"
                  style={{ color: '#1B2A4A', borderBottom: '1px solid #F3F4F6' }}
                >
                  <span className="mt-0.5 shrink-0" style={{ color: '#F4A833' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <span className="leading-snug">
                    <span className="font-semibold block">{place.display_name.split(',')[0]}</span>
                    <span className="text-xs block" style={{ color: '#9CA3AF' }}>
                      {place.display_name.split(',').slice(1, 3).join('،')}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* GPS button */}
        <div className="px-5 py-2 flex justify-center" style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
          <button
            onClick={getCurrentLocation}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold hover:opacity-80"
            style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}
          >
            📍 استخدام موقعي الحالي
          </button>
        </div>

        {/* Map */}
        <div style={{ height: 300 }}>
          <MapContainer center={[picked.lat, picked.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {flyTo && <FlyToController lat={flyTo.lat} lng={flyTo.lng} />}
            <MapClickHandler onPick={handleMapPick} />
            <Marker
              position={[picked.lat, picked.lng]}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const pos = e.target.getLatLng()
                  setPicked({ lat: pos.lat, lng: pos.lng })
                },
              }}
            />
          </MapContainer>
        </div>

        {/* Coordinates + resolved name */}
        <div
          className="px-5 py-3 flex flex-col gap-1"
          style={{ backgroundColor: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}
        >
          {/* Arabic name from reverse geocode */}
          <div className="flex items-center gap-2 min-h-5">
            {isGeocoding ? (
              <span className="text-xs" style={{ color: '#9CA3AF' }}>جاري التعرف على المكان…</span>
            ) : resolvedName ? (
              <>
                <span className="text-xs font-bold" style={{ color: '#1B2A4A' }}>🏷 {resolvedName}</span>
                <span className="text-xs" style={{ color: '#9CA3AF' }}>سيُستخدم اسمًا للمحطة</span>
              </>
            ) : null}
          </div>
          {/* Raw coords */}
          <span className="text-xs font-mono" style={{ color: '#9CA3AF' }}>
            {picked.lat.toFixed(6)}, {picked.lng.toFixed(6)} — انقر أو اسحب العلامة لتحديد الموقع
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold border-2"
            style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
          >
            إلغاء
          </button>
          <button
            onClick={() =>
              onConfirm(
                picked.lat.toFixed(6),
                picked.lng.toFixed(6),
                resolvedName   // ← Arabic name passed back
              )
            }
            disabled={isGeocoding}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: '#F4A833', color: '#1B2A4A' }}
          >
            {isGeocoding ? 'جاري التعرف…' : 'تأكيد الموقع'}
          </button>
        </div>
      </div>
    </div>
  )
}

function GeometryEditorModal({
  initialGeometry = [],
  stations = [],
  onConfirm,
  onClose,
}) {
  const [points, setPoints] = useState(
    initialGeometry.length ? initialGeometry : buildGeometryFromStations(stations),
  )
  const [history, setHistory] = useState([])

  const stopPositions = toPolylinePositions(stations)
  const geometryPositions = toPolylinePositions(points)
  const fitPoints = geometryPositions.length ? geometryPositions : stopPositions

  function applyPointsChange(updater) {
    setPoints((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      const nextSnapshot = clonePoints(next)

      if (arePointListsEqual(current, nextSnapshot)) {
        return current
      }

      setHistory((entries) => [...entries, clonePoints(current)])
      return nextSnapshot
    })
  }

  function undoLastAction() {
    setHistory((entries) => {
      if (entries.length === 0) return entries

      const previous = entries[entries.length - 1]
      setPoints(clonePoints(previous))
      return entries.slice(0, -1)
    })
  }

  function removeLastPoint() {
    applyPointsChange((current) => current.slice(0, -1))
  }

  useEffect(() => {
    function handleShortcut(event) {
      if (isTypingTarget(event.target)) return

      const isUndoShortcut = (event.ctrlKey || event.metaKey) && event.code === 'KeyZ'
      const isRemoveLastShortcut = event.code === 'Backspace' || event.code === 'Delete'
      const isResetShortcut = event.altKey && event.code === 'KeyR'
      const isClearShortcut = event.altKey && event.code === 'KeyX'

      if (isUndoShortcut) {
        event.preventDefault()
        undoLastAction()
        return
      }

      if (isRemoveLastShortcut) {
        event.preventDefault()
        removeLastPoint()
        return
      }

      if (isResetShortcut) {
        event.preventDefault()
        resetFromStops()
        return
      }

      if (isClearShortcut) {
        event.preventDefault()
        applyPointsChange([])
      }
    }

    document.addEventListener('keydown', handleShortcut, true)
    return () => document.removeEventListener('keydown', handleShortcut, true)
  }, [history])

  function addPoint(lat, lng) {
    applyPointsChange((current) => [
      ...current,
      { lat: Number(lat).toFixed(6), lng: Number(lng).toFixed(6) },
    ])
  }

  function updatePoint(index, nextValues) {
    applyPointsChange((current) =>
      current.map((point, pointIndex) =>
        pointIndex === index ? { ...point, ...nextValues } : point,
      ),
    )
  }

  function movePoint(index, direction) {
    applyPointsChange((current) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current
      }

      const nextPoints = [...current]
      const [point] = nextPoints.splice(index, 1)
      nextPoints.splice(targetIndex, 0, point)
      return nextPoints
    })
  }

  function removePoint(index) {
    applyPointsChange((current) => current.filter((_, pointIndex) => pointIndex !== index))
  }

  function resetFromStops() {
    applyPointsChange(buildGeometryFromStations(stations))
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-6xl rounded-2xl overflow-hidden shadow-xl flex flex-col"
        style={{ backgroundColor: '#FFFFFF', height: '80vh', fontFamily: 'Cairo, sans-serif' }}
        dir="rtl"
      >
        <div className="flex justify-between items-center px-5 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: '#1B2A4A' }}>رسم مسار الخط</h3>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
              اضغط على الخريطة لإضافة نقاط على الشوارع، ثم اسحبها أو غيّر ترتيبها من القائمة.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 grid lg:grid-cols-[1.5fr,1fr]">
          <div className="min-h-[320px] lg:min-h-0 lg:h-full">
            <MapContainer center={ALEX_CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {fitPoints.length > 0 && <FitMapToPoints points={fitPoints} />}
              <MapClickHandler
                onPick={addPoint}
                onUndo={removeLastPoint}
              />

              {stopPositions.length >= 2 && (
                <Polyline
                  positions={stopPositions}
                  pathOptions={{ color: '#CBD5E1', weight: 3, dashArray: '6 4', opacity: 0.8 }}
                />
              )}

              {stations.map((station, index) => {
                const point = toLatLngPoint(station)
                if (!point) return null
                const isFirst = index === 0
                const isLast = index === stations.length - 1

                return (
                  <CircleMarker
                    key={`stop-${index}`}
                    center={[point.lat, point.lng]}
                    radius={isFirst || isLast ? 8 : 6}
                    pathOptions={{
                      fillColor: isFirst ? '#10B981' : isLast ? '#DC2626' : '#64748B',
                      color: '#FFFFFF',
                      weight: 2,
                      fillOpacity: 0.95,
                    }}
                  />
                )
              })}

              {geometryPositions.length >= 2 && (
                <Polyline
                  positions={geometryPositions}
                  pathOptions={{ color: '#1B2A4A', weight: 5, opacity: 0.9 }}
                />
              )}

              {points.map((point, index) => {
                const latLng = toLatLngPoint(point)
                if (!latLng) return null

                return (
                  <Marker
                    key={`geometry-${index}`}
                    position={[latLng.lat, latLng.lng]}
                    draggable
                    eventHandlers={{
                      dragend: (event) => {
                        const position = event.target.getLatLng()
                        updatePoint(index, {
                          lat: position.lat.toFixed(6),
                          lng: position.lng.toFixed(6),
                        })
                      },
                    }}
                  />
                )
              })}
            </MapContainer>
          </div>

          <div className="border-r p-4 flex flex-col gap-3 overflow-y-auto min-h-0" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={resetFromStops}
                className="rounded-lg px-3 py-2 text-xs font-semibold"
                style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}
                title="Alt+R"
              >
                استخدم المحطات كأساس
                <span className="mr-2 text-[11px] opacity-70">Alt+R</span>
              </button>
              <button
                onClick={() => applyPointsChange([])}
                className="rounded-lg px-3 py-2 text-xs font-semibold"
                style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}
                title="Alt+X"
              >
                مسح الكل
                <span className="mr-2 text-[11px] opacity-70">Alt+X</span>
              </button>
              <button
                onClick={undoLastAction}
                disabled={history.length === 0}
                className="rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40"
                style={{ backgroundColor: '#F3F4F6', color: '#4B5563' }}
                title="Ctrl+Z / Cmd+Z"
              >
                تراجع
                <span className="mr-2 text-[11px] opacity-70">Ctrl+Z</span>
              </button>
              <button
                onClick={removeLastPoint}
                disabled={points.length === 0}
                className="rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40"
                style={{ backgroundColor: '#F3F4F6', color: '#4B5563' }}
                title="Backspace / Delete / Right Click"
              >
                حذف آخر نقطة
                <span className="mr-2 text-[11px] opacity-70">⌫ / Right Click</span>
              </button>
            </div>

            <div
              className="rounded-xl p-3"
              style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
            >
              <p className="text-xs font-bold mb-1" style={{ color: '#6B7280' }}>
                نقاط المسار الحالية: {points.length}
              </p>
              <p className="text-xs leading-6" style={{ color: '#6B7280' }}>
                الخط الرمادي المتقطع = ترتيب المحطات
                <br />
                الخط الأزرق = المسار الفعلي الذي سيرسم على الخريطة
              </p>
            </div>

            {points.length === 0 ? (
              <div
                className="rounded-xl p-4 text-sm"
                style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', color: '#92400E' }}
              >
                لا توجد نقاط مسار بعد. اضغط على الخريطة أو استخدم زر «استخدم المحطات كأساس».
              </div>
            ) : (
              points.map((point, index) => (
                <div
                  key={`point-row-${index}`}
                  className="rounded-xl p-3 flex flex-col gap-2"
                  style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: '#1B2A4A' }}>
                      نقطة المسار {index + 1}
                    </span>
                    <button
                      onClick={() => removePoint(index)}
                      className="text-xs font-semibold"
                      style={{ color: '#DC2626' }}
                    >
                      حذف
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      label="Lat"
                      value={point.lat}
                      onChange={(value) => updatePoint(index, { lat: value })}
                      type="number"
                    />
                    <Field
                      label="Lng"
                      value={point.lng}
                      onChange={(value) => updatePoint(index, { lng: value })}
                      type="number"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => movePoint(index, -1)}
                      disabled={index === 0}
                      className="flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold disabled:opacity-40"
                      style={{ backgroundColor: '#E5E7EB', color: '#374151' }}
                    >
                      لأعلى
                    </button>
                    <button
                      onClick={() => movePoint(index, 1)}
                      disabled={index === points.length - 1}
                      className="flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold disabled:opacity-40"
                      style={{ backgroundColor: '#E5E7EB', color: '#374151' }}
                    >
                      لأسفل
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4" style={{ borderTop: '1px solid #E5E7EB' }}>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold border-2"
            style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
          >
            إلغاء
          </button>
          <button
            onClick={() => onConfirm(points)}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold hover:opacity-80"
            style={{ backgroundColor: '#F4A833', color: '#1B2A4A' }}
          >
            اعتماد المسار
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Route form modal (add & edit) ─────────────────────────────────────────────
function RouteFormModal({ initial, onClose, onSave, title, isPending }) {
  const [form, setForm]           = useState(initial || EMPTY_FORM)
  const [err,  setErr]            = useState('')
  const [mapPicker, setMapPicker] = useState(null) // { stationIndex, label }
  const [geometryEditorOpen, setGeometryEditorOpen] = useState(false)

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })) }

  function setStation(index, key, val) {
    setForm((f) => {
      const stations = f.stations.map((s, i) => i === index ? { ...s, [key]: val } : s)
      return { ...f, stations }
    })
  }

  function addStation() {
    setForm((f) => ({ ...f, stations: [...f.stations, EMPTY_STATION()] }))
  }

  function removeStation(index) {
    setForm((f) => {
      if (f.stations.length <= 2) return f
      return { ...f, stations: f.stations.filter((_, i) => i !== index) }
    })
  }

  function openMapPicker(index, label) { setMapPicker({ index, label }) }

  // ── Updated: now receives nameAr from reverse geocode ─────────────────────
  function handleMapConfirm(lat, lng, resolvedNameAr) {
    setStation(mapPicker.index, 'lat', lat)
    setStation(mapPicker.index, 'lng', lng)
    // Only auto-fill nameAr if it's currently empty (don't overwrite user input)
    if (resolvedNameAr && !form.stations[mapPicker.index]?.nameAr) {
      setStation(mapPicker.index, 'nameAr', resolvedNameAr)
    }
    setMapPicker(null)
  }

  function handleSave() {
    if (!form.routeId)                                     { setErr('يرجى ملء معرف الخط');         return }
    if (!form.fareMin || !form.fareMax)                 { setErr('يرجى إدخال التعريفة');         return }
    if (form.stations.some((s) => !s.nameAr || !s.nameEn)) { setErr('يرجى ملء أسماء جميع المحطات'); return }
    if (form.stations.some((s) => s.allowPickup === false && s.allowDropoff === false)) {
      setErr('كل نقطة لازم تسمح بالركوب أو النزول أو الاثنين')
      return
    }
    if ((form.geometry || []).filter((point) => toLatLngPoint(point)).length < 2) {
      setErr('ارسم مسار الخط على الخريطة أو استخدم المحطات كأساس للمسار')
      return
    }

    setErr('')

    const stations = form.stations.map((s, i) => ({
      order:  i + 1,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      coords: { lat: s.lat !== '' ? Number(s.lat) : 0, lng: s.lng !== '' ? Number(s.lng) : 0 },
      allowPickup: s.allowPickup !== false,
      allowDropoff: s.allowDropoff !== false,
    }))
    const geometry = (form.geometry || [])
      .map(toLatLngPoint)
      .filter(Boolean)
      .map((point) => [point.lng, point.lat])

    onSave({
      routeId:        form.routeId,
      type:           form.type,
      isBidirectional: form.isBidirectional === true,
      fare:           { min: Number(form.fareMin), max: Number(form.fareMax) },
      operatingHours: { start: form.hoursStart, end: form.hoursEnd },
      stops:          stations,
      geometry:       { type: 'LineString', coordinates: geometry },
    })
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-3 md:px-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="w-full max-w-6xl rounded-2xl overflow-hidden shadow-xl flex flex-col"
          style={{ backgroundColor: '#FFFFFF', maxHeight: '90vh', fontFamily: 'Cairo, sans-serif' }}
          dir="rtl"
        >
          <div className="flex justify-between items-center px-4 py-4 md:px-6 md:py-5" style={{ borderBottom: '1px solid #E5E7EB' }}>
            <h2 className="text-lg font-bold" style={{ color: '#1B2A4A' }}>{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
            <div className="flex flex-col gap-3">
              <SectionLabel>معلومات الخط</SectionLabel>
              <Field label="معرف الخط *"          value={form.routeId} onChange={(v) => set('routeId', v)} placeholder="ALEX-MICRO-01" />

              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: '#1B2A4A' }}>النوع</label>
                <select
                  value={form.type}
                  onChange={(e) => set('type', e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: '#D1D5DB', fontFamily: 'Cairo, sans-serif' }}
                >
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#1B2A4A' }}>
                <input
                  type="checkbox"
                  checked={form.isBidirectional === true}
                  onChange={(e) => set('isBidirectional', e.target.checked)}
                />
                الخط يعمل في الاتجاهين
              </label>

              <div className="rounded-xl p-3" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                <p className="text-xs font-bold mb-2" style={{ color: '#6B7280' }}>اسم الخط يتولد تلقائياً من أول وآخر نقطة</p>
                <p className="text-sm font-bold" style={{ color: '#1B2A4A' }}>
                  {buildRoutePreviewNames(form.stations).nameAr || 'أدخل أول وآخر نقطة'}
                </p>
                <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                  {buildRoutePreviewNames(form.stations).nameEn || 'Enter first and last stop'}
                </p>
              </div>

              <SectionLabel>التعريفة والمواعيد</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <Field label="أدنى تعريفة *" value={form.fareMin}    onChange={(v) => set('fareMin',    v)} type="number" placeholder="8" />
                <Field label="أقصى تعريفة *" value={form.fareMax}    onChange={(v) => set('fareMax',    v)} type="number" placeholder="12" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="بداية التشغيل" value={form.hoursStart} onChange={(v) => set('hoursStart', v)} placeholder="6:00" />
                <Field label="نهاية التشغيل" value={form.hoursEnd}   onChange={(v) => set('hoursEnd',   v)} placeholder="23:00" />
              </div>

              <SectionLabel>المحطات — الأولى هي الانطلاق، الأخيرة هي الوصول</SectionLabel>

              {form.stations.map((station, i) => {
                const isFirst     = i === 0
                const isLast      = i === form.stations.length - 1
                const stationLabel = isFirst ? '🟢 نقطة الانطلاق' : isLast ? '🔴 نقطة الوصول' : `محطة ${i + 1}`
                const borderColor  = isFirst ? '#D1FAE5' : isLast ? '#FEE2E2' : '#E5E7EB'
                const hasCoords    = station.lat !== '' && station.lng !== ''

                return (
                  <div key={i} className="rounded-xl p-3 flex flex-col gap-2" style={{ backgroundColor: '#F9FAFB', border: `2px solid ${borderColor}` }}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold" style={{ color: '#374151' }}>{stationLabel}</span>
                      {!isFirst && !isLast && form.stations.length > 2 && (
                        <button onClick={() => removeStation(i)} className="text-xs font-semibold" style={{ color: '#DC2626' }}>حذف</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="بالعربي *"    value={station.nameAr} onChange={(v) => setStation(i, 'nameAr', v)} placeholder="محطة مصر" />
                      <Field label="بالإنجليزي *" value={station.nameEn} onChange={(v) => setStation(i, 'nameEn', v)} placeholder="Misr Station" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="خط العرض (Lat)" value={station.lat} onChange={(v) => setStation(i, 'lat', v)} type="number" placeholder="31.2001" />
                      <Field label="خط الطول (Lng)" value={station.lng} onChange={(v) => setStation(i, 'lng', v)} type="number" placeholder="29.9187" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#374151' }}>
                        <input
                          type="checkbox"
                          checked={station.allowPickup !== false}
                          onChange={(e) => setStation(i, 'allowPickup', e.target.checked)}
                        />
                        يسمح بالركوب من هنا
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#374151' }}>
                        <input
                          type="checkbox"
                          checked={station.allowDropoff !== false}
                          onChange={(e) => setStation(i, 'allowDropoff', e.target.checked)}
                        />
                        يسمح بالنزول هنا
                      </label>
                    </div>
                    <button
                      onClick={() => openMapPicker(i, stationLabel)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold w-full justify-center transition-opacity hover:opacity-80"
                      style={{ backgroundColor: hasCoords ? '#D1FAE5' : '#FEF3C7', color: hasCoords ? '#065F46' : '#92400E' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" />
                      </svg>
                      {hasCoords ? `📍 ${Number(station.lat).toFixed(4)}, ${Number(station.lng).toFixed(4)}` : 'اختر من الخريطة'}
                    </button>
                  </div>
                )
              })}

              <button
                onClick={addStation}
                className="w-full rounded-xl py-2 text-sm font-semibold border-2 border-dashed hover:opacity-70"
                style={{ borderColor: '#F4A833', color: '#F4A833' }}
              >
                + إضافة محطة
              </button>

              <SectionLabel>مسار الخط على الشوارع</SectionLabel>
              <div
                className="rounded-xl p-3 flex flex-col gap-3"
                style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
              >
                <p className="text-xs leading-6" style={{ color: '#6B7280' }}>
                  المحطات تظل للركوب والنزول والبحث.
                  <br />
                  المسار يرسم الطريق الفعلي على الخريطة كنقاط هندسية مستقلة.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setGeometryEditorOpen(true)}
                    className="rounded-lg px-3 py-2 text-xs font-semibold hover:opacity-80"
                    style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}
                  >
                    {form.geometry?.length ? 'تعديل المسار على الخريطة' : 'رسم المسار على الخريطة'}
                  </button>
                  <button
                    onClick={() => set('geometry', buildGeometryFromStations(form.stations))}
                    className="rounded-lg px-3 py-2 text-xs font-semibold hover:opacity-80"
                    style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                  >
                    أنشئ المسار من المحطات
                  </button>
                  <button
                    onClick={() => set('geometry', [])}
                    className="rounded-lg px-3 py-2 text-xs font-semibold hover:opacity-80"
                    style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}
                  >
                    مسح المسار
                  </button>
                </div>
                <p className="text-xs font-semibold" style={{ color: '#374151' }}>
                  عدد نقاط المسار الحالية: {form.geometry?.length || 0}
                </p>
              </div>

              {err && <p className="text-sm text-center mt-3" style={{ color: '#DC2626' }}>{err}</p>}
            </div>
          </div>

          <div className="flex gap-3 px-4 py-4 md:px-6 md:py-5" style={{ borderTop: '1px solid #E5E7EB' }}>
            <button onClick={onClose} disabled={isPending} className="flex-1 rounded-xl py-2.5 text-sm font-semibold border-2" style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>إلغاء</button>
            <button onClick={handleSave} disabled={isPending} className="flex-1 rounded-xl py-2.5 text-sm font-bold hover:opacity-80 disabled:opacity-50" style={{ backgroundColor: '#F4A833', color: '#1B2A4A' }}>
              {isPending ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </div>
      </div>

      {mapPicker && (
        <MapPickerModal
          initialLat={form.stations[mapPicker.index]?.lat}
          initialLng={form.stations[mapPicker.index]?.lng}
          stationLabel={mapPicker.label}
          onConfirm={handleMapConfirm}
          onClose={() => setMapPicker(null)}
        />
      )}
      {geometryEditorOpen && (
        <GeometryEditorModal
          initialGeometry={form.geometry || []}
          stations={form.stations}
          onConfirm={(geometryPoints) => {
            set('geometry', geometryPoints)
            setGeometryEditorOpen(false)
          }}
          onClose={() => setGeometryEditorOpen(false)}
        />
      )}
    </>
  )
}

// ── Delete confirmation dialog ────────────────────────────────────────────────
function DeleteDialog({ routeName, onConfirm, onCancel, isPending }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 text-center"
        style={{ backgroundColor: '#FFFFFF', fontFamily: 'Cairo, sans-serif' }}
        dir="rtl"
      >
        <div className="text-4xl mb-3">⚠️</div>
        <h3 className="text-lg font-bold mb-2" style={{ color: '#1B2A4A' }}>هل متأكد إنك عايز تحذف الخط ده؟</h3>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>{routeName}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isPending} className="flex-1 rounded-xl py-2.5 text-sm font-semibold border-2" style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>إلغاء</button>
          <button onClick={onConfirm} disabled={isPending} className="flex-1 rounded-xl py-2.5 text-sm font-bold disabled:opacity-50" style={{ backgroundColor: '#DC2626', color: 'white' }}>
            {isPending ? 'جاري الحذف...' : 'نعم، احذف'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Build edit form from a route document ─────────────────────────────────────
function buildEditForm(route) {
  return {
    routeId:    route.routeId,
    type:       route.type,
    isBidirectional: route.isBidirectional === true,
    fareMin:    route.fare?.min    ?? '',
    fareMax:    route.fare?.max    ?? '',
    hoursStart: route.operatingHours?.start ?? '',
    hoursEnd:   route.operatingHours?.end   ?? '',
    stations:   route.stops?.length >= 2
      ? route.stops.map((s) => ({
          nameAr: s.nameAr,
          nameEn: s.nameEn,
          lat:    s.coords?.lat != null && s.coords.lat !== 0 ? String(s.coords.lat) : '',
          lng:    s.coords?.lng != null && s.coords.lng !== 0 ? String(s.coords.lng) : '',
          allowPickup: s.allowPickup !== false,
          allowDropoff: s.allowDropoff !== false,
        }))
      : [EMPTY_STATION(), EMPTY_STATION()],
    geometry: route.geometryPoints?.length
      ? route.geometryPoints.map((point) => ({
          lat: point.coords?.lat != null ? String(point.coords.lat) : '',
          lng: point.coords?.lng != null ? String(point.coords.lng) : '',
        }))
      : [],
  }
}

// ── AdminPage ─────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [page,        setPage]        = useState(1)
  const [addOpen,     setAddOpen]     = useState(false)
  const [editRoute,   setEditRoute]   = useState(null)
  const [deleteRoute, setDeleteRoute] = useState(null)

  const { data: statsData }             = useAdminStats()
  const { data: routesData, isLoading } = useAdminRoutes(page)

  const routePairs = routesData?.routes || []
  const totalPages = routesData?.pages  || 1
  const s          = statsData?.stats   || {}

  const createMutation  = useCreateRoute()
  const updateMutation  = useUpdateRoute()
  const deleteMutation  = useDeleteRoute()
  const restoreMutation = useUpdateRoute()

  function handleCreate(body) { createMutation.mutate(body, { onSuccess: () => setAddOpen(false) }) }
  function handleUpdate(body) { updateMutation.mutate({ id: editRoute._id, body }, { onSuccess: () => setEditRoute(null) }) }
  function handleDelete()     { deleteMutation.mutate(deleteRoute._id, { onSuccess: () => setDeleteRoute(null) }) }
  function handleRestore(id)  { restoreMutation.mutate({ id, body: { isActive: true } }) }

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: '#FDF6EC', fontFamily: 'Cairo, sans-serif' }} dir="rtl">
      <div className="max-w-5xl mx-auto px-4 pt-8">

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h1 className="text-2xl font-black" style={{ color: '#1B2A4A' }}>لوحة التحكم</h1>
          <button onClick={() => setAddOpen(true)} className="rounded-xl px-5 py-2.5 text-sm font-bold hover:opacity-80" style={{ backgroundColor: '#F4A833', color: '#1B2A4A' }}>
            ＋ إضافة خط جديد
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon="🚌" value={s.totalRoutes}  label="إجمالي الخطوط" />
          <StatCard icon="👥" value={s.totalUsers}   label="إجمالي المستخدمين" />
          <StatCard icon="⭐" value={s.totalRatings} label="إجمالي التقييمات" />
          <StatCard
            icon="🔍"
            value={s.topSearched?.[0] ? `${s.topSearched[0].origin} ← ${s.topSearched[0].destination}` : '—'}
            label="أكثر مسار مطلوب"
          />
        </div>

        <div className="rounded-2xl overflow-hidden shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="p-5 border-b" style={{ borderColor: '#E5E7EB' }}>
            <h2 className="text-base font-bold" style={{ color: '#1B2A4A' }}>إدارة الخطوط</h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 mx-auto rounded-full border-4 animate-spin" style={{ borderColor: '#F4A833', borderTopColor: 'transparent' }} />
            </div>
          ) : routePairs.length === 0 ? (
            <p className="p-8 text-center text-sm" style={{ color: '#9CA3AF' }}>لا توجد خطوط حتى الآن</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    {['#', 'معرف الخط', 'اسم الخط', 'النوع', 'التعريفة', 'الحالة', 'إجراءات'].map((h) => (
                      <th key={h} className="text-right px-4 py-3 text-xs font-bold" style={{ color: '#6B7280' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {routePairs.map(({ route }, i) => {
                    const badge     = TYPE_BADGE[route.type] || TYPE_BADGE.microbus
                    const typeLabel = TYPE_OPTIONS.find((o) => o.value === route.type)?.label || route.type
                    return (
                      <tr key={route._id} style={{ borderBottom: '1px solid #F3F4F6' }} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs" style={{ color: '#9CA3AF' }}>{(page - 1) * 10 + i + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: '#6B7280' }}>{route.routeId}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: '#1B2A4A', maxWidth: 180 }}>
                          <p className="truncate">{route.nameAr}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: badge.bg, color: badge.color }}>{typeLabel}</span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>
                          {route.fare?.min}–{route.fare?.max} جنيه
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: route.isActive ? '#D1FAE5' : '#FEE2E2', color: route.isActive ? '#065F46' : '#991B1B' }}>
                            {route.isActive ? 'نشط' : 'محذوف'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditRoute({ _id: route._id, form: buildEditForm(route) })}
                              className="p-1.5 rounded-lg hover:opacity-70"
                              style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                              title="تعديل"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            {route.isActive ? (
                              <button
                                onClick={() => setDeleteRoute(route)}
                                className="p-1.5 rounded-lg hover:opacity-70"
                                style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}
                                title="حذف"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                  <path d="M10 11v6M14 11v6" />
                                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRestore(route._id)}
                                disabled={restoreMutation.isPending}
                                className="p-1.5 rounded-lg hover:opacity-70 disabled:opacity-40"
                                style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}
                                title="استعادة"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 p-4" style={{ borderTop: '1px solid #E5E7EB' }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-1.5 rounded-lg text-sm font-semibold border disabled:cursor-not-allowed" style={{ borderColor: '#E5E7EB', color: page === 1 ? '#D1D5DB' : '#1B2A4A' }}>السابق</button>
              <span className="text-sm" style={{ color: '#6B7280' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-1.5 rounded-lg text-sm font-semibold border disabled:cursor-not-allowed" style={{ borderColor: '#E5E7EB', color: page === totalPages ? '#D1D5DB' : '#1B2A4A' }}>التالي</button>
            </div>
          )}
        </div>
      </div>

      {addOpen    && <RouteFormModal title="إضافة خط جديد" onClose={() => setAddOpen(false)} onSave={handleCreate} isPending={createMutation.isPending} />}
      {editRoute  && <RouteFormModal title="تعديل الخط" initial={editRoute.form} onClose={() => setEditRoute(null)} onSave={handleUpdate} isPending={updateMutation.isPending} />}
      {deleteRoute && <DeleteDialog routeName={deleteRoute.nameAr} onCancel={() => setDeleteRoute(null)} onConfirm={handleDelete} isPending={deleteMutation.isPending} />}
    </div>
  )
}
