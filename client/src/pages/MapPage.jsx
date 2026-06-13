import { Fragment, useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueries } from '@tanstack/react-query'
import { MapContainer, TileLayer, Popup, Polyline, CircleMarker, Marker, useMap } from 'react-leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import { ArrowDown, ArrowRightLeft, ArrowUp, Flag, Play } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../lib/axios'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function FitBounds({ coords }) {
  const map = useMap()
  useEffect(() => {
    if (coords.length >= 2) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] })
    }
  }, [coords, map])
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
    outerRadius: 6,
    innerRadius: 3,
    outerFill: '#FFFFFF',
    outerStroke: '#CBD5E1',
    innerFill: '#64748B',
    innerStroke: '#FFFFFF',
  }
}

function getMarkerBadge({ isMatchedOrigin, isMatchedDestination, legTitle = null }) {
  if (isMatchedOrigin) {
    return {
      text: legTitle ? `${legTitle}: ركوب` : 'ركوب',
      bg: '#FEF3C7',
      color: '#92400E',
      border: '#F4A833',
    }
  }

  if (isMatchedDestination) {
    return {
      text: legTitle ? `${legTitle}: نزول` : 'نزول',
      bg: '#DBEAFE',
      color: '#1E3A8A',
      border: '#60A5FA',
    }
  }

  return null
}

function getTransferMarkerStyle() {
  return {
    outerRadius: 13,
    innerRadius: 7,
    outerFill: '#FFF4E6',
    outerStroke: '#C2410C',
    innerFill: '#2563EB',
    innerStroke: '#FFFFFF',
  }
}

