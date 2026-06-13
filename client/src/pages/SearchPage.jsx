import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/axios";
import RouteCard from "../components/RouteCard";
import RatingModal from "../components/RatingModal";
import AmGhareebAvatar from "../components/AmGhareebAvatar";
import { useAuth } from "../context/AuthContext";
import ar from "../i18n/ar";

const { search: t } = ar;

// ── Skeleton placeholder ──────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      className="rounded-2xl p-5 animate-pulse"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB" }}
    >
      <div className="flex justify-between mb-4">
        <div
          className="h-5 w-40 rounded"
          style={{ backgroundColor: "#E5E7EB" }}
        />
        <div
          className="h-5 w-16 rounded-full"
          style={{ backgroundColor: "#E5E7EB" }}
        />
      </div>
      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-4 w-20 rounded"
            style={{ backgroundColor: "#E5E7EB" }}
          />
        ))}
      </div>
      <div
        className="h-4 w-28 rounded"
        style={{ backgroundColor: "#E5E7EB" }}
      />
    </div>
  );
}

// ── Autocomplete input ────────────────────────────────────────────────────────
function StationAutocomplete({
  value,
  onChange,
  placeholder,
  stations,
  flash,
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const filtered = value.trim()
    ? stations.filter((s) => s.includes(value.trim())).slice(0, 6)
    : [];

  function select(station) {
    onChange(station);
    setOpen(false);
    setHighlighted(-1);
  }

  function handleKeyDown(e) {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      select(filtered[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  useEffect(() => {
    function handler(e) {
      if (
        inputRef.current &&
        !inputRef.current.closest(".autocomplete-wrap")?.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="autocomplete-wrap relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlighted(-1);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-xl border-2 px-5 py-5 text-lg outline-none transition-all duration-300"
        style={{
          fontFamily: "Cairo, sans-serif",
          borderColor: flash ? "#F4A833" : "#D1D5DB",
          backgroundColor: flash ? "#FDF6EC" : "#FFFFFF",
        }}
        onFocus={(e) => {
          setOpen(true);
          e.target.style.borderColor = "#F4A833";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "#D1D5DB";
        }}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute top-full mt-1 w-full rounded-xl shadow-lg overflow-hidden z-40"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB" }}
        >
          {filtered.map((s, i) => (
            <li
              key={s}
              onMouseDown={() => select(s)}
              className="px-5 py-4 text-lg cursor-pointer transition-colors"
              style={{
                fontFamily: "Cairo, sans-serif",
                backgroundColor: i === highlighted ? "#FDF6EC" : "#FFFFFF",
                color: "#1B2A4A",
                fontWeight: i === highlighted ? 600 : 400,
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Swap icon ─────────────────────────────────────────────────────────────────
function SwapIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

// ── History icon ──────────────────────────────────────────────────────────────
function HistoryIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

// ── Location pin icon ────────────────────────────────────────────────────────
function PinIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-7.5 8-12a8 8 0 1 0-16 0c0 4.5 8 12 8 12z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

// ── Nearby radar icon ─────────────────────────────────────────────────────────
function RadarIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="8" strokeDasharray="4 3" />
    </svg>
  );
}

// ── Spinner icon ─────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span
      className="inline-block w-4 h-4 rounded-full border-2 animate-spin"
      style={{ borderColor: "currentColor", borderTopColor: "transparent" }}
    />
  );
}

// ── SearchPage ────────────────────────────────────────────────────────────────
export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [origin, setOrigin] = useState(searchParams.get("origin") || "");
  const [destination, setDestination] = useState(
    searchParams.get("destination") || "",
  );
  const [searched, setSearched] = useState(false);
  const [nearbySearch, setNearbySearch] = useState(false);
  const [ratingRouteId, setRatingRouteId] = useState(null);
  const [savedRouteIds, setSavedRouteIds] = useState([]);
  const [savingRouteId, setSavingRouteId] = useState(null);
  const [justSavedRouteId, setJustSavedRouteId] = useState(null);
  const [originCoords, setOriginCoords] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [locatingOrigin, setLocatingOrigin] = useState(false);
  const [locatingNearby, setLocatingNearby] = useState(false);
  const [swapFlash, setSwapFlash] = useState(false);

  // Stations for autocomplete
  const { data: stationsData } = useQuery({
    queryKey: ["stations"],
    queryFn: () => api.get("/api/routes/stations").then((r) => r.data.stations),
    staleTime: Infinity,
  });
  const stations = stationsData || [];

  const { data: savedRoutesData } = useQuery({
    queryKey: ["saved-routes"],
    queryFn: () => api.get("/api/routes/saved").then((r) => r.data.routes),
    enabled: !!user,
    staleTime: 300000,
  });

  useEffect(() => {
    if (savedRoutesData) {
      setSavedRouteIds(savedRoutesData.map((route) => route.routeId));
    }
  }, [savedRoutesData]);

  // Search query (disabled until user clicks search)
  const {
    data: results,
    isFetching,
    isSuccess,
    isError: isSearchError,
  } = useQuery({
    queryKey: ["search", origin, destination, originCoords],
    queryFn: () => {
      const params = { origin, destination };
      if (originCoords) {
        params.originLat = originCoords.lat;
        params.originLng = originCoords.lng;
      }
      return api
        .get("/api/routes/search", { params })
        .then((r) => r.data.results);
    },
    enabled: searched && (!!origin || !!originCoords) && !!destination,
  });

  // Nearby search query
  const {
    data: nearbyResults,
    isFetching: isFetchingNearby,
    isSuccess: isSuccessNearby,
    isError: isNearbyError,
  } = useQuery({
    queryKey: ["nearby-routes", originCoords],
    queryFn: () => {
      if (!originCoords) return [];
      const params = { lat: originCoords.lat, lng: originCoords.lng };
      return api
        .get("/api/routes/near-me", { params })
        .then((r) => r.data.results);
    },
    enabled: nearbySearch && !!originCoords,
  });

  // When a search succeeds with at least one route, jump to the map page
  useEffect(() => {
    if (!isFetching && isSuccess && results?.length > 0) {
      const topRoute = results[0]?.route;
      if (topRoute?.routeId) {
        const params = new URLSearchParams();
        params.set("routeId", topRoute.routeId);
        if (destination.trim()) params.set("destination", destination.trim());
        if (originCoords) {
          // Keep precise GPS coordinates out of the URL (privacy/security:
          // avoids leaking exact location via browser history, referrers,
          // or shared links). Pass via sessionStorage instead.
          try {
            sessionStorage.setItem(
              "amGhareeb:originCoords",
              JSON.stringify(originCoords),
            );
          } catch {
            // sessionStorage unavailable (private mode etc.) — non-fatal
          }
        }
        navigate(`/map?${params.toString()}`);
      }
    }
  }, [isFetching, isSuccess, results, navigate, destination, originCoords]);

  function handleSearch() {
    if ((!origin.trim() && !originCoords) || !destination.trim()) return;
    setSearched(true);
  }

  function swap() {
    setOrigin(destination);
    setDestination(origin);
    setOriginCoords(null);
    setLocationError("");
    setNearbySearch(false);
    setSwapFlash(true);
    setTimeout(() => setSwapFlash(false), 400);
    if (destination.trim() && origin.trim()) {
      setSearched(true);
    }
  }

  // Reverse-geocode coordinates into a human-readable Arabic address
  async function reverseGeocode(lat, lng) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar&zoom=16`,
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.display_name || null;
    } catch {
      return null;
    }
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError(t.geoNotSupported);

      return;
    }
    setLocationError(t.geoFetching);
    setLocatingOrigin(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setOriginCoords({ lat, lng });

        // Try to show a real address in the origin box; fall back to a
        // generic label if the reverse-geocoding service is unreachable.
        const address = await reverseGeocode(lat, lng);
        setOrigin(address || t.myLocationLabel);

        setLocationError("");
        setLocatingOrigin(false);
      },
      () => {
        setLocationError(t.geoFailed);
        setLocatingOrigin(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  function handleNearbySearch() {
    if (!navigator.geolocation) {
      setLocationError(t.geoNotSupported);
      return;
    }
    setLocationError(t.geoFetching);
    setLocatingNearby(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setOriginCoords({ lat, lng });

        // Keep the origin field showing where "نقطتي الحالية" is instead of
        // clearing it — fixes the field appearing empty after switching to
        // nearby-routes search.
        const address = await reverseGeocode(lat, lng);
        setOrigin(address || t.myLocationLabel);

        setDestination("");
        setSearched(false);
        setNearbySearch(true);
        setLocationError("");
        setLocatingNearby(false);
      },
      () => {
        setLocationError(t.geoFailed);
        setLocatingNearby(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  async function handleSaveRoute(routeId) {
    if (!user) return;
    setSavingRouteId(routeId);
    try {
      if (savedRouteIds.includes(routeId)) {
        await api.delete(`/api/routes/save/${routeId}`);
        setSavedRouteIds((prev) => prev.filter((id) => id !== routeId));
      } else {
        await api.post(`/api/routes/save/${routeId}`);
        setSavedRouteIds((prev) => Array.from(new Set([...prev, routeId])));
        setJustSavedRouteId(routeId);
        setTimeout(() => setJustSavedRouteId(null), 1000);
      }
    } catch {
      // ignore errors silently for now
    } finally {
      setTimeout(() => setSavingRouteId(null), 1000);
    }
  }

  const noResults = isSuccess && results?.length === 0;
  const noNearbyResults = isSuccessNearby && nearbyResults?.length === 0;

  const originLabel =
    originCoords && !origin.trim() ? t.myLocationLabel : origin;

  return (
    <div
      className="min-h-screen pb-16"
      style={{ backgroundColor: "#FDF6EC", fontFamily: "Cairo, sans-serif" }}
      dir="rtl"
    >
      {/* ── Search bar ──────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30 shadow-md"
        style={{ backgroundColor: "#1B2A4A" }}
      >
        <div className="max-w-4xl mx-auto px-4 py-5">
          {/* Row 1 — origin / swap / destination / search (primary action) */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            <StationAutocomplete
              value={origin}
              onChange={(value) => {
                setOrigin(value);
                if (originCoords) setOriginCoords(null);
              }}
              placeholder={locatingOrigin ? t.geoFetching : t.placeholderFrom}
              stations={stations}
              flash={swapFlash}
            />

            {/* Swap button */}
            <button
              type="button"
              onClick={swap}
              className="group flex items-center justify-center rounded-xl p-3.5 transition-all hover:opacity-80 active:scale-90 flex-shrink-0"
              style={{
                backgroundColor: "rgba(255,255,255,0.15)",
                color: "white",
              }}
              aria-label={t.swapLabel}
              title={t.swapLabel}
            >
              <span className="inline-block transition-transform duration-300 group-active:rotate-180">
                <SwapIcon />
              </span>
            </button>

            <StationAutocomplete
              value={destination}
              onChange={setDestination}
              placeholder={t.placeholderTo}
              stations={stations}
              flash={swapFlash}
            />

            <button
              onClick={handleSearch}
              disabled={
                (!origin.trim() && !originCoords) || !destination.trim()
              }
              className="rounded-xl px-8 py-4 text-base font-bold transition-all flex-shrink-0 sm:w-auto w-full"
              style={{
                backgroundColor: "#F4A833",
                color: "#1B2A4A",
                opacity:
                  (!origin.trim() && !originCoords) || !destination.trim()
                    ? 0.6
                    : 1,
                cursor:
                  (!origin.trim() && !originCoords) || !destination.trim()
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {t.searchBtn}
            </button>
          </div>

          {/* Row 2 — secondary quick actions */}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locatingOrigin}
              className="rounded-full px-4 py-2 text-sm font-bold transition-all flex items-center justify-center gap-2 hover:opacity-80"
              style={{
                backgroundColor: "rgba(16,185,129,0.15)",
                color: "#6EE7B7",
                cursor: locatingOrigin ? "wait" : "pointer",
              }}
              title={t.locationTitleBtn}
            >
              {locatingOrigin ? <Spinner /> : <PinIcon />}
              {t.myLocationBtn}
            </button>

            <button
              type="button"
              onClick={handleNearbySearch}
              disabled={locatingNearby}
              className="rounded-full px-4 py-2 text-sm font-bold transition-all flex items-center justify-center gap-2 hover:opacity-80"
              style={{
                backgroundColor: "rgba(248,113,113,0.15)",
                color: "#FCA5A5",
                cursor: locatingNearby ? "wait" : "pointer",
              }}
              title={t.nearbyTitleBtn}
            >
              {locatingNearby ? <Spinner /> : <RadarIcon />}
              {t.nearbyBtn}
            </button>

            <button
              onClick={() => user && navigate("/dashboard")}
              disabled={!user}
              className="rounded-full px-4 py-2 text-sm font-bold transition-all flex items-center justify-center gap-2 hover:opacity-80"
              style={{
                backgroundColor: user
                  ? "rgba(96,165,250,0.15)"
                  : "rgba(255,255,255,0.06)",
                color: user ? "#93C5FD" : "#6B7280",
                cursor: user ? "pointer" : "not-allowed",
              }}
              title={user ? t.historyTitleBtn : t.historyLoginTitle}
            >
              <HistoryIcon />
              {t.historyBtn}
            </button>
          </div>

          {locationError && (
            <div
              className="mt-3 px-1 text-right text-sm"
              style={{ color: "#FCA5A5" }}
            >
              {locationError}
            </div>
          )}
          {originCoords && !locationError && !locatingOrigin && (
            <div
              className="mt-3 px-1 text-right text-sm"
              style={{ color: "#6EE7B7" }}
            >
              {t.searchingFromLocation}
            </div>
          )}
        </div>
      </div>

      {/* ── Results area ─────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 pt-6">
        {/* Loading skeletons */}
        {(isFetching || isFetchingNearby) && (
          <div className="flex flex-col gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Regular search results */}
        {!isFetching && isSuccess && results?.length > 0 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-semibold" style={{ color: "#6B7280" }}>
              {t.resultsCount(results.length, originLabel, destination)}
            </p>
            {results.map(({ route, accuracyStats }) => (
              <RouteCard
                key={route._id || route.routeId}
                route={route}
                accuracyStats={accuracyStats}
                onRateClick={(id) => setRatingRouteId(id)}
                onSaveClick={handleSaveRoute}
                onUnsaveClick={handleSaveRoute}
                isSaved={savedRouteIds.includes(route.routeId)}
                isSaving={savingRouteId === route.routeId}
                isJustSaved={justSavedRouteId === route.routeId}
              />
            ))}
          </div>
        )}

        {/* Nearby search results */}
        {!isFetchingNearby && isSuccessNearby && nearbyResults?.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold" style={{ color: "#6B7280" }}>
                {t.nearbyCount(nearbyResults.length)}
              </p>
            </div>
            {nearbyResults.map(({ route, accuracyStats }) => (
              <RouteCard
                key={route._id || route.routeId}
                route={route}
                accuracyStats={accuracyStats}
                onRateClick={(id) => setRatingRouteId(id)}
                onSaveClick={handleSaveRoute}
                onUnsaveClick={handleSaveRoute}
                isSaved={savedRouteIds.includes(route.routeId)}
                isSaving={savingRouteId === route.routeId}
                isJustSaved={justSavedRouteId === route.routeId}
              />
            ))}
          </div>
        )}

        {/* Error state — regular search failed */}
        {!isFetching && isSearchError && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: "#FEE2E2", border: "2px solid #DC2626" }}
          >
            <p className="text-lg font-bold mb-1" style={{ color: "#7F1D1D" }}>
              {t.errorTitle}
            </p>
            <p className="text-sm" style={{ color: "#991B1B" }}>
              {t.errorBody}
            </p>
          </div>
        )}

        {/* Error state — nearby search failed */}
        {!isFetchingNearby && isNearbyError && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: "#FEE2E2", border: "2px solid #DC2626" }}
          >
            <p className="text-lg font-bold mb-1" style={{ color: "#7F1D1D" }}>
              {t.errorTitle}
            </p>
            <p className="text-sm" style={{ color: "#991B1B" }}>
              {t.errorBody}
            </p>
          </div>
        )}

        {/* Empty state for regular search */}
        {!isFetching && searched && noResults && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: "#FDF6EC", border: "2px solid #F4A833" }}
          >
            <AmGhareebAvatar size={64} className="mx-auto mb-4" />
            <p className="text-lg font-bold mb-1" style={{ color: "#1B2A4A" }}>
              {t.noResults}
            </p>
            <p className="text-sm mb-5" style={{ color: "#6B7280" }}>
              {t.noResultsBody}
            </p>
            <button
              onClick={() =>
                navigate(
                  `/chat?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`,
                )
              }
              className="px-6 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
              style={{ backgroundColor: "#F4A833", color: "#1B2A4A" }}
            >
              {t.noResultsBtn}
            </button>
          </div>
        )}

        {/* Empty state for nearby search */}
        {!isFetchingNearby && nearbySearch && noNearbyResults && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: "#FDF6EC", border: "2px solid #F4A833" }}
          >
            <AmGhareebAvatar size={64} className="mx-auto mb-4" />
            <p className="text-lg font-bold mb-1" style={{ color: "#1B2A4A" }}>
              {t.noNearby}
            </p>
            <p className="text-sm mb-5" style={{ color: "#6B7280" }}>
              {t.noNearbyBody}
            </p>
          </div>
        )}

        {/* Initial state — not yet searched */}
        {!searched && !nearbySearch && (
          <div className="text-center py-16">
            <AmGhareebAvatar size={80} className="mx-auto mb-4" />
            <p className="text-base font-semibold" style={{ color: "#1B2A4A" }}>
              {t.initialPrompt}
            </p>
            <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>
              {t.initialBody}
            </p>
          </div>
        )}
      </div>

      {/* Rating modal */}
      {ratingRouteId && (
        <RatingModal
          routeId={ratingRouteId}
          onClose={() => setRatingRouteId(null)}
          onSuccess={() => setRatingRouteId(null)}
        />
      )}
    </div>
  );
}
