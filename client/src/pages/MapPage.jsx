import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  Circle,
  ZoomControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../lib/axios";
import ar from "../i18n/ar";

const { map: t } = ar;

// ── Fix Leaflet default icon URLs (broken by Vite asset hashing) ──────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Pulsing "my location" marker icon ──────────────────────────────────────
const userLocationIcon = L.divIcon({
  className: "am-ghareeb-user-location",
  html: '<span class="am-ghareeb-user-dot"><span class="am-ghareeb-user-pulse"></span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// ── Auto-fit map bounds when a route loads ────────────────────────────────────
function FitBounds({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length >= 2) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    }
  }, [coords, map]);
  return null;
}

// ── Fly the map to the user's location when found ──────────────────────────
function FlyToLocation({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 14, { duration: 1.2 });
    }
  }, [position, map]);
  return null;
}

// ── Haversine distance in meters between two [lat,lng] points ─────────────────
function distanceMeters(a, b) {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function MapPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const routeId = searchParams.get("routeId");
  const destinationName = searchParams.get("destination");

  const [userLocation, setUserLocation] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [nearestRoute, setNearestRoute] = useState(null);
  const [tracking, setTracking] = useState(false);

  // Refresh nearest-route info for a given coordinate (used by both
  // one-shot locate and live tracking)
  async function refreshNearestRoute(coordsArr) {
    try {
      const res = await api.get("/api/routes/near-me", {
        params: { lat: coordsArr[0], lng: coordsArr[1] },
      });
      const nearest = res.data.results?.[0]?.route || null;
      setNearestRoute(nearest);
    } catch {
      setNearestRoute(null);
    }
  }

  // Live tracking — keep the user marker in sync with their movement
  useEffect(() => {
    if (!tracking || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coordsArr = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(coordsArr);
        setAccuracy(pos.coords.accuracy);
        setLocError("");
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLocError(t.geoDenied);
            break;
          case err.POSITION_UNAVAILABLE:
            setLocError(t.geoUnavailable);
            break;
          case err.TIMEOUT:
            setLocError(t.geoTimeout);
            break;
          default:
            setLocError(t.geoFailed);
        }
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking]);

  // Fetch the selected route
  const { data, isLoading } = useQuery({
    queryKey: ["route", routeId],
    queryFn: () => api.get(`/api/routes/${routeId}`).then((r) => r.data),
    enabled: !!routeId,
  });

  const route = data?.route || null;

  // Stations with real GPS coordinates (filter zero-coord placeholders)
  const validStations = route
    ? route.stations.filter((s) => s.coords?.lat !== 0 && s.coords?.lng !== 0)
    : [];

  // Polyline positions
  const polylineCoords = validStations.map((s) => [s.coords.lat, s.coords.lng]);

  // Nearest route (from user's location) computed stations/coords
  const nearestValidStations = nearestRoute
    ? (nearestRoute.stations || []).filter(
        (s) => s.coords?.lat && s.coords?.lng,
      )
    : [];
  const nearestPolylineCoords = nearestValidStations.map((s) => [
    s.coords.lat,
    s.coords.lng,
  ]);

  // If the search page sent us straight here with the user's coordinates,
  // mark the origin on the map immediately — no extra click needed.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("amGhareeb:originCoords");
      if (stored) {
        const { lat, lng } = JSON.parse(stored);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          setUserLocation([lat, lng]);
        }
        // One-time use — remove so refreshing/navigating away doesn't replay it
        sessionStorage.removeItem("amGhareeb:originCoords");
      }
    } catch {
      // ignore malformed/missing storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The destination station chosen on the search page (shown as a red marker)
  const destinationStation = destinationName
    ? validStations.find((s) => s.nameAr === destinationName)
    : null;

  // The route station closest to the user's current location
  const nearestStation = (() => {
    if (!userLocation || validStations.length === 0) return null;
    let best = null;
    let bestDist = Infinity;
    for (const s of validStations) {
      const d = distanceMeters(userLocation, [s.coords.lat, s.coords.lng]);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  })();

  const toNearestStationCoords = nearestStation
    ? [
        [userLocation[0], userLocation[1]],
        [nearestStation.coords.lat, nearestStation.coords.lng],
      ]
    : [];
  // Walking distance/time from the user to the nearest station
  const walkMeters = nearestStation
    ? distanceMeters(userLocation, [
        nearestStation.coords.lat,
        nearestStation.coords.lng,
      ])
    : null;
  const walkMinutes =
    walkMeters != null ? Math.max(1, Math.round(walkMeters / 80)) : null; // ~80 m/min walking pace

  // Total route distance + rough travel time (assumes ~18 km/h average city speed)
  const routeMeters =
    polylineCoords.length >= 2
      ? polylineCoords
          .slice(1)
          .reduce(
            (sum, coord, i) => sum + distanceMeters(polylineCoords[i], coord),
            0,
          )
      : 0;
  const routeMinutes =
    routeMeters > 0
      ? Math.max(1, Math.round((routeMeters / 1000 / 18) * 60))
      : null;

  function formatDistance(meters) {
    return meters >= 1000
      ? `${(meters / 1000).toFixed(1)} كم`
      : `${Math.round(meters)} م`;
  }

  function handleLocate() {
    setLocError("");
    if (!navigator.geolocation) {
      setLocError(t.geoNotSupported);
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coordsArr = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(coordsArr);
        setAccuracy(pos.coords.accuracy);
        setLocating(false);
        refreshNearestRoute(coordsArr);
      },
      (err) => {
        setLocating(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLocError(t.geoDenied);
            break;
          case err.POSITION_UNAVAILABLE:
            setLocError(t.geoUnavailable);
            break;
          case err.TIMEOUT:
            setLocError(t.geoTimeout);
            break;
          default:
            setLocError(t.geoFailed);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }

  return (
    <>
      <style>{`
      .am-ghareeb-user-location { background: transparent; border: none; }
      .am-ghareeb-user-dot {
        position: relative;
        display: block;
        width: 16px;
        height: 16px;
        margin: 3px;
        background: #10B981;
        border: 2px solid #FFFFFF;
        border-radius: 50%;
        box-shadow: 0 0 4px rgba(0,0,0,0.35);
      }
      .am-ghareeb-user-pulse {
        position: absolute;
        top: -8px;
        left: -8px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(16, 185, 129, 0.35);
        animation: am-ghareeb-pulse 1.8s ease-out infinite;
      }
      @keyframes am-ghareeb-pulse {
        0% { transform: scale(0.6); opacity: 0.8; }
        70% { transform: scale(1.8); opacity: 0; }
        100% { transform: scale(1.8); opacity: 0; }
      }
      .leaflet-popup-content-wrapper { border-radius: 12px; }
      .leaflet-control-zoom { border: none !important; box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important; }
    `}</style>
      <div
        className="flex"
        style={{
          height: "calc(100vh - 64px)",
          fontFamily: "Cairo, sans-serif",
        }}
        dir="rtl"
      >
        {/* ── Sidebar (desktop only, right side in RTL) ───────────────────── */}
        <aside
          className="hidden md:flex flex-col w-72 overflow-y-auto"
          style={{
            backgroundColor: "#FFFFFF",
            borderLeft: "1px solid #E5E7EB",
            flexShrink: 0,
          }}
        >
          {route ? (
            <>
              {/* Route header */}
              <div
                className="p-4"
                style={{ borderBottom: "1px solid #E5E7EB" }}
              >
                <h2
                  className="font-bold text-base"
                  style={{ color: "#1B2A4A" }}
                >
                  {route.nameAr}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
                  {route.nameEn}
                </p>
                <span
                  className="inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
                >
                  {t.fareRange(route.fare?.min, route.fare?.max)}
                </span>

                {/* Trip summary — total ride time + walk to nearest station */}
                {(routeMinutes || walkMinutes) && (
                  <div className="mt-3 flex flex-col gap-2">
                    {routeMinutes && (
                      <div
                        className="flex items-center justify-between text-xs font-bold px-3 py-2 rounded-xl"
                        style={{ backgroundColor: "#FDF6EC", color: "#1B2A4A" }}
                      >
                        <span>{t.rideDuration}</span>
                        <span>
                          {t.minutes(routeMinutes)} ·{" "}
                          {formatDistance(routeMeters)}
                        </span>
                      </div>
                    )}
                    {walkMinutes && nearestStation && (
                      <div
                        className="flex items-center justify-between text-xs font-bold px-3 py-2 rounded-xl"
                        style={{ backgroundColor: "#ECFDF5", color: "#047857" }}
                      >
                        <span>{t.walkToStation(nearestStation.nameAr)}</span>
                        <span>
                          {t.minutes(walkMinutes)} ·{" "}
                          {formatDistance(walkMeters)}
                        </span>
                      </div>
                    )}
                    {walkMeters != null && walkMeters > 1000 && (
                      <div
                        className="text-xs font-bold px-3 py-2 rounded-xl"
                        style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
                      >
                        🛺 {t.rideSuggestion}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* All stations — including zero-coord ones (shown greyed out) */}
              <div className="p-4">
                <p
                  className="text-xs font-semibold mb-3"
                  style={{ color: "#6B7280" }}
                >
                  {t.stationsCount(route.stations.length)}
                </p>
                <ol className="flex flex-col gap-2.5">
                  {route.stations.map((s, i) => {
                    const hasCoords =
                      s.coords?.lat !== 0 && s.coords?.lng !== 0;
                    const isFirst = i === 0;
                    const isLast = i === route.stations.length - 1;
                    const isDestination =
                      destinationStation &&
                      s.nameAr === destinationStation.nameAr;
                    const isNearest =
                      nearestStation && s.nameAr === nearestStation.nameAr;
                    return (
                      <li
                        key={i}
                        className="flex items-center gap-2 rounded-lg px-1.5 py-1 -mx-1.5"
                        style={{
                          backgroundColor: isDestination
                            ? "#FEE2E2"
                            : isNearest
                              ? "#ECFDF5"
                              : "transparent",
                        }}
                      >
                        <span
                          className="text-xs font-bold mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{
                            backgroundColor: isFirst
                              ? "#F4A833"
                              : isLast
                                ? "#1B2A4A"
                                : "#E5E7EB",
                            color: isFirst || isLast ? "white" : "#6B7280",
                            fontSize: 10,
                          }}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm font-medium leading-tight"
                            style={{ color: hasCoords ? "#1B2A4A" : "#9CA3AF" }}
                          >
                            {s.nameAr}
                          </p>
                          {!hasCoords && (
                            <span
                              className="inline-block text-xs px-1.5 py-0.5 rounded mt-0.5"
                              style={{
                                backgroundColor: "#F3F4F6",
                                color: "#9CA3AF",
                              }}
                            >
                              {t.noCoords}
                            </span>
                          )}
                        </div>
                        {isDestination && (
                          <span
                            className="text-xs font-bold flex-shrink-0"
                            style={{ color: "#DC2626" }}
                          >
                            🔴 {t.destinationTag}
                          </span>
                        )}
                        {isNearest && !isDestination && (
                          <span
                            className="text-xs font-bold flex-shrink-0"
                            style={{ color: "#047857" }}
                          >
                            🟢 {t.nearestTag}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </>
          ) : (
            <div className="p-6 text-center">
              <p className="text-sm" style={{ color: "#9CA3AF" }}>
                {t.sidebarEmpty}
              </p>
            </div>
          )}
        </aside>

        {/* ── Map area ────────────────────────────────────────────────────── */}
        <div className="flex-1 relative">
          <MapContainer
            center={[31.2001, 29.9187]}
            zoom={12}
            style={{ width: "100%", height: "100%" }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <ZoomControl position="bottomright" />

            {(() => {
              const fitCoords = [...polylineCoords];
              if (userLocation) fitCoords.push(userLocation);
              if (destinationStation)
                fitCoords.push([
                  destinationStation.coords.lat,
                  destinationStation.coords.lng,
                ]);
              return fitCoords.length >= 2 && <FitBounds coords={fitCoords} />;
            })()}

            {polylineCoords.length >= 2 && (
              <Polyline
                positions={polylineCoords}
                pathOptions={{ color: "#1B2A4A", weight: 4, opacity: 0.85 }}
              />
            )}

            {route &&
              validStations.map((s, i) => {
                const isEndpoint = i === 0 || i === validStations.length - 1;
                return (
                  <CircleMarker
                    key={i}
                    center={[s.coords.lat, s.coords.lng]}
                    radius={isEndpoint ? 12 : 8}
                    pathOptions={{
                      fillColor: "#F4A833",
                      color: "#1B2A4A",
                      weight: 2,
                      fillOpacity: 0.9,
                    }}
                  >
                    <Popup>
                      <div
                        style={{
                          fontFamily: "Cairo, sans-serif",
                          direction: "rtl",
                          textAlign: "right",
                          minWidth: 120,
                        }}
                      >
                        <strong style={{ color: "#1B2A4A", display: "block" }}>
                          {s.nameAr}
                        </strong>
                        <span style={{ color: "#6B7280", fontSize: 12 }}>
                          {s.nameEn}
                        </span>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}

            {nearestRoute &&
              (!route || route.routeId !== nearestRoute.routeId) &&
              nearestPolylineCoords.length > 0 && (
                <>
                  {nearestPolylineCoords.length >= 2 && (
                    <Polyline
                      positions={nearestPolylineCoords}
                      pathOptions={{
                        color: "#DC2626",
                        weight: 3,
                        dashArray: "8 6",
                        opacity: 0.9,
                      }}
                    />
                  )}
                  {nearestValidStations.map((s, i) => {
                    const isEndpoint =
                      i === 0 || i === nearestValidStations.length - 1;
                    return (
                      <CircleMarker
                        key={`near-${i}`}
                        center={[s.coords.lat, s.coords.lng]}
                        radius={isEndpoint ? 10 : 6}
                        pathOptions={{
                          fillColor: "#FEE2E2",
                          color: "#DC2626",
                          weight: 2,
                          dashArray: "6 4",
                          fillOpacity: 0.9,
                        }}
                      >
                        <Popup>
                          <div
                            style={{
                              fontFamily: "Cairo, sans-serif",
                              direction: "rtl",
                              textAlign: "right",
                              minWidth: 120,
                            }}
                          >
                            <strong
                              style={{ color: "#1B2A4A", display: "block" }}
                            >
                              {s.nameAr}
                            </strong>
                            <span style={{ color: "#6B7280", fontSize: 12 }}>
                              {s.nameEn}
                            </span>
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                </>
              )}

            {userLocation &&
              polylineCoords.length < 2 &&
              !destinationStation && <FlyToLocation position={userLocation} />}

            {userLocation && accuracy && (
              <Circle
                center={userLocation}
                radius={Math.min(accuracy, 150)}
                pathOptions={{
                  color: "#10B981",
                  fillColor: "#10B981",
                  fillOpacity: 0.08,
                  weight: 1,
                  dashArray: "4 4",
                }}
              />
            )}

            {/* Origin marker — the user's current location (pulsing dot) */}
            {userLocation && (
              <Marker position={userLocation} icon={userLocationIcon}>
                <Popup>
                  <div
                    style={{
                      fontFamily: "Cairo, sans-serif",
                      direction: "rtl",
                    }}
                  >
                    {t.myLocationPopup}
                    {accuracy && (
                      <div
                        className="mt-1 text-xs"
                        style={{ color: "#6B7280" }}
                      >
                        {t.accuracyLabel(Math.round(accuracy))}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Destination marker — the station chosen on the search page (red) */}
            {destinationStation && (
              <CircleMarker
                center={[
                  destinationStation.coords.lat,
                  destinationStation.coords.lng,
                ]}
                radius={12}
                pathOptions={{
                  fillColor: "#DC2626",
                  color: "#7F1D1D",
                  weight: 2,
                  fillOpacity: 0.95,
                }}
              >
                <Popup>
                  <div
                    style={{
                      fontFamily: "Cairo, sans-serif",
                      direction: "rtl",
                      textAlign: "right",
                      minWidth: 140,
                    }}
                  >
                    <strong style={{ color: "#7F1D1D", display: "block" }}>
                      {t.destinationPopup}
                    </strong>
                    <span style={{ color: "#1B2A4A" }}>
                      {destinationStation.nameAr}
                    </span>
                    {routeMinutes && (
                      <div
                        className="mt-1 text-xs"
                        style={{ color: "#6B7280" }}
                      >
                        {t.estimatedArrival(routeMinutes)}
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            )}

            {/* Dashed walking line from the user to the nearest station on the route */}
            {toNearestStationCoords.length === 2 && (
              <Polyline
                positions={toNearestStationCoords}
                pathOptions={{
                  color: "#10B981",
                  weight: 3,
                  dashArray: "6 6",
                  opacity: 0.9,
                }}
              />
            )}

            {nearestStation && (
              <CircleMarker
                center={[nearestStation.coords.lat, nearestStation.coords.lng]}
                radius={9}
                pathOptions={{
                  fillColor: "#FFFFFF",
                  color: "#10B981",
                  weight: 3,
                  dashArray: "4 3",
                  fillOpacity: 1,
                }}
              >
                <Popup>
                  <div
                    style={{
                      fontFamily: "Cairo, sans-serif",
                      direction: "rtl",
                      textAlign: "right",
                      minWidth: 140,
                    }}
                  >
                    <strong style={{ color: "#047857", display: "block" }}>
                      {t.nearestStationPopup}
                    </strong>
                    <span style={{ color: "#1B2A4A" }}>
                      {nearestStation.nameAr}
                    </span>
                    {walkMinutes && (
                      <div
                        className="mt-1 text-xs"
                        style={{ color: "#6B7280" }}
                      >
                        {t.minutes(walkMinutes)} · {formatDistance(walkMeters)}
                      </div>
                    )}
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
                style={{ backgroundColor: "#FFFFFF", maxWidth: 280 }}
              >
                <p
                  className="font-bold text-base mb-1"
                  style={{ color: "#1B2A4A" }}
                >
                  {t.noRouteTitle}
                </p>
                <p className="text-sm mb-4" style={{ color: "#9CA3AF" }}>
                  {t.noRouteBody}
                </p>
                <button
                  onClick={() => navigate("/search")}
                  className="px-5 py-2 rounded-xl text-sm font-bold"
                  style={{ backgroundColor: "#F4A833", color: "#1B2A4A" }}
                >
                  {t.noRouteBtn}
                </button>
              </div>
            </div>
          )}

          {/* Loading spinner */}
          {isLoading && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.7)", zIndex: 500 }}
            >
              <div
                className="w-10 h-10 rounded-full border-4 animate-spin"
                style={{
                  borderColor: "#F4A833",
                  borderTopColor: "transparent",
                }}
              />
            </div>
          )}

          {/* Floating user location button */}
          <button
            onClick={handleLocate}
            disabled={locating}
            className="absolute bottom-6 left-4 z-40 rounded-xl px-4 py-2.5 text-sm font-bold shadow-lg flex items-center gap-2 transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "#1B2A4A",
              color: "white",
              fontFamily: "Cairo, sans-serif",
              opacity: locating ? 0.7 : 1,
              cursor: locating ? "wait" : "pointer",
            }}
          >
            {locating && (
              <span
                className="w-4 h-4 rounded-full border-2 animate-spin"
                style={{
                  borderColor: "#F4A833",
                  borderTopColor: "transparent",
                }}
              />
            )}
            {locating ? t.geoLocating : t.myLocationBtn}
          </button>

          {/* Live tracking toggle */}
          <button
            onClick={() => setTracking((v) => !v)}
            className="absolute bottom-6 z-40 rounded-xl px-4 py-2.5 text-sm font-bold shadow-lg transition-opacity hover:opacity-90"
            style={{
              left: 168,
              backgroundColor: tracking ? "#10B981" : "#FFFFFF",
              color: tracking ? "white" : "#1B2A4A",
              border: tracking ? "none" : "1px solid #E5E7EB",
              fontFamily: "Cairo, sans-serif",
            }}
          >
            {tracking ? `🟢 ${t.liveTrackingOff}` : `⚪ ${t.liveTrackingOn}`}
          </button>

          {/* Map legend — explains marker colors, plus a usage tip */}
          <div
            className="absolute top-4 left-4 z-40 rounded-2xl shadow-lg p-3.5 text-xs flex flex-col gap-2"
            style={{
              backgroundColor: "rgba(255,255,255,0.97)",
              fontFamily: "Cairo, sans-serif",
              minWidth: 170,
              maxWidth: 220,
              border: "1px solid #F4A833",
            }}
          >
            <p
              className="font-bold text-sm mb-0.5"
              style={{ color: "#1B2A4A" }}
            >
              {t.legendTitle}
            </p>

            {userLocation && (
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: "#10B981",
                    boxShadow: "0 0 0 3px rgba(16,185,129,0.2)",
                  }}
                />
                <span style={{ color: "#1B2A4A" }}>{t.legendOrigin}</span>
              </div>
            )}
            {destinationStation && (
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "#DC2626" }}
                />
                <span style={{ color: "#1B2A4A" }}>{t.legendDestination}</span>
              </div>
            )}
            {nearestStation && (
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 border-2"
                  style={{ borderColor: "#10B981", backgroundColor: "#FFFFFF" }}
                />
                <span style={{ color: "#1B2A4A" }}>{t.legendNearest}</span>
              </div>
            )}
            {polylineCoords.length >= 2 && (
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-0.5 flex-shrink-0 rounded"
                  style={{ backgroundColor: "#1B2A4A" }}
                />
                <span style={{ color: "#1B2A4A" }}>{t.legendRoute}</span>
              </div>
            )}
            {nearestRoute &&
              (!route || route.routeId !== nearestRoute.routeId) && (
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-0.5 flex-shrink-0 rounded"
                    style={{
                      background:
                        "repeating-linear-gradient(to right, #DC2626 0 5px, transparent 5px 9px)",
                    }}
                  />
                  <span style={{ color: "#1B2A4A" }}>
                    {t.legendNearestRoute}
                  </span>
                </div>
              )}

            {/* Usage tip — shown until the user shares their location */}
            {!userLocation && (
              <div
                className="mt-1 pt-2 rounded-lg"
                style={{ borderTop: "1px dashed #E5E7EB" }}
              >
                <p className="font-bold mb-0.5" style={{ color: "#1B2A4A" }}>
                  {t.mapTipTitle}
                </p>
                <p style={{ color: "#6B7280" }}>{t.mapTipBody}</p>
              </div>
            )}
          </div>

          {/* Location error toast */}
          {locError && (
            <div
              className="absolute bottom-20 left-4 z-40 rounded-xl px-4 py-2 text-sm shadow"
              style={{
                backgroundColor: "#FEE2E2",
                color: "#991B1B",
                fontFamily: "Cairo, sans-serif",
              }}
            >
              {locError}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