function getTransferBadge() {
  return {
    text: 'تحويل',
    bg: '#FFF1E6',
    color: '#7C2D12',
    border: '#F59E0B',
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
      return { Icon: Play, color: muted ? mutedColor : '#FFFFFF', label: 'بداية الخط' }
    case 'end':
      return { Icon: Flag, color: muted ? mutedColor : '#FFFFFF', label: 'نهاية الخط' }
    case 'pickup':
      return { Icon: ArrowUp, color: muted ? mutedColor : '#FFFFFF', label: 'نقطة الركوب' }
    case 'dropoff':
      return { Icon: ArrowDown, color: muted ? mutedColor : '#FFFFFF', label: 'نقطة النزول' }
    case 'transfer':
      return { Icon: ArrowRightLeft, color: muted ? mutedColor : '#FFFFFF', label: 'نقطة التحويل' }
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
          --marker-gradient:${kind === 'transfer' ? 'linear-gradient(135deg, #F59E0B 0%, #F59E0B 48%, #2563EB 52%, #2563EB 100%)' : markerStyle.innerFill};
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
          background: var(--badge-bg);
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
          background: var(--badge-bg);
          border-right: 1px solid var(--badge-border);
          border-bottom: 1px solid var(--badge-border);
          transform: translateX(-50%) rotate(45deg);
        }
      `}
    </style>
  )
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

function buildRouteMapState(route, matchedOriginId, matchedDestinationId) {
  const geometryPoints = route?.geometryPoints || []
  const visibleStations = route?.stations || []
  const validStations = visibleStations.filter((s) => s.coords?.lat !== 0 && s.coords?.lng !== 0)
  const firstValidStationId = validStations[0]?._id ? String(validStations[0]._id) : null
  const lastValidStationId = validStations[validStations.length - 1]?._id
    ? String(validStations[validStations.length - 1]._id)
    : null
  const polylineCoords = geometryPoints
    .filter((s) => s.coords?.lat !== 0 && s.coords?.lng !== 0)
    .map((s) => [s.coords.lat, s.coords.lng])
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
  const highlightedStartIndex = Math.min(matchedOriginGeometryIndex, matchedDestinationGeometryIndex)
  const highlightedEndIndex = Math.max(matchedOriginGeometryIndex, matchedDestinationGeometryIndex)
  const highlightedStationStartIndex = Math.min(matchedOriginStationIndex, matchedDestinationStationIndex)
  const highlightedStationEndIndex = Math.max(matchedOriginStationIndex, matchedDestinationStationIndex)

  const highlightGeometryCoords =
    matchedOriginGeometryIndex >= 0 &&
    matchedDestinationGeometryIndex >= 0 &&
    matchedOriginGeometryIndex !== matchedDestinationGeometryIndex
      ? mapGeometrySlice(highlightedStartIndex, highlightedEndIndex + 1)
      : []

  const mutedLeadingCoords = highlightGeometryCoords.length >= 2
    ? mapGeometrySlice(0, highlightedStartIndex + 1)
    : []

  const mutedTrailingCoords = highlightGeometryCoords.length >= 2
    ? mapGeometrySlice(highlightedEndIndex, geometryPoints.length)
    : []

  return {
    route,
    geometryPoints,
    visibleStations,
    validStations,
    firstValidStationId,
    lastValidStationId,
    polylineCoords,
    highlightGeometryCoords,
    mutedLeadingCoords,
    mutedTrailingCoords,
    highlightedStationStartIndex,
    highlightedStationEndIndex,
    matchedOriginId,
    matchedDestinationId,
  }
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
          التعريفة: {route.fare?.min}–{route.fare?.max} جنيه
        </span>
      </div>

      <div className="p-4">
        <p className="text-xs font-semibold mb-3" style={{ color: '#6B7280' }}>
          محطات الخط ({visibleStations.length})
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

            return (
              <li key={`${route.routeId}-${i}`} className="flex items-start gap-2">
                <span
                  className="text-xs font-bold mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: isMatchedOrigin ? '#F4A833' : isMatchedDestination ? badge.color : isFirst ? '#FDE7BF' : isLast ? '#DBEAFE' : '#E5E7EB',
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
}) {
  const badge = badgeOverride || getMarkerBadge({
    isMatchedOrigin,
    isMatchedDestination,
    legTitle: badgeLabel,
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
  const itineraryType = searchParams.get('itineraryType') || 'direct'
  const routeId = searchParams.get('routeId')
  const direction = searchParams.get('direction') || 'forward'
  const matchedOriginId = searchParams.get('matchedOriginId')
  const matchedDestinationId = searchParams.get('matchedDestinationId')

  const firstRouteId = searchParams.get('firstRouteId')
  const firstDirection = searchParams.get('firstDirection') || 'forward'
  const firstOriginId = searchParams.get('firstOriginId')
  const firstDestinationId = searchParams.get('firstDestinationId')
  const secondRouteId = searchParams.get('secondRouteId')
  const secondDirection = searchParams.get('secondDirection') || 'forward'
  const secondOriginId = searchParams.get('secondOriginId')
  const secondDestinationId = searchParams.get('secondDestinationId')
  const transferFromId = searchParams.get('transferFromId')
  const transferToId = searchParams.get('transferToId')
  const isTransferView = itineraryType === 'transfer' && firstRouteId && secondRouteId

  const [userLocation, setUserLocation] = useState(null)
  const [locError, setLocError] = useState('')
  const [nearestRoute, setNearestRoute] = useState(null)

  const directRouteQuery = useQuery({
    queryKey: ['route', routeId, direction],
    queryFn: () => api.get(`/api/routes/${routeId}`, { params: { direction } }).then((r) => r.data),
    enabled: !!routeId && !isTransferView,
  })

  const transferRouteQueries = useQueries({
    queries: [
      {
        queryKey: ['route', firstRouteId, firstDirection],
        queryFn: () => api.get(`/api/routes/${firstRouteId}`, { params: { direction: firstDirection } }).then((r) => r.data),
        enabled: Boolean(firstRouteId && isTransferView),
      },
      {
        queryKey: ['route', secondRouteId, secondDirection],
        queryFn: () => api.get(`/api/routes/${secondRouteId}`, { params: { direction: secondDirection } }).then((r) => r.data),
        enabled: Boolean(secondRouteId && isTransferView),
      },
    ],
  })

  const route = !isTransferView ? directRouteQuery.data?.route || null : null
  const directState = route ? buildRouteMapState(route, matchedOriginId, matchedDestinationId) : null

  const firstTransferRoute = transferRouteQueries[0]?.data?.route || null
  const secondTransferRoute = transferRouteQueries[1]?.data?.route || null
  const firstTransferState = firstTransferRoute
    ? buildRouteMapState(firstTransferRoute, firstOriginId, firstDestinationId)
    : null
  const secondTransferState = secondTransferRoute
    ? buildRouteMapState(secondTransferRoute, secondOriginId, secondDestinationId)
    : null
  const sharedTransferStationId =
    firstDestinationId && secondOriginId && String(firstDestinationId) === String(secondOriginId)
      ? String(firstDestinationId)
      : null

  const transferFromStation = secondTransferState?.validStations.find((station) => String(station._id) === transferToId)
    || firstTransferState?.validStations.find((station) => String(station._id) === transferFromId)
    || null
  const transferToStation = secondTransferState?.validStations.find((station) => String(station._id) === transferToId)
    || null

  const transferCoords = []
  if (transferFromStation?.coords?.lat && transferFromStation?.coords?.lng) {
    transferCoords.push([transferFromStation.coords.lat, transferFromStation.coords.lng])
  }
  if (
    transferToStation?.coords?.lat &&
    transferToStation?.coords?.lng &&
    String(transferToStation._id) !== String(transferFromStation?._id)
  ) {
    transferCoords.push([transferToStation.coords.lat, transferToStation.coords.lng])
  }

  const nearestValidStations = nearestRoute ? (nearestRoute.stations || []).filter((s) => s.coords?.lat && s.coords?.lng) : []
  const nearestPolylineCoords = (nearestRoute?.geometryPoints || [])
    .filter((s) => s.coords?.lat && s.coords?.lng)
    .map((s) => [s.coords.lat, s.coords.lng])

  const fitCoords = isTransferView
    ? [
        ...(firstTransferState?.polylineCoords || []),
        ...(secondTransferState?.polylineCoords || []),
        ...transferCoords,
      ]
    : (directState?.polylineCoords || [])

  const isLoading = isTransferView
    ? transferRouteQueries.some((query) => query.isLoading)
    : directRouteQuery.isLoading

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
        try {
          const res = await api.get('/api/routes/near-me', { params: { lat: coordsArr[0], lng: coordsArr[1] } })
          const nearest = res.data.results?.[0]?.route || null
          setNearestRoute(nearest)
        } catch {
          setNearestRoute(null)
        }
      },
      () => setLocError('تعذّر تحديد موقعك — تأكد من صلاحيات الموقع')
    )
  }

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
        {isTransferView && firstTransferState && secondTransferState ? (
          <>
            <div className="p-4" style={{ borderBottom: '1px solid #E5E7EB', backgroundColor: '#FFFBEB' }}>
              <h2 className="font-bold text-base" style={{ color: '#1B2A4A' }}>
                رحلة بتحويلة واحدة
              </h2>
              <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                {transferFromStation && transferToStation && String(transferFromStation._id) !== String(transferToStation._id)
                  ? `انزل في ${transferFromStation.nameAr} ثم امشِ إلى ${transferToStation.nameAr}`
                  : `التحويل عند ${transferFromStation?.nameAr || transferToStation?.nameAr || 'المحطة المشتركة'}`}
              </p>
            </div>
            <StationList
              routeState={firstTransferState}
              title="الركوبة الأولى"
              badge={{ bg: '#FEF3C7', color: '#92400E' }}
            />
            <div className="px-4 py-3" style={{ borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
              <p className="text-xs font-bold" style={{ color: '#6B7280' }}>
                التحويلة
              </p>
              <p className="text-sm mt-1" style={{ color: '#1B2A4A' }}>
                {transferFromStation?.nameAr || transferToStation?.nameAr || 'المحطة المشتركة'}
              </p>
            </div>
            <StationList
              routeState={secondTransferState}
              title="الركوبة الثانية"
              badge={{ bg: '#DBEAFE', color: '#1E40AF' }}
            />
          </>
        ) : directState ? (
          <StationList
            routeState={directState}
            title={null}
            badge={{ bg: '#DBEAFE', color: '#1E40AF' }}
          />
        ) : (
          <div className="p-6 text-center">
            <p className="text-sm" style={{ color: '#9CA3AF' }}>
              اختار خط من البحث لتراه على الخريطة
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

          {!isTransferView && directState?.polylineCoords.length >= 2 && (
            <RoutePolyline
              positions={directState.mutedLeadingCoords}
              palette={{ casing: '#94A3B8', main: '#CBD5E1' }}
              weight={5}
              opacity={0.72}
              muted
            />
          )}

          {!isTransferView && directState?.mutedTrailingCoords.length >= 2 && (
            <RoutePolyline
              positions={directState.mutedTrailingCoords}
              palette={{ casing: '#94A3B8', main: '#CBD5E1' }}
              weight={5}
              opacity={0.72}
              muted
            />
          )}

          {!isTransferView && directState?.highlightGeometryCoords.length === 0 && directState?.polylineCoords.length >= 2 && (
            <RoutePolyline
              positions={directState.polylineCoords}
              palette={{ casing: '#94A3B8', main: '#CBD5E1' }}
              weight={5}
              opacity={0.72}
              muted
            />
          )}

          {!isTransferView && directState?.highlightGeometryCoords.length >= 2 && (
            <RoutePolyline
              positions={directState.highlightGeometryCoords}
              palette={{ casing: '#B45309', main: '#F59E0B' }}
              weight={6}
              opacity={0.94}
            />
          )}

          {isTransferView && firstTransferState?.polylineCoords.length >= 2 && (
            <RoutePolyline
              positions={firstTransferState.mutedLeadingCoords}
              palette={{ casing: '#94A3B8', main: '#D1D5DB' }}
              weight={5}
              opacity={0.7}
              muted
            />
          )}
          {isTransferView && firstTransferState?.mutedTrailingCoords.length >= 2 && (
            <RoutePolyline
              positions={firstTransferState.mutedTrailingCoords}
              palette={{ casing: '#94A3B8', main: '#D1D5DB' }}
              weight={5}
              opacity={0.7}
              muted
            />
          )}
          {isTransferView && secondTransferState?.polylineCoords.length >= 2 && (
            <RoutePolyline
              positions={secondTransferState.mutedLeadingCoords}
              palette={{ casing: '#94A3B8', main: '#D1D5DB' }}
              weight={5}
              opacity={0.7}
              muted
            />
          )}
          {isTransferView && secondTransferState?.mutedTrailingCoords.length >= 2 && (
            <RoutePolyline
              positions={secondTransferState.mutedTrailingCoords}
              palette={{ casing: '#94A3B8', main: '#D1D5DB' }}
              weight={5}
              opacity={0.7}
              muted
            />
          )}
          {isTransferView && firstTransferState?.highlightGeometryCoords.length >= 2 && (
            <RoutePolyline
              positions={firstTransferState.highlightGeometryCoords}
              palette={{ casing: '#9A3412', main: '#F59E0B' }}
              weight={6}
              opacity={0.94}
            />
          )}
          {isTransferView && secondTransferState?.highlightGeometryCoords.length >= 2 && (
            <RoutePolyline
              positions={secondTransferState.highlightGeometryCoords}
              palette={{ casing: '#1D4ED8', main: '#3B82F6' }}
              weight={6}
              opacity={0.94}
            />
          )}

          {isTransferView && firstTransferState?.highlightGeometryCoords.length === 0 && firstTransferState?.polylineCoords.length >= 2 && (
            <RoutePolyline
              positions={firstTransferState.polylineCoords}
              palette={{ casing: '#94A3B8', main: '#D1D5DB' }}
              weight={5}
              opacity={0.7}
              muted
            />
          )}

          {isTransferView && secondTransferState?.highlightGeometryCoords.length === 0 && secondTransferState?.polylineCoords.length >= 2 && (
            <RoutePolyline
              positions={secondTransferState.polylineCoords}
              palette={{ casing: '#94A3B8', main: '#D1D5DB' }}
              weight={5}
              opacity={0.7}
              muted
            />
          )}

          {!isTransferView && directState?.validStations.map((s, i) => {
            const stationId = s?._id ? String(s._id) : null
            const isFirst = stationId === directState.firstValidStationId
            const isLast = stationId === directState.lastValidStationId
            const isEndpoint = isFirst || isLast
            const isMatchedOrigin = matchedOriginId && stationId === matchedOriginId
            const isMatchedDestination = matchedDestinationId && stationId === matchedDestinationId
            const isMatched = isMatchedOrigin || isMatchedDestination
            const isRelevantStation =
              directState.highlightGeometryCoords.length < 2
              || (
                directState.highlightedStationStartIndex >= 0
                && directState.highlightedStationEndIndex >= 0
                && i >= directState.highlightedStationStartIndex
                && i <= directState.highlightedStationEndIndex
              )
            const markerStyle = getPointMarkerStyle({
              isEndpoint,
              isMatchedOrigin,
              isMatchedDestination,
              muted: !isRelevantStation,
            })
            const symbolKind = isMatchedOrigin
              ? 'pickup'
              : isMatchedDestination
                ? 'dropoff'
                : isFirst
                  ? 'start'
                  : isLast
                    ? 'end'
                    : null

            return (
              <StationMarker
                key={i}
                station={s}
                markerStyle={markerStyle}
                isMatchedOrigin={isMatchedOrigin}
                isMatchedDestination={isMatchedDestination}
                isMatched={isMatched}
                isMuted={!isRelevantStation}
                symbolKind={symbolKind}
                popupNote={
                  isMatchedOrigin
                    ? 'نقطة الركوب المطلوبة'
                    : isMatchedDestination
                      ? 'نقطة النزول المطلوبة'
                      : isEndpoint
                        ? (i === 0 ? 'بداية الخط' : 'نهاية الخط')
                        : null
                }
              />
            )
          })}

          {isTransferView && [firstTransferState, secondTransferState].filter(Boolean).map((routeState, legIndex) =>
            routeState.validStations.map((s, i) => {
              const stationId = s?._id ? String(s._id) : null
              const isSharedTransferStation = sharedTransferStationId && stationId === sharedTransferStationId
              if (legIndex === 1 && isSharedTransferStation) {
                return null
              }

              const isFirst = stationId === routeState.firstValidStationId
              const isLast = stationId === routeState.lastValidStationId
              const isEndpoint = isFirst || isLast
              const isMatchedOrigin = routeState.matchedOriginId && stationId === routeState.matchedOriginId
              const isMatchedDestination = routeState.matchedDestinationId && stationId === routeState.matchedDestinationId
              const isMatched = isMatchedOrigin || isMatchedDestination
              const isRelevantStation =
                routeState.highlightGeometryCoords.length < 2
                || (
                  routeState.highlightedStationStartIndex >= 0
                  && routeState.highlightedStationEndIndex >= 0
                  && i >= routeState.highlightedStationStartIndex
                  && i <= routeState.highlightedStationEndIndex
                )
              const accent = legIndex === 0 ? '#92400E' : '#1E40AF'
              const markerStyle = isSharedTransferStation
                ? getTransferMarkerStyle()
                : getPointMarkerStyle({
                    isEndpoint,
                    isMatchedOrigin,
                    isMatchedDestination,
                    accent,
                    muted: !isRelevantStation,
                  })
              const isTransferStation = legIndex === 0
                ? stationId === firstDestinationId
                : stationId === secondOriginId
              const symbolKind = isSharedTransferStation || isTransferStation
                ? 'transfer'
                : legIndex === 0 && stationId === firstOriginId
                  ? 'pickup'
                  : legIndex === 1 && stationId === secondDestinationId
                    ? 'dropoff'
                    : isFirst
                      ? 'start'
                      : isLast
                        ? 'end'
                        : null
              const popupMessage = isTransferStation
                ? 'نقطة التحويل'
                : isSharedTransferStation
                ? 'نقطة التحويل'
                : legIndex === 0 && stationId === firstOriginId
                  ? 'نقطة الركوب المطلوبة'
                  : legIndex === 1 && stationId === secondDestinationId
                    ? 'نقطة النزول المطلوبة'
                    : legIndex === 0
                      ? 'الركوبة الأولى'
                      : 'الركوبة الثانية'

              return (
                <StationMarker
                  key={`${routeState.route.routeId}-${i}`}
                  station={s}
                  markerStyle={markerStyle}
                  isMatchedOrigin={isMatchedOrigin}
                  isMatchedDestination={isMatchedDestination}
                  isMatched={isMatched}
                  isMuted={!isRelevantStation}
                  symbolKind={symbolKind}
                  badgeOverride={isSharedTransferStation ? getTransferBadge() : null}
                  badgeLabel={legIndex === 0 ? 'الأولى' : 'الثانية'}
                  popupNote={popupMessage}
                />
              )
            }),
          )}

          {isTransferView && transferCoords.length >= 2 && (
            <RoutePolyline
              positions={transferCoords}
              palette={{ casing: '#64748B', main: '#CBD5E1' }}
              weight={3}
              opacity={0.88}
              dashed
            />
          )}

          {nearestRoute && (!route || route.routeId !== nearestRoute.routeId) && nearestPolylineCoords.length > 0 && (
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
                return (
                  <CircleMarker
                    key={`near-${i}`}
                    center={[s.coords.lat, s.coords.lng]}
                    radius={isEndpoint ? 10 : 6}
                    pathOptions={{
                      fillColor: '#FEE2E2',
                      color: '#DC2626',
                      weight: 2,
                      dashArray: '6 4',
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

          {userLocation && (
            <CircleMarker
              center={userLocation}
              radius={10}
              pathOptions={{
                fillColor: '#DC2626',
                color: '#991B1B',
                weight: 2,
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

        {!routeId && !isTransferView && (
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

        <button
          onClick={handleLocate}
          className="absolute bottom-6 left-4 z-40 rounded-xl px-4 py-2.5 text-sm font-bold shadow-lg flex items-center gap-2 transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#1B2A4A', color: 'white', fontFamily: 'Cairo, sans-serif' }}
        >
          📍 موقعي الحالي
        </button>

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
