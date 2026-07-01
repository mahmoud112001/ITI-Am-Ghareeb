import { Fragment, useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { MapContainer, TileLayer, Popup, Polyline, CircleMarker, Marker, useMap } from 'react-leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import { ArrowDown, ArrowRightLeft, ArrowUp, Flag, Play } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../lib/axios'
import { parseTravelPlanSegmentDescriptors } from '../utils/travelPlanMap'
import ar from '../i18n/ar'

const { map: t } = ar

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const userLocationIcon = L.divIcon({
  className: 'am-ghareeb-user-location',
  html: '<span class="am-ghareeb-user-dot"><span class="am-ghareeb-user-pulse"></span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

const nearestStationIcon = L.divIcon({
  className: 'am-ghareeb-nearest-station',
  html: `
    <span class="am-ghareeb-nearest-station__pin">
      <span class="am-ghareeb-nearest-station__core"></span>
    </span>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18],
})

const TRAVEL_SEGMENT_PALETTES = [
  {
    main: '#F59E0B',
    casing: '#9A3412',
    light: '#FFF7E8',
    badgeBg: '#FEF3C7',
    badgeText: '#92400E',
    badgeBorder: '#F4A833',
  },
  {
    main: '#3B82F6',
    casing: '#1D4ED8',
    light: '#EDF5FF',
    badgeBg: '#DBEAFE',
    badgeText: '#1E40AF',
    badgeBorder: '#60A5FA',
  },
  {
    main: '#10B981',
    casing: '#047857',
    light: '#ECFDF5',
    badgeBg: '#D1FAE5',
    badgeText: '#065F46',
    badgeBorder: '#34D399',
  },
  {
    main: '#F43F5E',
    casing: '#BE123C',
    light: '#FFF1F2',
    badgeBg: '#FFE4E6',
    badgeText: '#9F1239',
    badgeBorder: '#FDA4AF',
  },
  {
    main: '#8B5CF6',
    casing: '#6D28D9',
    light: '#F5F3FF',
    badgeBg: '#EDE9FE',
    badgeText: '#5B21B6',
    badgeBorder: '#A78BFA',
  },
  {
    main: '#14B8A6',
    casing: '#0F766E',
    light: '#F0FDFA',
    badgeBg: '#CCFBF1',
    badgeText: '#115E59',
    badgeBorder: '#5EEAD4',
  },
]

const APPROACH_TARGET_MODES = [
  { value: 'route-point', label: 'Nearest route point' },
  { value: 'station', label: 'Nearest station' },
]

function ordinalLabel(index) {
  const labels = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة']
  return labels[index] || `${index + 1}`
}

function getTravelSegmentPalette(index) {
  return TRAVEL_SEGMENT_PALETTES[index % TRAVEL_SEGMENT_PALETTES.length]
}

function FitBounds({ coords }) {
  const map = useMap()
  useEffect(() => {
    if (coords.length >= 2) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] })
    }
  }, [coords, map])
  return null
}

function FlyToLocation({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) {
      map.flyTo(position, 14, { duration: 1.2 })
    }
  }, [position, map])
  return null
}

function getPointMarkerStyle({ isEndpoint, isMatchedOrigin, isMatchedDestination, accent = null, muted = false }) {
  if (muted && !isMatchedOrigin && !isMatchedDestination) {
    if (isEndpoint) {
      return {
        outerRadius: 11,
        innerRadius: 6,
        outerFill: '#F1F5F9',
        outerStroke: '#CBD5E1',
        innerFill: '#64748B',
        innerStroke: '#FFFFFF',
      }
    }

    return {
      outerRadius: 5,
      innerRadius: 2.5,
      outerFill: '#F1F5F9',
      outerStroke: '#CBD5E1',
      innerFill: '#64748B',
      innerStroke: '#FFFFFF',
    }
  }

  if (isMatchedOrigin) {
    return {
      outerRadius: 13,
      innerRadius: 7,
      outerFill: '#FFF7E8',
      outerStroke: accent || '#F4A833',
      innerFill: accent || '#F4A833',
      innerStroke: '#FFFFFF',
    }
  }

  if (isMatchedDestination) {
    return {
      outerRadius: 13,
      innerRadius: 7,
      outerFill: '#EDF5FF',
      outerStroke: accent || '#1B2A4A',
      innerFill: accent || '#1B2A4A',
      innerStroke: '#FFFFFF',
    }
  }

  if (isEndpoint) {
    return {
      outerRadius: 9,
      innerRadius: 4,
      outerFill: '#F8FAFC',
      outerStroke: accent || '#1B2A4A',
      innerFill: accent || '#64748B',
      innerStroke: '#FFFFFF',
    }
  }

  return {
    outerRadius: 8,
    innerRadius: 4,
    outerFill: '#FFFFFF',
    outerStroke: accent || '#CBD5E1',
    innerFill: accent || '#64748B',
    innerStroke: '#FFFFFF',
  }
}

function getMarkerBadge({
  isMatchedOrigin,
  isMatchedDestination,
  travelSegmentTitle = null,
  palette = getTravelSegmentPalette(0),
}) {
  if (isMatchedOrigin) {
    return {
      text: travelSegmentTitle ? `${travelSegmentTitle}: ${t.pickupBadge}` : t.pickupBadge,
      bg: palette.badgeBg,
      color: palette.badgeText,
      border: palette.badgeBorder,
    }
  }

  if (isMatchedDestination) {
    return {
      text: travelSegmentTitle ? `${travelSegmentTitle}: ${t.dropoffBadge}` : t.dropoffBadge,
      bg: palette.light,
      color: palette.casing,
      border: palette.main,
    }
  }

  return null
}

function getTransferMarkerStyle(primaryPalette, secondaryPalette) {
  return {
    outerRadius: 13,
    innerRadius: 7,
    outerFill: '#FFF4E6',
    outerStroke: primaryPalette.casing,
    innerFill: primaryPalette.main,
    innerGradient: `linear-gradient(135deg, ${primaryPalette.main} 0%, ${primaryPalette.main} 48%, ${secondaryPalette.main} 52%, ${secondaryPalette.main} 100%)`,
    innerStroke: '#FFFFFF',
  }
}

function getTransferBadge(primaryPalette, secondaryPalette, transferIndex) {
  return {
    text: t.transferBadge(transferIndex + 1),
    bg: primaryPalette.badgeBg,
    bgImage: `linear-gradient(135deg, ${primaryPalette.badgeBg} 0%, ${primaryPalette.badgeBg} 48%, ${secondaryPalette.badgeBg} 52%, ${secondaryPalette.badgeBg} 100%)`,
    color: primaryPalette.badgeText,
    border: primaryPalette.badgeBorder,
  }
}

function buildBadgeIcon(badge, offsetY = 24) {
  if (!badge) return null

  return L.divIcon({
    className: 'route-map-badge-icon',
    iconSize: [1, 1],
    iconAnchor: [0, 0],
    html: `
      <div class="route-map-badge-marker" style="--badge-offset:${offsetY}px;">
        <span
          class="route-map-badge__pill"
          style="
            --badge-bg:${badge.bg};
            --badge-bg-image:${badge.bgImage || badge.bg};
            --badge-color:${badge.color};
            --badge-border:${badge.border};
          "
        >
          ${badge.text}
        </span>
      </div>
    `,
  })
}

function getStationSymbolMeta(kind, muted = false) {
  const mutedColor = '#FFFFFF'

  switch (kind) {
    case 'start':
      return { Icon: Play, color: muted ? mutedColor : '#FFFFFF', label: t.startPoint }
    case 'end':
      return { Icon: Flag, color: muted ? mutedColor : '#FFFFFF', label: t.endPoint }
    case 'pickup':
      return { Icon: ArrowUp, color: muted ? mutedColor : '#FFFFFF', label: t.pickupPoint }
    case 'dropoff':
      return { Icon: ArrowDown, color: muted ? mutedColor : '#FFFFFF', label: t.dropoffPoint }
    case 'transfer':
      return { Icon: ArrowRightLeft, color: muted ? mutedColor : '#FFFFFF', label: t.transferPoint }
    default:
      return null
  }
}

function buildSemanticStationIcon(kind, markerStyle, muted = false) {
  const meta = getStationSymbolMeta(kind, muted)
  if (!meta) return null

  const isEndpointKind = kind === 'start' || kind === 'end'
  const outerSize = Math.max(
    muted && isEndpointKind ? 26 : 20,
    markerStyle.outerRadius * 2 + (muted ? (isEndpointKind ? 6 : 4) : 6),
  )
  const coreSize = Math.max(11, outerSize - (muted && isEndpointKind ? 10 : muted ? 9 : 10))
  const iconSize = Math.max(
    muted && isEndpointKind ? 10 : muted ? 9 : 10,
    Math.min(muted && isEndpointKind ? 14 : muted ? 13 : 16, Math.round(coreSize * (muted ? 0.58 : 0.68))),
  )
  const svgMarkup = renderToStaticMarkup(
    <meta.Icon size={iconSize} strokeWidth={muted ? 1.7 : 2.3} color={meta.color} absoluteStrokeWidth />,
  )

  return L.divIcon({
    className: 'route-map-semantic-icon',
    iconSize: [outerSize, outerSize],
    iconAnchor: [outerSize / 2, outerSize / 2],
    html: `
      <span
        class="route-map-semantic-marker"
        style="
          --marker-size:${outerSize}px;
          --marker-core-size:${coreSize}px;
          --marker-shell:${markerStyle.outerFill};
          --marker-ring:${markerStyle.outerStroke};
          --marker-core:${markerStyle.innerFill};
          --marker-core-ring:${markerStyle.innerStroke};
          --marker-gradient:${markerStyle.innerGradient || markerStyle.innerFill};
          --marker-shadow:${muted ? '0 1px 3px rgba(15, 23, 42, 0.10)' : '0 4px 10px rgba(15, 23, 42, 0.18)'};
          --marker-icon-opacity:${muted ? 0.94 : 1};
        "
      >
        <span class="route-map-semantic-marker__shell">
          <span class="route-map-semantic-marker__core">
            <span class="route-map-semantic-marker__icon">${svgMarkup}</span>
          </span>
        </span>
      </span>
    `,
  })
}

function RoutePolyline({
  positions,
  palette,
  weight = 6,
  opacity = 0.9,
  dashed = false,
  muted = false,
}) {
  if (!positions?.length || positions.length < 2) return null

  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{
          color: palette.casing,
          weight: muted ? weight + 1.5 : weight + 2,
          opacity: muted ? 0.55 : Math.min(1, opacity),
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: dashed ? '8 7' : undefined,
        }}
      />
      <Polyline
        positions={positions}
        pathOptions={{
          color: palette.main,
          weight,
          opacity: muted ? 0.72 : opacity,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: dashed ? '8 7' : undefined,
        }}
      />
    </>
  )
}

function RouteMapStyles() {
  return (
    <style>
      {`
        .route-map-badge.leaflet-tooltip {
          display: none;
        }

        .am-ghareeb-user-location {
          background: transparent;
          border: 0;
        }

        .am-ghareeb-user-dot {
          position: relative;
          display: inline-flex;
          width: 22px;
          height: 22px;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          background: #2563EB;
          border: 3px solid #FFFFFF;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.22), 0 6px 14px rgba(15, 23, 42, 0.28);
        }

        .am-ghareeb-user-dot::after {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 9999px;
          background: #FFFFFF;
        }

        .am-ghareeb-user-pulse {
          position: absolute;
          inset: -8px;
          border-radius: 9999px;
          background: rgba(37, 99, 235, 0.22);
          animation: am-ghareeb-user-pulse 1.8s ease-out infinite;
          z-index: -1;
        }

        @keyframes am-ghareeb-user-pulse {
          0% {
            transform: scale(0.65);
            opacity: 0.9;
          }
          100% {
            transform: scale(1.75);
            opacity: 0;
          }
        }

        .am-ghareeb-nearest-station {
          background: transparent;
          border: 0;
        }

        .am-ghareeb-nearest-station__pin {
          position: relative;
          display: inline-flex;
          width: 34px;
          height: 34px;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          background: #D1FAE5;
          border: 4px solid #047857;
          box-shadow:
            0 0 0 4px rgba(4, 120, 87, 0.2),
            0 10px 22px rgba(15, 23, 42, 0.24);
        }

        .am-ghareeb-nearest-station__pin::after {
          content: "";
          position: absolute;
          inset: -10px;
          border-radius: 9999px;
          border: 2px solid rgba(4, 120, 87, 0.25);
        }

        .am-ghareeb-nearest-station__core {
          width: 12px;
          height: 12px;
          border-radius: 9999px;
          background: #047857;
          border: 3px solid #FFFFFF;
        }

        .route-map-badge-icon {
          background: transparent;
          border: 0;
        }

        .route-map-badge-marker {
          position: relative;
          width: 1px;
          height: 1px;
          overflow: visible;
        }

        .route-map-semantic-icon {
          background: transparent;
          border: 0;
        }

        .route-map-semantic-marker {
          width: var(--marker-size);
          height: var(--marker-size);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .route-map-semantic-marker__shell {
          width: var(--marker-size);
          height: var(--marker-size);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          background: var(--marker-shell);
          border: 2px solid var(--marker-ring);
          box-shadow: var(--marker-shadow);
        }

        .route-map-semantic-marker__core {
          width: var(--marker-core-size);
          height: var(--marker-core-size);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          background: var(--marker-gradient);
          border: 2px solid var(--marker-core-ring);
        }

        .route-map-semantic-marker__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          opacity: var(--marker-icon-opacity);
        }

        .route-map-semantic-marker svg {
          display: block;
          filter: drop-shadow(0 1px 1px rgba(15, 23, 42, 0.18));
        }

        .route-map-badge__pill {
          position: absolute;
          left: 50%;
          bottom: var(--badge-offset);
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          padding: 3px 10px;
          border-radius: 9999px;
          border: 1px solid var(--badge-border);
          background: var(--badge-bg-image);
          color: var(--badge-color);
          font-family: Cairo, sans-serif;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.1;
          white-space: nowrap;
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.16);
          direction: rtl;
        }

        .route-map-badge__pill::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -6px;
          width: 10px;
          height: 10px;
          background: var(--badge-bg-image);
          border-right: 1px solid var(--badge-border);
          border-bottom: 1px solid var(--badge-border);
          transform: translateX(-50%) rotate(45deg);
        }
      `}
    </style>
  )
}

function normalizeLatLng(point) {
  const lat = Number(Array.isArray(point) ? point[0] : point?.lat)
  const lng = Number(Array.isArray(point) ? point[1] : point?.lng)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  if (lat === 0 && lng === 0) return null

  return { lat, lng }
}

function distanceMetersBetween(pointA, pointB) {
  const coordsA = normalizeLatLng(pointA?.coords || pointA)
  const coordsB = normalizeLatLng(pointB?.coords || pointB)
  if (!coordsA || !coordsB) return Number.POSITIVE_INFINITY

  const toRadians = (value) => (value * Math.PI) / 180
  const earthRadiusMeters = 6371000
  const dLat = toRadians(coordsB.lat - coordsA.lat)
  const dLng = toRadians(coordsB.lng - coordsA.lng)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coordsA.lat)) *
      Math.cos(toRadians(coordsB.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusMeters * c
}

function parseQueryCoords(searchParams, prefix) {
  return normalizeLatLng({
    lat: searchParams.get(`${prefix}Lat`),
    lng: searchParams.get(`${prefix}Lng`),
  })
}

function findNearestGeometryIndex(geometryPoints, target) {
  if (!target?.coords || !geometryPoints.length) return -1

  let bestIndex = -1
  let bestDistance = Number.POSITIVE_INFINITY

  geometryPoints.forEach((point, index) => {
    const score = distanceMetersBetween(point, target)
    if (score < bestDistance) {
      bestDistance = score
      bestIndex = index
    }
  })

  return bestIndex
}

function findNearestPolylineIndex(polylineCoords, target) {
  if (!target?.coords || !polylineCoords.length) return -1

  let bestIndex = -1
  let bestDistance = Number.POSITIVE_INFINITY

  polylineCoords.forEach((point, index) => {
    const score = distanceMetersBetween(point, target)
    if (score < bestDistance) {
      bestDistance = score
      bestIndex = index
    }
  })

  return bestIndex
}

function buildRouteMapState(route, matchedOriginId, matchedDestinationId) {
  const geometryPoints = route?.geometryPoints || []
  const visibleStations = route?.stations || []
  const validStations = visibleStations.filter((s) => s.coords?.lat !== 0 && s.coords?.lng !== 0)
  const firstValidStationId = validStations[0]?._id ? String(validStations[0]._id) : null
  const lastValidStationId = validStations[validStations.length - 1]?._id
    ? String(validStations[validStations.length - 1]._id)
    : null
  const routePathCoords = (!route?.pathStale ? route?.path || [] : [])
    .filter((point) => point?.lat && point?.lng)
    .map((point) => [point.lat, point.lng])
  const geometryPolylineCoords = geometryPoints
    .filter((s) => s.coords?.lat !== 0 && s.coords?.lng !== 0)
    .map((s) => [s.coords.lat, s.coords.lng])
  const polylineCoords = routePathCoords.length >= 2
    ? routePathCoords
    : geometryPolylineCoords
  const hasGeneratedPath = routePathCoords.length >= 2
  const mapGeometrySlice = (start, end) =>
    geometryPoints
      .slice(start, end)
      .filter((point) => point.coords?.lat !== 0 && point.coords?.lng !== 0)
      .map((point) => [point.coords.lat, point.coords.lng])

  const matchedOriginStation = validStations.find((station) => String(station._id) === matchedOriginId) || null
  const matchedDestinationStation = validStations.find((station) => String(station._id) === matchedDestinationId) || null
  const matchedOriginStationIndex = visibleStations.findIndex((station) => String(station?._id) === matchedOriginId)
  const matchedDestinationStationIndex = visibleStations.findIndex((station) => String(station?._id) === matchedDestinationId)
  const matchedOriginGeometryIndex = findNearestGeometryIndex(geometryPoints, matchedOriginStation)
  const matchedDestinationGeometryIndex = findNearestGeometryIndex(geometryPoints, matchedDestinationStation)
  const matchedOriginLineIndex = hasGeneratedPath
    ? findNearestPolylineIndex(routePathCoords, matchedOriginStation)
    : matchedOriginGeometryIndex
  const matchedDestinationLineIndex = hasGeneratedPath
    ? findNearestPolylineIndex(routePathCoords, matchedDestinationStation)
    : matchedDestinationGeometryIndex
  const highlightedStartIndex = Math.min(matchedOriginLineIndex, matchedDestinationLineIndex)
  const highlightedEndIndex = Math.max(matchedOriginLineIndex, matchedDestinationLineIndex)
  const highlightedStationStartIndex = Math.min(matchedOriginStationIndex, matchedDestinationStationIndex)
  const highlightedStationEndIndex = Math.max(matchedOriginStationIndex, matchedDestinationStationIndex)
  const hasMatchedStationSegment =
    matchedOriginStationIndex >= 0 &&
    matchedDestinationStationIndex >= 0 &&
    matchedOriginStationIndex !== matchedDestinationStationIndex

  const hasMatchedSegment =
    matchedOriginLineIndex >= 0 &&
    matchedDestinationLineIndex >= 0 &&
    matchedOriginLineIndex !== matchedDestinationLineIndex

  const lineSlice = (start, end) => (
    hasGeneratedPath
      ? routePathCoords.slice(start, end)
      : mapGeometrySlice(start, end)
  )

  const highlightGeometryCoords = hasMatchedSegment
    ? lineSlice(highlightedStartIndex, highlightedEndIndex + 1)
    : polylineCoords

  const mutedLeadingCoords = hasMatchedSegment
    ? lineSlice(0, highlightedStartIndex + 1)
    : []

  const mutedTrailingCoords = hasMatchedSegment
    ? lineSlice(highlightedEndIndex, hasGeneratedPath ? routePathCoords.length : geometryPoints.length)
    : []

  return {
    route,
    geometryPoints,
    visibleStations,
    validStations,
    firstValidStationId,
    lastValidStationId,
    polylineCoords,
    hasGeneratedPath,
    highlightGeometryCoords,
    mutedLeadingCoords,
    mutedTrailingCoords,
    hasMatchedStationSegment,
    highlightedStationStartIndex: hasMatchedStationSegment ? highlightedStationStartIndex : 0,
    highlightedStationEndIndex: hasMatchedStationSegment
      ? highlightedStationEndIndex
      : Math.max(0, visibleStations.length - 1),
    matchedOriginId,
    matchedDestinationId,
  }
}

function getStationById(routeState, stationId) {
  if (!routeState || !stationId) return null
  return (
    routeState.validStations.find((station) => String(station._id) === String(stationId))
    || routeState.visibleStations.find((station) => String(station._id) === String(stationId))
    || null
  )
}

function findNearestStationToCoords(stations = [], coords) {
  if (!coords) return null

  const target = { lat: coords[0], lng: coords[1] }
  let nearestStation = null
  let nearestScore = Number.POSITIVE_INFINITY

  stations.forEach((station) => {
    if (!station?.coords?.lat || !station?.coords?.lng) return
    const score = distanceMetersBetween(station, target)
    if (score < nearestScore) {
      nearestScore = score
      nearestStation = station
    }
  })

  return nearestStation
}

function findNearestPointOnPolyline(polylineCoords = [], targetCoords) {
  const target = normalizeLatLng(targetCoords)
  if (!target || polylineCoords.length === 0) return null

  if (polylineCoords.length === 1) {
    return normalizeLatLng(polylineCoords[0])
  }

  let nearestPoint = null
  let nearestScore = Number.POSITIVE_INFINITY

  for (let index = 0; index < polylineCoords.length - 1; index += 1) {
    const start = normalizeLatLng(polylineCoords[index])
    const end = normalizeLatLng(polylineCoords[index + 1])
    if (!start || !end) continue

    const latScale = Math.cos(((start.lat + end.lat + target.lat) / 3) * Math.PI / 180)
    const startX = start.lng * latScale
    const startY = start.lat
    const endX = end.lng * latScale
    const endY = end.lat
    const targetX = target.lng * latScale
    const targetY = target.lat
    const dx = endX - startX
    const dy = endY - startY
    const segmentLengthSquared = dx * dx + dy * dy
    const ratio = segmentLengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((targetX - startX) * dx + (targetY - startY) * dy) / segmentLengthSquared))
    const candidate = {
      lat: start.lat + (end.lat - start.lat) * ratio,
      lng: start.lng + (end.lng - start.lng) * ratio,
    }
    const score = distanceMetersBetween(candidate, target)

    if (score < nearestScore) {
      nearestScore = score
      nearestPoint = candidate
    }
  }

  return nearestPoint
    ? { point: nearestPoint, distance: nearestScore }
    : null
}

function findNearestPointOnPolylines(polylineGroups = [], targetCoords) {
  let nearest = null

  polylineGroups.forEach((polylineCoords) => {
    const candidate = findNearestPointOnPolyline(polylineCoords, targetCoords)
    if (!candidate) return

    if (!nearest || candidate.distance < nearest.distance) {
      nearest = candidate
    }
  })

  return nearest?.point || null
}

function getDisplayedRouteLineGroups(routeStates = []) {
  return routeStates.flatMap((routeState) => {
    const groups = [
      routeState?.mutedLeadingCoords || [],
      routeState?.highlightGeometryCoords || [],
      routeState?.mutedTrailingCoords || [],
    ].filter((coords) => coords.length >= 2)

    if (groups.length > 0) {
      return groups
    }

    return routeState?.polylineCoords?.length >= 2 ? [routeState.polylineCoords] : []
  }).filter((coords) => coords.length >= 2)
}

function getSegmentIntersection(pathStart, pathEnd, routeStart, routeEnd) {
  const p1 = normalizeLatLng(pathStart)
  const p2 = normalizeLatLng(pathEnd)
  const r1 = normalizeLatLng(routeStart)
  const r2 = normalizeLatLng(routeEnd)
  if (!p1 || !p2 || !r1 || !r2) return null

  const pathDx = p2.lng - p1.lng
  const pathDy = p2.lat - p1.lat
  const routeDx = r2.lng - r1.lng
  const routeDy = r2.lat - r1.lat
  const denominator = pathDx * routeDy - pathDy * routeDx
  if (Math.abs(denominator) < 1e-12) return null

  const deltaX = r1.lng - p1.lng
  const deltaY = r1.lat - p1.lat
  const pathRatio = (deltaX * routeDy - deltaY * routeDx) / denominator
  const routeRatio = (deltaX * pathDy - deltaY * pathDx) / denominator
  const epsilon = 1e-9

  if (
    pathRatio < -epsilon ||
    pathRatio > 1 + epsilon ||
    routeRatio < -epsilon ||
    routeRatio > 1 + epsilon
  ) {
    return null
  }

  return {
    point: {
      lat: p1.lat + pathDy * Math.max(0, Math.min(1, pathRatio)),
      lng: p1.lng + pathDx * Math.max(0, Math.min(1, pathRatio)),
    },
    pathRatio: Math.max(0, Math.min(1, pathRatio)),
  }
}

function trimPathAtFirstRouteIntersection(pathCoords = [], routeLineGroups = []) {
  if (pathCoords.length < 2 || routeLineGroups.length === 0) return pathCoords

  let firstIntersection = null

  for (let pathIndex = 0; pathIndex < pathCoords.length - 1; pathIndex += 1) {
    for (const routeCoords of routeLineGroups) {
      for (let routeIndex = 0; routeIndex < routeCoords.length - 1; routeIndex += 1) {
        const intersection = getSegmentIntersection(
          pathCoords[pathIndex],
          pathCoords[pathIndex + 1],
          routeCoords[routeIndex],
          routeCoords[routeIndex + 1],
        )
        if (!intersection) continue

        const progress = pathIndex + intersection.pathRatio
        if (!firstIntersection || progress < firstIntersection.progress) {
          firstIntersection = {
            progress,
            pathIndex,
            point: intersection.point,
          }
        }
      }
    }

    if (firstIntersection && firstIntersection.pathIndex === pathIndex) break
  }

  if (!firstIntersection) return pathCoords

  return [
    ...pathCoords.slice(0, firstIntersection.pathIndex + 1),
    [firstIntersection.point.lat, firstIntersection.point.lng],
  ]
}

function getDisplayedRouteStations(routeStates = []) {
  const seenStationKeys = new Set()
  const stations = []

  routeStates.forEach((routeState) => {
    ;(routeState?.visibleStations || []).forEach((station) => {
      if (!station?.coords?.lat || !station?.coords?.lng) return
      const stationKey = station._id
        ? String(station._id)
        : `${station.nameAr || ''}:${station.coords.lat}:${station.coords.lng}`
      if (seenStationKeys.has(stationKey)) return

      seenStationKeys.add(stationKey)
      stations.push(station)
    })
  })

  return stations
}

function getCurrentLocationBoardingCandidates(routeState) {
  if (!routeState) return []

  const destinationIndex = routeState.visibleStations.findIndex(
    (station) => String(station?._id) === String(routeState.matchedDestinationId),
  )
  const stationLimit = destinationIndex >= 0
    ? destinationIndex
    : routeState.visibleStations.length - 1

  return routeState.visibleStations
    .slice(0, stationLimit + 1)
    .filter((station) => station?._id && station?.coords?.lat && station?.coords?.lng)
}

function anchorPathToEndpoints(pathCoords, startCoords, endCoords) {
  if (!startCoords || !endCoords) return []

  const anchoredPath = Array.isArray(pathCoords) && pathCoords.length >= 2
    ? [...pathCoords]
    : []
  const startPoint = [startCoords.lat, startCoords.lng]
  const endPoint = [endCoords.lat, endCoords.lng]

  if (anchoredPath.length === 0) {
    return [startPoint, endPoint]
  }

  anchoredPath[0] = startPoint
  anchoredPath[anchoredPath.length - 1] = endPoint
  return anchoredPath
}

function isStationRelevant(routeState, stationIndex) {
  if (!routeState) return false

  return (
    !routeState.hasMatchedStationSegment
    || (
      routeState.highlightedStationStartIndex >= 0
      && routeState.highlightedStationEndIndex >= 0
      && stationIndex >= routeState.highlightedStationStartIndex
      && stationIndex <= routeState.highlightedStationEndIndex
    )
  )
}

function formatTransferViewTitle(transferCount) {
  if (transferCount === 1) return t.transferViewTitleOne
  if (transferCount === 2) return t.transferViewTitleTwo
  return t.transferViewTitleMany(transferCount)
}

function StationList({ routeState, title, badge }) {
  const route = routeState.route
  const visibleStations = routeState.visibleStations

  return (
    <>
      <div className="p-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
        {title && (
          <div className="flex items-center justify-between gap-2 mb-2">
            <span
              className="inline-block text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: badge.bg, color: badge.color }}
            >
              {title}
            </span>
          </div>
        )}
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
          {t.fareRange(route.fare?.min, route.fare?.max)}
        </span>
      </div>

      <div className="p-4">
        <p className="text-xs font-semibold mb-3" style={{ color: '#6B7280' }}>
          {t.stationsCount(visibleStations.length)}
        </p>
        <ol className="flex flex-col gap-2.5">
          {visibleStations.map((s, i) => {
            const hasCoords = s.coords?.lat !== 0 && s.coords?.lng !== 0
            const stationId = s?._id ? String(s._id) : null
            const isFirst = i === 0
            const isLast = i === visibleStations.length - 1
            const isMatchedOrigin = routeState.matchedOriginId && stationId === routeState.matchedOriginId
            const isMatchedDestination = routeState.matchedDestinationId && stationId === routeState.matchedDestinationId
            const isMatched = isMatchedOrigin || isMatchedDestination
            const isRelevantStation = isStationRelevant(routeState, i)

            return (
              <li
                key={`${route.routeId}-${i}`}
                className="flex items-start gap-2"
                style={{ opacity: isRelevantStation ? 1 : 0.42 }}
              >
                <span
                  className="text-xs font-bold mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: !isRelevantStation
                      ? '#E5E7EB'
                      : isMatchedOrigin
                        ? '#F4A833'
                        : isMatchedDestination
                          ? badge.color
                          : isFirst
                            ? '#FDE7BF'
                            : isLast
                              ? '#DBEAFE'
                              : '#E5E7EB',
                    color: !isRelevantStation ? '#94A3B8' : isMatched || isFirst || isLast ? '#1B2A4A' : '#6B7280',
                    fontSize:        10,
                  }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium leading-tight"
                    style={{
                      color: !isRelevantStation ? '#94A3B8' : hasCoords ? '#1B2A4A' : '#9CA3AF',
                      fontWeight: isMatched ? 700 : 500,
                    }}
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
                        {isMatchedOrigin ? t.fromHere : t.toHere}
                    </span>
                  )}
                  {!hasCoords && (
                    <span
                      className="inline-block text-xs px-1.5 py-0.5 rounded mt-0.5"
                      style={{ backgroundColor: '#F3F4F6', color: '#9CA3AF' }}
                    >
                      {t.noCoords}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </>
  )
}

function StationMarker({
  station,
  markerStyle,
  isMatchedOrigin,
  isMatchedDestination,
  isMatched,
  isMuted = false,
  symbolKind = null,
  popupNote = null,
  badgeLabel = null,
  badgeOverride = null,
  palette = getTravelSegmentPalette(0),
}) {
  const badge = badgeOverride || getMarkerBadge({
    isMatchedOrigin,
    isMatchedDestination,
    travelSegmentTitle: badgeLabel,
    palette,
  })
  const badgeIcon = buildBadgeIcon(badge, markerStyle.outerRadius + 8)
  const semanticMarkerIcon = symbolKind ? buildSemanticStationIcon(symbolKind, markerStyle, isMuted) : null
  const popupContent = (
    <div style={{ fontFamily: 'Cairo, sans-serif', direction: 'rtl', textAlign: 'right', minWidth: 120 }}>
      <strong style={{ color: '#1B2A4A', display: 'block' }}>{station.nameAr}</strong>
      <span style={{ color: '#6B7280', fontSize: 12 }}>{station.nameEn}</span>
      {popupNote && (
        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: '#475569' }}>
          {popupNote}
        </div>
      )}
    </div>
  )

  return (
    <Fragment>
      {semanticMarkerIcon ? (
        <Marker position={[station.coords.lat, station.coords.lng]} icon={semanticMarkerIcon}>
          <Popup>{popupContent}</Popup>
        </Marker>
      ) : (
        <>
          <CircleMarker
            center={[station.coords.lat, station.coords.lng]}
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
            center={[station.coords.lat, station.coords.lng]}
            radius={markerStyle.innerRadius}
            pathOptions={{
              fillColor: markerStyle.innerFill,
              color: markerStyle.innerStroke,
              weight: 2,
              fillOpacity: 1,
              opacity: 1,
            }}
          >
            <Popup>{popupContent}</Popup>
          </CircleMarker>
        </>
      )}
      {badgeIcon && (
        <Marker
          position={[station.coords.lat, station.coords.lng]}
          icon={badgeIcon}
          interactive={false}
          keyboard={false}
        />
      )}
    </Fragment>
  )
}

export default function MapPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const selectedTravelSegments = parseTravelPlanSegmentDescriptors(searchParams)
  const hasTravelSegmentSelection = selectedTravelSegments.length > 0
  const isTransferView = selectedTravelSegments.length > 1

  const [userLocation, setUserLocation] = useState(null)
  const [accuracy, setAccuracy] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')
  const [nearestRoute, setNearestRoute] = useState(null)
  const [approachPathCoords, setApproachPathCoords] = useState([])
  const [stationDirectionsMode] = useState('walk')
  const [approachTargetMode, setApproachTargetMode] = useState('route-point')
  const queryOriginCoords = parseQueryCoords(searchParams, 'origin')
  const shouldShowCurrentLocationRouteButton = hasTravelSegmentSelection && !queryOriginCoords

  async function refreshNearestRoute(coordsArr) {
    try {
      const res = await api.get('/api/routes/near-me', { params: { lat: coordsArr[0], lng: coordsArr[1] } })
      const nearest = res.data.results?.[0]?.route || null
      setNearestRoute(nearest)
      return nearest
    } catch {
      setNearestRoute(null)
      return null
    }
  }

  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      })
    })
  }

  async function handleUseCurrentLocationForRoute() {
    setLocError('')
    if (!navigator.geolocation) {
      setLocError(t.geoNotSupported)
      return
    }

    setLocating(true)
    try {
      let coordsArr = userLocation

      if (!coordsArr) {
        const pos = await getCurrentPosition()
        coordsArr = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(coordsArr)
        setAccuracy(pos.coords.accuracy)
      }

      const nextParams = new URLSearchParams(searchParams)
      const nearestBoardingStation = findNearestStationToCoords(
        getCurrentLocationBoardingCandidates(firstRouteState),
        coordsArr,
      )

      if (!nearestBoardingStation?._id) {
        setLocError(t.noNearestStation)
        return
      }

      const nextTravelSegments = selectedTravelSegments.map((travelSegment, index) => (
        index === 0
          ? { ...travelSegment, originStopId: String(nearestBoardingStation._id) }
          : travelSegment
      ))

      nextParams.set('travelSegments', JSON.stringify(nextTravelSegments))
      nextParams.set('originLat', String(coordsArr[0]))
      nextParams.set('originLng', String(coordsArr[1]))
      navigate(`/map?${nextParams.toString()}`, { replace: true })
    } catch (err) {
      switch (err.code) {
        case 1:
          setLocError(t.geoDenied)
          break
        case 2:
          setLocError(t.geoUnavailable)
          break
        case 3:
          setLocError(t.geoTimeout)
          break
        default:
          setLocError(t.geoFailed)
      }
    } finally {
      setLocating(false)
    }
  }

  useEffect(() => {
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coordsArr = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(coordsArr)
        setAccuracy(pos.coords.accuracy)
        setLocError('')
        refreshNearestRoute(coordsArr)
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLocError(t.geoDenied)
            break
          case err.POSITION_UNAVAILABLE:
            setLocError(t.geoUnavailable)
            break
          case err.TIMEOUT:
            setLocError(t.geoTimeout)
            break
          default:
            setLocError(t.geoFailed)
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  const travelSegmentRouteQueries = useQueries({
    queries: selectedTravelSegments.map((travelSegment) => ({
      queryKey: ['route', travelSegment.routeId, travelSegment.direction],
      queryFn: () =>
        api
          .get(`/api/routes/${travelSegment.routeId}`, { params: { direction: travelSegment.direction } })
          .then((response) => response.data),
      enabled: Boolean(travelSegment?.routeId),
    })),
  })

  const routeStates = selectedTravelSegments.map((descriptor, index) => {
    const route = travelSegmentRouteQueries[index]?.data?.route || null
    if (!route) return null

    return {
      ...buildRouteMapState(route, descriptor.originStopId, descriptor.destinationStopId),
      descriptor,
      travelSegmentIndex: index,
      palette: getTravelSegmentPalette(index),
    }
  })

  const directState = !isTransferView ? routeStates[0] || null : null
  const hydratedRouteStates = routeStates.filter(Boolean)
  const transferSteps = routeStates
    .slice(0, -1)
    .map((routeState, index) => {
      const nextRouteState = routeStates[index + 1]
      if (!routeState || !nextRouteState) return null

      const fromStation = getStationById(routeState, routeState.matchedDestinationId)
      const toStation = getStationById(nextRouteState, nextRouteState.matchedOriginId)
      if (!fromStation && !toStation) return null

      const sharedStation =
        fromStation?._id &&
        toStation?._id &&
        String(fromStation._id) === String(toStation._id)

      const coords = []
      if (fromStation?.coords?.lat && fromStation?.coords?.lng) {
        coords.push([fromStation.coords.lat, fromStation.coords.lng])
      }
      if (
        toStation?.coords?.lat &&
        toStation?.coords?.lng &&
        String(toStation._id) !== String(fromStation?._id)
      ) {
        coords.push([toStation.coords.lat, toStation.coords.lng])
      }

      return {
        index,
        fromStation,
        toStation,
        coords,
        isSharedStation: Boolean(sharedStation),
        currentPalette: routeState.palette,
        nextPalette: nextRouteState.palette,
      }
    })
    .filter(Boolean)

  const sharedTransferRenderKeys = new Map()
  const sharedTransferSkipKeys = new Set()
  transferSteps.forEach((step) => {
    if (!step.isSharedStation || !step.fromStation?._id) return

    const stationId = String(step.fromStation._id)
    sharedTransferRenderKeys.set(`${step.index}:${stationId}`, step)
    sharedTransferSkipKeys.add(`${step.index + 1}:${stationId}`)
  })

  const firstRouteState = hydratedRouteStates[0] || null
  const displayedRouteStations = getDisplayedRouteStations(hydratedRouteStates)
  const displayedRouteLineGroups = getDisplayedRouteLineGroups(hydratedRouteStates)
  const activeRouteOriginCoords = queryOriginCoords
    ? userLocation
      ? { lat: userLocation[0], lng: userLocation[1] }
      : queryOriginCoords
    : null
  const currentRouteBoardingStation = queryOriginCoords
    ? getStationById(firstRouteState, firstRouteState?.matchedOriginId)
    : null
  const nearestDisplayedRouteStation = currentRouteBoardingStation
    || (displayedRouteStations.length > 0 && activeRouteOriginCoords
      ? findNearestStationToCoords(displayedRouteStations, [activeRouteOriginCoords.lat, activeRouteOriginCoords.lng])
      : null)
  const nearestDisplayedRoutePoint = activeRouteOriginCoords
    ? findNearestPointOnPolylines(displayedRouteLineGroups, activeRouteOriginCoords)
    : null
  const approachBoardStation = hydratedRouteStates.length > 0
    ? nearestDisplayedRouteStation || getStationById(firstRouteState, firstRouteState?.matchedOriginId) || firstRouteState?.route?.origin
    : null
  const approachBoardCoords = approachTargetMode === 'station'
    ? normalizeLatLng(approachBoardStation?.coords)
    : nearestDisplayedRoutePoint || normalizeLatLng(approachBoardStation?.coords)
  const nearestDisplayedRouteStationCoords = normalizeLatLng(nearestDisplayedRouteStation?.coords)
  const approachOriginCoords = activeRouteOriginCoords
  const routeLineGroupsKey = displayedRouteLineGroups
    .map((coords) => coords.map((point) => point.join(',')).join('|'))
    .join('::')
  const routePointDisplayCoords = approachTargetMode === 'route-point' && approachPathCoords.length >= 2
    ? normalizeLatLng(approachPathCoords[approachPathCoords.length - 1])
    : approachBoardCoords

  useEffect(() => {
    const fallbackCoords = approachOriginCoords && approachBoardCoords
      ? [
          [approachOriginCoords.lat, approachOriginCoords.lng],
          [approachBoardCoords.lat, approachBoardCoords.lng],
        ]
      : []

    if (!approachOriginCoords || !approachBoardCoords) {
      setApproachPathCoords([])
      return
    }

    let cancelled = false
    setApproachPathCoords(fallbackCoords)

    api
      .get('/api/routes/path-between', {
        params: {
          fromLat: approachOriginCoords.lat,
          fromLng: approachOriginCoords.lng,
          toLat: approachBoardCoords.lat,
          toLng: approachBoardCoords.lng,
          mode: stationDirectionsMode,
        },
      })
      .then((response) => {
        if (cancelled) return
        const pathCoords = (response.data?.path || [])
          .map((point) => normalizeLatLng(point))
          .filter(Boolean)
          .map((point) => [point.lat, point.lng])
        const anchoredPathCoords = anchorPathToEndpoints(pathCoords, approachOriginCoords, approachBoardCoords)
        const displayPathCoords = approachTargetMode === 'route-point'
          ? trimPathAtFirstRouteIntersection(anchoredPathCoords, displayedRouteLineGroups)
          : anchoredPathCoords

        setApproachPathCoords(displayPathCoords.length >= 2 ? displayPathCoords : fallbackCoords)
      })
      .catch(() => {
        if (!cancelled) {
          setApproachPathCoords(fallbackCoords)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    approachOriginCoords?.lat,
    approachOriginCoords?.lng,
    approachBoardCoords?.lat,
    approachBoardCoords?.lng,
    stationDirectionsMode,
    approachTargetMode,
    routeLineGroupsKey,
  ])

  const nearestValidStations = nearestRoute ? (nearestRoute.stations || []).filter((s) => s.coords?.lat && s.coords?.lng) : []
  const nearestStation = nearestRoute?.nearestStation || null
  const nearestPathCoords = (!nearestRoute?.pathStale ? nearestRoute?.path || [] : [])
    .filter((point) => point?.lat && point?.lng)
    .map((point) => [point.lat, point.lng])
  const nearestGeometryCoords = (nearestRoute?.geometryPoints || [])
    .filter((s) => s.coords?.lat && s.coords?.lng)
    .map((s) => [s.coords.lat, s.coords.lng])
  const nearestPolylineCoords = nearestPathCoords.length >= 2
    ? nearestPathCoords
    : nearestGeometryCoords

  const fitCoords = [
    ...(userLocation ? [userLocation] : []),
    ...approachPathCoords,
    ...hydratedRouteStates.flatMap((routeState) => routeState.polylineCoords || []),
    ...transferSteps.flatMap((step) => step.coords || []),
  ]

  const isLoading = travelSegmentRouteQueries.some((query) => query.isLoading || query.isPending)
  const visibleRouteIds = new Set(hydratedRouteStates.map((routeState) => routeState.route.routeId))
  const routeLegendPalette = hydratedRouteStates[0]?.palette || getTravelSegmentPalette(0)
  const hasCurrentLocationMarker = Boolean(userLocation || queryOriginCoords)
  const hasPickupMarker = hydratedRouteStates.some((routeState) => Boolean(routeState.matchedOriginId))
  const hasDropoffMarker = hydratedRouteStates.some((routeState) => Boolean(routeState.matchedDestinationId))
  const hasRouteLine = hydratedRouteStates.some((routeState) =>
    routeState.polylineCoords?.length >= 2 ||
    routeState.highlightGeometryCoords?.length >= 2 ||
    routeState.mutedLeadingCoords?.length >= 2 ||
    routeState.mutedTrailingCoords?.length >= 2
  )
  const hasApproachRouteLine = approachPathCoords.length >= 2
  const hasNearestStationMarker = hasTravelSegmentSelection
    ? Boolean(approachTargetMode === 'station' && nearestDisplayedRouteStation && nearestDisplayedRouteStationCoords)
    : Boolean(nearestStation)
  const hasNearestRouteLine = Boolean(
    nearestRoute &&
    !hasTravelSegmentSelection &&
    !visibleRouteIds.has(nearestRoute.routeId) &&
    nearestPolylineCoords.length >= 2
  )

  useEffect(() => {
    if (!navigator.geolocation || userLocation) return

    let cancelled = false
    setLocating(true)

    getCurrentPosition()
      .then(async (pos) => {
        if (cancelled) return
        const coordsArr = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(coordsArr)
        setAccuracy(pos.coords.accuracy)
        setLocError('')
        await refreshNearestRoute(coordsArr)
      })
      .catch((err) => {
        if (cancelled) return
        switch (err.code) {
          case 1:
            setLocError(t.geoDenied)
            break
          case 2:
            setLocError(t.geoUnavailable)
            break
          case 3:
            setLocError(t.geoTimeout)
            break
          default:
            setLocError(t.geoFailed)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLocating(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      className="flex"
      style={{ height: 'calc(100vh - 64px)', fontFamily: 'Cairo, sans-serif' }}
      dir="rtl"
    >
      <aside
        className="hidden md:flex flex-col w-72 overflow-y-auto"
        style={{
          backgroundColor: '#FFFFFF',
          borderLeft: '1px solid #E5E7EB',
          flexShrink: 0,
        }}
      >
        {isTransferView && hydratedRouteStates.length > 0 ? (
          <>
            <div className="p-4" style={{ borderBottom: '1px solid #E5E7EB', backgroundColor: '#FFFBEB' }}>
              <h2 className="font-bold text-base" style={{ color: '#1B2A4A' }}>
                {formatTransferViewTitle(selectedTravelSegments.length - 1)}
              </h2>
              <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                {t.travelSegmentsCount(selectedTravelSegments.length)}
              </p>
            </div>
            {routeStates.map((routeState, index) => {
              if (!routeState) return null

              const transferStep = transferSteps.find((step) => step.index === index)

              return (
                <Fragment key={`${routeState.route.routeId}-${index}`}>
                  <StationList
                    routeState={routeState}
                    title={t.travelSegmentNamed(ordinalLabel(index))}
                    badge={{
                      bg: routeState.palette.badgeBg,
                      color: routeState.palette.badgeText,
                    }}
                  />
                  {transferStep && (
                    <div
                      className="px-4 py-3"
                      style={{
                        borderTop: '1px solid #E5E7EB',
                        borderBottom: '1px solid #E5E7EB',
                        backgroundColor: '#F9FAFB',
                      }}
                    >
                      <p className="text-xs font-bold" style={{ color: '#6B7280' }}>
                        {t.transferStepLabel(transferStep.index + 1)}
                      </p>
                      <p className="text-sm mt-1" style={{ color: '#1B2A4A' }}>
                        {transferStep.isSharedStation
                          ? t.transferAt(
                              transferStep.fromStation?.nameAr
                              || transferStep.toStation?.nameAr
                              || t.sharedStationFallback,
                            )
                          : t.transferInstruction(
                              transferStep.fromStation?.nameAr || t.dropoffStationFallback,
                              transferStep.toStation?.nameAr || t.pickupStationFallback,
                            )}
                      </p>
                    </div>
                  )}
                </Fragment>
              )
            })}
          </>
        ) : directState ? (
          <StationList
            routeState={directState}
            title={null}
            badge={{ bg: directState.palette.badgeBg, color: directState.palette.badgeText }}
          />
        ) : (
          <div className="p-6 text-center">
            <p className="text-sm" style={{ color: '#9CA3AF' }}>
              {t.sidebarEmpty}
            </p>
          </div>
        )}
      </aside>

      <div className="flex-1 relative">
        <RouteMapStyles />
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

          {fitCoords.length >= 2 && <FitBounds coords={fitCoords} />}

          {approachPathCoords.length >= 2 && (
            <RoutePolyline
              positions={approachPathCoords}
              palette={{ casing: '#047857', main: '#6EE7B7' }}
              weight={4}
              opacity={0.9}
              dashed
            />
          )}

          {queryOriginCoords && (
            <Marker
              position={[queryOriginCoords.lat, queryOriginCoords.lng]}
              icon={userLocationIcon}
              zIndexOffset={1000}
            >
              <Popup>
                <div style={{ fontFamily: 'Cairo, sans-serif', direction: 'rtl', textAlign: 'right' }}>
                  {t.myLocationPopup}
                </div>
              </Popup>
            </Marker>
          )}

          {hydratedRouteStates.map((routeState) => (
            <Fragment key={`${routeState.route.routeId}-${routeState.travelSegmentIndex}`}>
              {routeState.mutedLeadingCoords.length >= 2 && (
                <RoutePolyline
                  positions={routeState.mutedLeadingCoords}
                  palette={{ casing: '#94A3B8', main: '#D1D5DB' }}
                  weight={5}
                  opacity={0.7}
                  muted
                />
              )}
              {routeState.mutedTrailingCoords.length >= 2 && (
                <RoutePolyline
                  positions={routeState.mutedTrailingCoords}
                  palette={{ casing: '#94A3B8', main: '#D1D5DB' }}
                  weight={5}
                  opacity={0.7}
                  muted
                />
              )}
              {routeState.highlightGeometryCoords.length === 0 && routeState.polylineCoords.length >= 2 && (
                <RoutePolyline
                  positions={routeState.polylineCoords}
                  palette={routeState.hasGeneratedPath
                    ? { casing: routeState.palette.casing, main: routeState.palette.main }
                    : { casing: '#94A3B8', main: '#D1D5DB' }}
                  weight={routeState.hasGeneratedPath ? 6 : 5}
                  opacity={routeState.hasGeneratedPath ? 0.94 : 0.7}
                  muted={!routeState.hasGeneratedPath}
                />
              )}
              {routeState.highlightGeometryCoords.length >= 2 && (
                <RoutePolyline
                  positions={routeState.highlightGeometryCoords}
                  palette={{ casing: routeState.palette.casing, main: routeState.palette.main }}
                  weight={6}
                  opacity={0.94}
                />
              )}
            </Fragment>
          ))}

          {hydratedRouteStates.map((routeState, travelSegmentIndex) =>
            routeState.visibleStations.map((station, stationIndex) => {
              if (!station?.coords?.lat || !station?.coords?.lng) return null

              const stationId = station?._id ? String(station._id) : null
              const sharedTransferStep = stationId
                ? sharedTransferRenderKeys.get(`${travelSegmentIndex}:${stationId}`)
                : null

              if (stationId && sharedTransferSkipKeys.has(`${travelSegmentIndex}:${stationId}`)) {
                return null
              }

              const isFirst = stationId === routeState.firstValidStationId
              const isLast = stationId === routeState.lastValidStationId
              const isEndpoint = isFirst || isLast
              const isMatchedOrigin = Boolean(routeState.matchedOriginId && stationId === routeState.matchedOriginId)
              const isMatchedDestination = Boolean(
                routeState.matchedDestinationId && stationId === routeState.matchedDestinationId,
              )
              const isMatched = isMatchedOrigin || isMatchedDestination || Boolean(sharedTransferStep)
              const isRelevantStation = isStationRelevant(routeState, stationIndex)
              const markerStyle = sharedTransferStep
                ? getTransferMarkerStyle(sharedTransferStep.currentPalette, sharedTransferStep.nextPalette)
                : getPointMarkerStyle({
                    isEndpoint,
                    isMatchedOrigin,
                    isMatchedDestination,
                    accent: routeState.palette.main,
                    muted: !isRelevantStation,
                  })

              const symbolKind = sharedTransferStep
                ? 'transfer'
                : isMatchedOrigin
                  ? 'pickup'
                  : isMatchedDestination
                    ? 'dropoff'
                    : isFirst
                      ? 'start'
                      : isLast
                        ? 'end'
                        : null

              const popupMessage = sharedTransferStep
                ? sharedTransferStep.isSharedStation
                  ? t.transferBetweenSegments(
                      ordinalLabel(travelSegmentIndex),
                      ordinalLabel(travelSegmentIndex + 1),
                    )
                  : t.transferPoint
                : isMatchedOrigin && travelSegmentIndex === 0
                  ? t.requiredPickupPoint
                  : isMatchedOrigin
                    ? t.pickupAfterTransfer
                    : isMatchedDestination && travelSegmentIndex === routeStates.length - 1
                      ? t.requiredDropoffPoint
                      : isMatchedDestination
                        ? t.dropoffForTransfer
                        : isFirst
                          ? t.startPoint
                          : isLast
                            ? t.endPoint
                            : t.travelSegmentNamed(ordinalLabel(travelSegmentIndex))

              return (
                <StationMarker
                  key={`${routeState.route.routeId}-${stationIndex}`}
                  station={station}
                  markerStyle={markerStyle}
                  isMatchedOrigin={isMatchedOrigin}
                  isMatchedDestination={isMatchedDestination}
                  isMatched={isMatched}
                  isMuted={!isRelevantStation}
                  symbolKind={symbolKind}
                  badgeOverride={
                    sharedTransferStep
                      ? getTransferBadge(
                          sharedTransferStep.currentPalette,
                          sharedTransferStep.nextPalette,
                          sharedTransferStep.index,
                        )
                      : null
                  }
                  badgeLabel={ordinalLabel(travelSegmentIndex)}
                  popupNote={popupMessage}
                  palette={routeState.palette}
                />
              )
            }),
          )}

          {transferSteps.map((step) =>
            step.coords.length >= 2 ? (
              <RoutePolyline
                key={`transfer-path-${step.index}`}
                positions={step.coords}
                palette={{ casing: '#64748B', main: '#CBD5E1' }}
                weight={3}
                opacity={0.88}
                dashed
              />
            ) : null,
          )}

          {hasTravelSegmentSelection && approachTargetMode === 'route-point' && routePointDisplayCoords && (
            <CircleMarker
              center={[routePointDisplayCoords.lat, routePointDisplayCoords.lng]}
              radius={9}
              pathOptions={{
                fillColor: '#D1FAE5',
                color: '#047857',
                weight: 3,
                fillOpacity: 0.92,
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'Cairo, sans-serif', direction: 'rtl', textAlign: 'right', minWidth: 130 }}>
                  <strong style={{ color: '#1B2A4A', display: 'block' }}>Nearest route point</strong>
                  <span style={{ color: '#047857', fontSize: 12, display: 'block', marginTop: 4 }}>
                    Current location path target
                  </span>
                </div>
              </Popup>
            </CircleMarker>
          )}

          {hasTravelSegmentSelection && approachTargetMode === 'station' && nearestDisplayedRouteStation && nearestDisplayedRouteStationCoords && (
            <Marker
              position={[nearestDisplayedRouteStationCoords.lat, nearestDisplayedRouteStationCoords.lng]}
              icon={nearestStationIcon}
              zIndexOffset={1200}
            >
              <Popup>
                <div style={{ fontFamily: 'Cairo, sans-serif', direction: 'rtl', textAlign: 'right', minWidth: 120 }}>
                  <strong style={{ color: '#1B2A4A', display: 'block' }}>{nearestDisplayedRouteStation.nameAr}</strong>
                  <span style={{ color: '#6B7280', fontSize: 12 }}>{nearestDisplayedRouteStation.nameEn}</span>
                  <span style={{ color: '#047857', fontSize: 12, display: 'block', marginTop: 4 }}>
                    {t.nearestStationPopup}
                  </span>
                </div>
              </Popup>
            </Marker>
          )}

          {nearestRoute && !hasTravelSegmentSelection && !visibleRouteIds.has(nearestRoute.routeId) && nearestPolylineCoords.length > 0 && (
            <>
              {nearestPolylineCoords.length >= 2 && (
                <RoutePolyline
                  positions={nearestPolylineCoords}
                  palette={{ casing: '#B91C1C', main: '#FCA5A5' }}
                  weight={3}
                  opacity={0.82}
                  dashed
                />
              )}
              {nearestValidStations.map((s, i) => {
                const isEndpoint = i === 0 || i === nearestValidStations.length - 1
                const isNearestStation =
                  nearestStation?._id && s?._id
                    ? String(nearestStation._id) === String(s._id)
                    : nearestStation?.nameAr === s?.nameAr
                return (
                  <CircleMarker
                    key={`near-${i}`}
                    center={[s.coords.lat, s.coords.lng]}
                    radius={isNearestStation ? 12 : isEndpoint ? 10 : 6}
                    pathOptions={{
                      fillColor: isNearestStation ? '#D1FAE5' : '#FEE2E2',
                      color: isNearestStation ? '#047857' : '#DC2626',
                      weight: isNearestStation ? 3 : 2,
                      dashArray: isNearestStation ? undefined : '6 4',
                      fillOpacity: 0.92,
                    }}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'Cairo, sans-serif', direction: 'rtl', textAlign: 'right', minWidth: 120 }}>
                        <strong style={{ color: '#1B2A4A', display: 'block' }}>{s.nameAr}</strong>
                        <span style={{ color: '#6B7280', fontSize: 12 }}>{s.nameEn}</span>
                        {isNearestStation ? (
                          <span style={{ color: '#047857', fontSize: 12, display: 'block', marginTop: 4 }}>
                            {t.nearestStationPopup}
                          </span>
                        ) : null}
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
            </>
          )}

          {userLocation && !hasTravelSegmentSelection && <FlyToLocation position={userLocation} />}

          {userLocation && (
            <>
              <Marker position={userLocation} icon={userLocationIcon} zIndexOffset={1000}>
                <Popup>
                  <div style={{ fontFamily: 'Cairo, sans-serif', direction: 'rtl', textAlign: 'right', minWidth: 140 }}>
                    <strong style={{ color: '#1B2A4A', display: 'block' }}>{t.myLocationPopup}</strong>
                    {accuracy ? (
                      <span style={{ color: '#6B7280', fontSize: 12 }}>
                        {t.accuracyLabel(Math.round(accuracy))}
                      </span>
                    ) : null}
                  </div>
                </Popup>
              </Marker>
            </>
          )}
        </MapContainer>

        {!hasTravelSegmentSelection && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 1000 }}
          >
            <div
              className="rounded-2xl p-6 text-center shadow-xl pointer-events-auto"
              style={{ backgroundColor: '#FFFFFF', maxWidth: 280 }}
            >
              <p className="font-bold text-base mb-1" style={{ color: '#1B2A4A' }}>
                {t.noRouteTitle}
              </p>
              <p className="text-sm mb-4" style={{ color: '#9CA3AF' }}>
                {t.noRouteBody}
              </p>
              <button
                onClick={() => navigate('/search')}
                className="px-5 py-2 rounded-xl text-sm font-bold"
                style={{ backgroundColor: '#F4A833', color: '#1B2A4A' }}
              >
                {t.noRouteBtn}
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 1100 }}
          >
            <div
              className="w-10 h-10 rounded-full border-4 animate-spin"
              style={{ borderColor: '#F4A833', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        <div
          className="absolute top-4 left-4 flex max-w-[300px] flex-col gap-3"
          style={{ zIndex: 1000 }}
        >
          <div
            className="rounded-2xl border p-4 shadow-lg"
            style={{ backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#E5E7EB', fontFamily: 'Cairo, sans-serif' }}
          >
            <p className="mb-2 text-sm font-extrabold" style={{ color: '#1B2A4A' }}>
              {t.legendTitle}
            </p>
            <div className="space-y-2 text-xs" style={{ color: '#475569' }}>
              {hasCurrentLocationMarker && (
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: '#2563EB', boxShadow: '0 0 0 4px rgba(147,197,253,0.45)' }}
                  />
                  <span>{t.legendOrigin}</span>
                </div>
              )}
              {hasPickupMarker && (
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: '#F4A833', border: '2px solid #FFF7E8' }} />
                  <span>{t.legendPickup}</span>
                </div>
              )}
              {hasDropoffMarker && (
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: '#1B2A4A', border: '2px solid #EDF5FF' }} />
                  <span>{t.legendDropoff}</span>
                </div>
              )}
              {hasNearestStationMarker && (
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: '#047857', border: '2px solid #D1FAE5' }} />
                  <span>{t.legendNearest}</span>
                </div>
              )}
              {hasRouteLine && (
                <div className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-8 rounded-full"
                    style={{
                      background: `linear-gradient(to right, ${routeLegendPalette.casing}, ${routeLegendPalette.main})`,
                    }}
                  />
                  <span>{t.legendRoute}</span>
                </div>
              )}
              {hasApproachRouteLine && (
                <div className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-8 rounded-full"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(to right, #6EE7B7 0 8px, transparent 8px 12px)',
                      backgroundColor: '#047857',
                    }}
                  />
                  <span>{t.legendApproachRoute}</span>
                </div>
              )}
              {hasNearestRouteLine && (
                <div className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-8 rounded-full"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(to right, #FCA5A5 0 8px, transparent 8px 12px)',
                      backgroundColor: '#B91C1C',
                    }}
                  />
                  <span>{t.legendNearestRoute}</span>
                </div>
              )}
            </div>
          </div>

        </div>

        <div
          className="absolute bottom-6 left-4 flex flex-col gap-3"
          style={{ zIndex: 1000 }}
        >
          {shouldShowCurrentLocationRouteButton ? (
            <button
              type="button"
              onClick={handleUseCurrentLocationForRoute}
              disabled={locating || !firstRouteState}
              className="rounded-xl px-4 py-2.5 text-sm font-bold shadow-lg flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              style={{ backgroundColor: '#047857', color: '#FFFFFF', fontFamily: 'Cairo, sans-serif' }}
            >
              {locating ? (
                <span
                  className="inline-block h-4 w-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'rgba(255,255,255,0.45)', borderTopColor: '#FFFFFF' }}
                />
              ) : null}
              {locating ? 'Getting your location...' : 'Update route from my location'}
            </button>
          ) : null}

          {hasApproachRouteLine ? (
            <div
              className="rounded-xl border p-1 shadow-lg flex gap-1"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', fontFamily: 'Cairo, sans-serif' }}
            >
              {APPROACH_TARGET_MODES.map((mode) => {
                const isActive = approachTargetMode === mode.value
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setApproachTargetMode(mode.value)}
                    className="rounded-lg px-3 py-2 text-xs font-bold transition-colors"
                    style={{
                      backgroundColor: isActive ? '#047857' : 'transparent',
                      color: isActive ? '#FFFFFF' : '#1B2A4A',
                    }}
                  >
                    {mode.label}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        {locError && (
          <div
            className="absolute bottom-20 left-4 rounded-xl px-4 py-2 text-sm shadow"
            style={{ backgroundColor: '#FEE2E2', color: '#991B1B', fontFamily: 'Cairo, sans-serif', zIndex: 1000 }}
          >
            {locError}
          </div>
        )}
      </div>
    </div>
  )
}
