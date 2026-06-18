// src/components/WaypointEditor.jsx
// ---------------------------------------------------------------------------
// Renders draggable waypoint markers inside an existing MapContainer.
// Also listens for map clicks to add new waypoints (when isEditing=true).
//
// Mount this as a child of <MapContainer> alongside your existing markers.
// It does NOT create its own map — it hooks into the parent map context.
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { useMap, useMapEvents, Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'

// ── Waypoint icon — purple diamond matching your admin UI ─────────────────────
const makeWaypointIcon = (index) =>
  L.divIcon({
    className: '',
    html: `
      <div style="
        position: relative;
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 14px;
          height: 14px;
          background: #7C3AED;
          border: 2px solid white;
          border-radius: 3px;
          transform: rotate(45deg);
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
        "></div>
        <span style="
          position: absolute;
          color: white;
          font-size: 8px;
          font-weight: bold;
          font-family: Cairo, sans-serif;
          pointer-events: none;
          line-height: 1;
        ">${index + 1}</span>
      </div>
    `,
    iconSize:   [22, 22],
    iconAnchor: [11, 11],
  })

// ── Cursor effect: crosshair while editing ────────────────────────────────────
function MapCursorEffect({ isEditing }) {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    container.style.cursor = isEditing ? 'crosshair' : ''
    return () => { container.style.cursor = '' }
  }, [isEditing, map])
  return null
}

// ── Click-to-add handler ──────────────────────────────────────────────────────
function MapClickHandler({ isEditing, onAdd }) {
  useMapEvents({
    click(e) {
      // Prevent adding a waypoint if the click was on a marker
      if (isEditing && !e.originalEvent._waypointHandled) {
        onAdd({ lat: e.latlng.lat, lng: e.latlng.lng })
      }
    },
  })
  return null
}

// ── WaypointEditor ────────────────────────────────────────────────────────────
/**
 * Props:
 *   waypoints  — Array<{lat: number, lng: number}>  Current waypoint list
 *   onAdd      — (coord: {lat, lng}) => void         Called on map click
 *   onUpdate   — (index: number, coord) => void      Called on drag end
 *   onRemove   — (index: number) => void             Called on right-click
 *   isEditing  — boolean                             Enables click/drag/remove
 */
export default function WaypointEditor({
  waypoints = [],
  onAdd,
  onUpdate,
  onRemove,
  isEditing,
}) {
  return (
    <>
      <MapCursorEffect isEditing={isEditing} />
      <MapClickHandler isEditing={isEditing} onAdd={onAdd} />

      {waypoints.map((wp, index) => (
        <Marker
          key={`wp-${index}`}
          position={[wp.lat, wp.lng]}
          icon={makeWaypointIcon(index)}
          draggable={isEditing}
          eventHandlers={{
            dragend(e) {
              const ll = e.target.getLatLng()
              onUpdate(index, { lat: ll.lat, lng: ll.lng })
            },
            // Mark the event so the MapClickHandler doesn't also fire onAdd
            mousedown(e) {
              e.originalEvent._waypointHandled = true
            },
            contextmenu(e) {
              // Prevent the browser context menu
              e.originalEvent.preventDefault()
              if (isEditing) onRemove(index)
            },
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -14]}
            permanent={false}
          >
            <div style={{ fontFamily: 'Cairo, sans-serif', direction: 'rtl', fontSize: 12 }}>
              <strong>نقطة {index + 1}</strong>
              <br />
              <span style={{ color: '#6B7280', fontSize: 11 }}>
                {wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}
              </span>
              {isEditing && (
                <>
                  <br />
                  <span style={{ color: '#DC2626', fontSize: 10 }}>
                    انقر بالزر الأيمن للحذف
                  </span>
                </>
              )}
            </div>
          </Tooltip>
        </Marker>
      ))}
    </>
  )
}