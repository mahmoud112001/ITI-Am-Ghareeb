// src/components/RoutePathEditor.jsx
// ---------------------------------------------------------------------------
// Admin sub-panel for managing a route's OSRM path.
// Drop this inside your existing AdminPage route detail / edit modal.
//
// It renders:
//   • A small Leaflet map showing the route (path if available, else stations)
//   • A toolbar: [Edit Waypoints toggle] [Clear Waypoints] [Generate Route] [Clear Path]
//   • Status line: when path was generated, whether it's stale
//
// Dependencies already in your project: react-leaflet, @tanstack/react-query
// New deps: none
// ---------------------------------------------------------------------------

import { useState } from 'react'
import {
  MapContainer, TileLayer, Polyline,
  CircleMarker, Popup,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import WaypointEditor   from './WaypointEditor'
import { useWaypoints } from '../hooks/useWaypoints'
import {
  useGenerateRoutePath,
  useClearRoutePath,
} from '../hooks/useAdminRoutes'

// ── Brand colours (matches MapPage.jsx + your existing admin UI) ──────────────
const BRAND_DARK   = '#1B2A4A'
const BRAND_YELLOW = '#F4A833'
const PATH_BLUE    = '#2563EB'
const STATION_GREY = '#6B7280'
const PURPLE       = '#7C3AED'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive polyline positions from the route, preferring generated path. */
function getPolylineProps(route) {
  if (route.path?.length > 1) {
    return {
      positions:  route.path.map((p) => [p.lat, p.lng]),
      color:      PATH_BLUE,
      weight:     4,
      dashArray:  undefined,
      isPath:     true,
    }
  }

  // Fallback: straight lines through valid stations (same logic as MapPage)
  const stations = (route.stations || [])
    .filter((s) => s.coords?.lat !== 0 && s.coords?.lng !== 0)
    .sort((a, b) => a.order - b.order)

  return {
    positions:  stations.map((s) => [s.coords.lat, s.coords.lng]),
    color:      STATION_GREY,
    weight:     3,
    dashArray:  '6 5',
    isPath:     false,
  }
}

/** Default map centre from origin, first station, or Cairo. */
function getMapCentre(route) {
  if (route.origin?.coords?.lat && route.origin.coords.lat !== 0) {
    return [route.origin.coords.lat, route.origin.coords.lng]
  }
  const first = route.stations?.find((s) => s.coords?.lat !== 0)
  if (first) return [first.coords.lat, first.coords.lng]
  return [30.0444, 31.2357] // Cairo
}

// ── RoutePathEditor ───────────────────────────────────────────────────────────

/**
 * Props:
 *   route        — full route object from the server (including path, waypoints, etc.)
 *   onPathChange — callback fired after a successful generate or clear,
 *                  so the parent can refetch/update its local state.
 *                  Signature: (updatedFields: object) => void
 */
export default function RoutePathEditor({ route, onPathChange }) {
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError]         = useState(null)

  const { waypoints, isDirty, addWaypoint, updateWaypoint, removeWaypoint, resetWaypoints } =
    useWaypoints(route.waypoints || [])

  const generateMutation = useGenerateRoutePath()
  const clearMutation    = useClearRoutePath()

  const isGenerating = generateMutation.isPending
  const isClearing   = clearMutation.isPending

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleToggleEditing() {
    setIsEditing((v) => !v)
    setError(null)
  }

  function handleDiscardWaypoints() {
    resetWaypoints(route.waypoints || [])
    setIsEditing(false)
  }

  function handleGenerate() {
    setError(null)
    generateMutation.mutate(
      { id: route._id, waypoints },
      {
        onSuccess: (data) => {
          // Sync local waypoint state with what was saved
          resetWaypoints(data.waypoints || waypoints)
          setIsEditing(false)
          onPathChange?.({
            pathGeneratedAt: data.pathGeneratedAt,
            pathStale:       false,
            waypoints:       data.waypoints,
          })
        },
        onError: (err) => {
          setError(err?.response?.data?.message || err.message || 'حدث خطأ أثناء توليد المسار')
        },
      }
    )
  }

  function handleClearPath() {
    if (!window.confirm('هل تريد حذف المسار المولّد؟ سيعود الخط لعرض المحطات فقط.')) return
    setError(null)
    clearMutation.mutate(route._id, {
      onSuccess: () => {
        resetWaypoints([])
        setIsEditing(false)
        onPathChange?.({ path: [], pathGeneratedAt: null, pathStale: false, waypoints: [] })
      },
      onError: (err) => {
        setError(err?.response?.data?.message || err.message || 'حدث خطأ أثناء حذف المسار')
      },
    })
  }

  // ── Derived display values ──────────────────────────────────────────────────

  const polylineProps = getPolylineProps(route)
  const centre        = getMapCentre(route)
  const hasPath       = route.path?.length > 1
  const isStale       = route.pathStale && hasPath

  const validStations = (route.stations || []).filter(
    (s) => s.coords?.lat !== 0 && s.coords?.lng !== 0
  )

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        border: `1px solid #E5E7EB`,
        borderRadius: 12,
        overflow: 'hidden',
        fontFamily: 'Cairo, sans-serif',
        direction: 'rtl',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#F9FAFB',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <span style={{ fontWeight: 700, color: BRAND_DARK, fontSize: 14 }}>
            مسار OSRM
          </span>
          {hasPath && (
            <span
              style={{
                marginRight: 8,
                fontSize: 11,
                color: isStale ? '#92400E' : '#065F46',
                backgroundColor: isStale ? '#FEF3C7' : '#D1FAE5',
                padding: '2px 8px',
                borderRadius: 999,
              }}
            >
              {isStale ? '⚠️ تغيّر الخط بعد التوليد' : '✓ مسار محدّث'}
            </span>
          )}
          {!hasPath && (
            <span
              style={{
                marginRight: 8,
                fontSize: 11,
                color: '#6B7280',
                backgroundColor: '#F3F4F6',
                padding: '2px 8px',
                borderRadius: 999,
              }}
            >
              عرض المحطات فقط
            </span>
          )}
        </div>

        {/* ── Toolbar buttons ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>

          {/* Toggle waypoint editing */}
          <button
            onClick={handleToggleEditing}
            disabled={isGenerating || isClearing}
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              border: 'none',
              fontSize: 12,
              fontFamily: 'Cairo, sans-serif',
              cursor: 'pointer',
              backgroundColor: isEditing ? PURPLE : '#E5E7EB',
              color: isEditing ? 'white' : BRAND_DARK,
              fontWeight: 600,
            }}
          >
            {isEditing ? '✓ إيقاف التعديل' : '＋ تعديل نقاط المسار'}
          </button>

          {/* Discard local waypoint changes */}
          {isDirty && (
            <button
              onClick={handleDiscardWaypoints}
              disabled={isGenerating}
              style={{
                padding: '5px 12px',
                borderRadius: 8,
                border: 'none',
                fontSize: 12,
                fontFamily: 'Cairo, sans-serif',
                cursor: 'pointer',
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                fontWeight: 600,
              }}
            >
              تجاهل التغييرات
            </button>
          )}

          {/* Clear all local waypoints */}
          {waypoints.length > 0 && (
            <button
              onClick={() => resetWaypoints([])}
              disabled={isGenerating}
              style={{
                padding: '5px 12px',
                borderRadius: 8,
                border: 'none',
                fontSize: 12,
                fontFamily: 'Cairo, sans-serif',
                cursor: 'pointer',
                backgroundColor: '#F3F4F6',
                color: '#6B7280',
                fontWeight: 600,
              }}
            >
              مسح النقاط ({waypoints.length})
            </button>
          )}

          {/* Generate path via OSRM */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || isClearing}
            style={{
              padding: '5px 14px',
              borderRadius: 8,
              border: 'none',
              fontSize: 12,
              fontFamily: 'Cairo, sans-serif',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              backgroundColor: isGenerating ? '#93C5FD' : BRAND_DARK,
              color: 'white',
              fontWeight: 700,
              opacity: isGenerating ? 0.8 : 1,
            }}
          >
            {isGenerating ? '⏳ جاري التوليد...' : '🗺 توليد المسار'}
          </button>

          {/* Clear generated path */}
          {hasPath && (
            <button
              onClick={handleClearPath}
              disabled={isGenerating || isClearing}
              style={{
                padding: '5px 12px',
                borderRadius: 8,
                border: 'none',
                fontSize: 12,
                fontFamily: 'Cairo, sans-serif',
                cursor: 'pointer',
                backgroundColor: '#F9FAFB',
                color: '#6B7280',
                fontWeight: 600,
                border: '1px solid #E5E7EB',
              }}
            >
              {isClearing ? '...' : 'حذف المسار'}
            </button>
          )}
        </div>
      </div>

      {/* ── Editing instructions ────────────────────────────────────────────── */}
      {isEditing && (
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: '#EDE9FE',
            fontSize: 12,
            color: '#5B21B6',
            borderBottom: '1px solid #DDD6FE',
          }}
        >
          انقر على الخريطة لإضافة نقطة · اسحب النقطة لتغيير موضعها · انقر بالزر الأيمن لحذفها
        </div>
      )}

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: '#FEE2E2',
            color: '#991B1B',
            fontSize: 12,
            borderBottom: '1px solid #FECACA',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Map ─────────────────────────────────────────────────────────────── */}
      <MapContainer
        center={centre}
        zoom={13}
        style={{ height: 420, width: '100%' }}
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Route polyline */}
        {polylineProps.positions.length >= 2 && (
          <Polyline
            positions={polylineProps.positions}
            pathOptions={{
              color:     polylineProps.color,
              weight:    polylineProps.weight,
              dashArray: polylineProps.dashArray,
              opacity:   0.85,
            }}
          />
        )}

        {/* Station markers — always visible */}
        {validStations.map((s, i) => {
          const isEndpoint = i === 0 || i === validStations.length - 1
          return (
            <CircleMarker
              key={`st-${i}`}
              center={[s.coords.lat, s.coords.lng]}
              radius={isEndpoint ? 10 : 7}
              pathOptions={{
                fillColor:   BRAND_YELLOW,
                color:       BRAND_DARK,
                weight:      2,
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'Cairo, sans-serif', direction: 'rtl', minWidth: 120 }}>
                  <strong style={{ color: BRAND_DARK }}>{s.nameAr}</strong>
                  <br />
                  <span style={{ color: '#6B7280', fontSize: 12 }}>{s.nameEn}</span>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}

        {/* Waypoint markers — managed by WaypointEditor */}
        <WaypointEditor
          waypoints={waypoints}
          onAdd={addWaypoint}
          onUpdate={updateWaypoint}
          onRemove={removeWaypoint}
          isEditing={isEditing}
        />
      </MapContainer>

      {/* ── Footer: metadata ────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '8px 16px',
          backgroundColor: '#F9FAFB',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 4,
          fontSize: 11,
          color: '#9CA3AF',
          fontFamily: 'Cairo, sans-serif',
        }}
      >
        <span>
          {hasPath
            ? `${route.path.length} نقطة في المسار · محطات: ${route.stations?.length || 0}`
            : `محطات: ${route.stations?.length || 0} · لا يوجد مسار مولّد`}
        </span>
        {waypoints.length > 0 && (
          <span style={{ color: PURPLE }}>
            نقاط التشكيل: {waypoints.length}{isDirty ? ' (غير محفوظة)' : ''}
          </span>
        )}
        {route.pathGeneratedAt && (
          <span>
            آخر تحديث: {new Date(route.pathGeneratedAt).toLocaleString('ar-EG')}
          </span>
        )}
      </div>
    </div>
  )
}