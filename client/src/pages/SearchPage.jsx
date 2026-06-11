import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/axios'
import RouteCard from '../components/RouteCard'
import RatingModal from '../components/RatingModal'
import AmGhareebAvatar from '../components/AmGhareebAvatar'
import { useAuth } from '../context/AuthContext'

// â”€â”€ Skeleton placeholder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SkeletonCard() {
  return (
    <div
      className="rounded-2xl p-5 animate-pulse"
      style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}
    >
      <div className="flex justify-between mb-4">
        <div className="h-5 w-40 rounded" style={{ backgroundColor: '#E5E7EB' }} />
        <div className="h-5 w-16 rounded-full" style={{ backgroundColor: '#E5E7EB' }} />
      </div>
      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 w-20 rounded" style={{ backgroundColor: '#E5E7EB' }} />
        ))}
      </div>
      <div className="h-4 w-28 rounded" style={{ backgroundColor: '#E5E7EB' }} />
    </div>
  )
}

// â”€â”€ Autocomplete input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StationAutocomplete({ value, onChange, placeholder, stations }) {
  const [open, setOpen]           = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  const filtered = value.trim()
    ? stations.filter((s) => s.includes(value.trim())).slice(0, 6)
    : []

  function select(station) {
    onChange(station)
    setOpen(false)
    setHighlighted(-1)
  }

  function handleKeyDown(e) {
    if (!open || filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      select(filtered[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (inputRef.current && !inputRef.current.closest('.autocomplete-wrap')?.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="autocomplete-wrap relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlighted(-1) }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-xl border-2 px-5 py-5 text-lg outline-none transition-all"
        style={{
          fontFamily:      'Cairo, sans-serif',
          borderColor:     '#D1D5DB',
          backgroundColor: '#FFFFFF',
        }}
        onFocus={(e) => { setOpen(true); e.target.style.borderColor = '#F4A833' }}
        onBlur={(e)  => { e.target.style.borderColor = '#D1D5DB' }}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute top-full mt-1 w-full rounded-xl shadow-lg overflow-hidden z-40"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}
        >
          {filtered.map((s, i) => (
            <li
              key={s}
              onMouseDown={() => select(s)}
              className="px-5 py-4 text-lg cursor-pointer transition-colors"
              style={{
                fontFamily:      'Cairo, sans-serif',
                backgroundColor: i === highlighted ? '#FDF6EC' : '#FFFFFF',
                color:           '#1B2A4A',
                fontWeight:      i === highlighted ? 600 : 400,
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// â”€â”€ Swap icon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SwapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

// â”€â”€ History icon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function HistoryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  )
}

// â”€â”€ SearchPage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function SearchPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const [origin, setOrigin]           = useState(searchParams.get('origin') || '')
  const [destination, setDestination] = useState(searchParams.get('destination') || '')
  const [searched, setSearched]       = useState(false)
  const [nearbySearch, setNearbySearch] = useState(false)
  const [ratingRouteId, setRatingRouteId] = useState(null)
  const [savedRouteIds, setSavedRouteIds] = useState([])
  const [savingRouteId, setSavingRouteId] = useState(null)
  const [justSavedRouteId, setJustSavedRouteId] = useState(null)
  const [originCoords, setOriginCoords] = useState(null)
  const [locationError, setLocationError] = useState('')

  // Stations for autocomplete
  const { data: stationsData } = useQuery({
    queryKey: ['stations'],
    queryFn:  () => api.get('/api/routes/stations').then((r) => r.data.stations),
    staleTime: Infinity,
  })
  const stations = stationsData || []

  const { data: savedRoutesData } = useQuery({
    queryKey: ['saved-routes'],
    queryFn:  () => api.get('/api/routes/saved').then((r) => r.data.routes),
    enabled: !!user,
    staleTime: 300000,
  })

  useEffect(() => {
    if (savedRoutesData) {
      setSavedRouteIds(savedRoutesData.map((route) => route.routeId))
    }
  }, [savedRoutesData])

  // Search query (disabled until user clicks search)
  const { data: results, isFetching, isSuccess } = useQuery({
    queryKey: ['search', origin, destination, originCoords],
    queryFn:  () => {
      const params = { origin, destination }
      if (originCoords) {
        params.originLat = originCoords.lat
        params.originLng = originCoords.lng
      }
      return api.get('/api/routes/search', { params }).then((r) => r.data.results)
    },
    enabled: searched && (!!origin || !!originCoords) && !!destination,
  })

  // Nearby search query (find 5 nearest routes from current location)
  const { data: nearbyResults, isFetching: isFetchingNearby, isSuccess: isSuccessNearby } = useQuery({
    queryKey: ['nearby-routes', originCoords],
    queryFn:  () => {
      if (!originCoords) return []
      const params = { lat: originCoords.lat, lng: originCoords.lng }
      return api.get('/api/routes/near-me', { params }).then((r) => r.data.results)
    },
    enabled: nearbySearch && !!originCoords,
  })

  function handleSearch() {
    if ((!origin.trim() && !originCoords) || !destination.trim()) return
    setSearched(true)
  }

  function swap() {
    setOrigin(destination)
    setDestination(origin)
    setOriginCoords(null)
    setLocationError('')
  }

  function useCurrentLocation() {
    if (!user) {
      setLocationError('ÙŠØ¬Ø¨ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„Ù…ÙˆÙ‚Ø¹ Ø§Ù„Ø­Ø§Ù„ÙŠ')
      return
    }

    if (!navigator.geolocation) {
      setLocationError('Ø§Ù„Ù…ØªØµÙØ­ Ù„Ø§ ÙŠØ¯Ø¹Ù… ØªØ­Ø¯ÙŠØ¯ Ø§Ù„Ù…ÙˆÙ‚Ø¹')
      return
    }

    setLocationError('Ø¬Ø§Ø±Ù Ø§Ù„Ø­ØµÙˆÙ„ Ø¹Ù„Ù‰ Ø§Ù„Ù…ÙˆÙ‚Ø¹...')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setOriginCoords(coords)
        setOrigin('')
        setLocationError('')
      },
      (err) => {
        setLocationError('ÙØ´Ù„ Ø§Ù„Ø­ØµÙˆÙ„ Ø¹Ù„Ù‰ Ø§Ù„Ù…ÙˆÙ‚Ø¹. ØªØ£ÙƒØ¯ Ù…Ù† Ø§Ù„Ø³Ù…Ø§Ø­ Ø¨Ø§Ù„ÙˆØµÙˆÙ„.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  }

  function handleNearbySearch() {
    if (!user) {
      setLocationError('ÙŠØ¬Ø¨ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù… Ù‡Ø°Ù‡ Ø§Ù„Ù…ÙŠØ²Ø©')
      return
    }

    if (!navigator.geolocation) {
      setLocationError('Ø§Ù„Ù…ØªØµÙØ­ Ù„Ø§ ÙŠØ¯Ø¹Ù… ØªØ­Ø¯ÙŠØ¯ Ø§Ù„Ù…ÙˆÙ‚Ø¹')
      return
    }

    setLocationError('Ø¬Ø§Ø±Ù Ø§Ù„Ø­ØµÙˆÙ„ Ø¹Ù„Ù‰ Ø§Ù„Ù…ÙˆÙ‚Ø¹...')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setOriginCoords(coords)
        setOrigin('')
        setDestination('')
        setSearched(false)
        setNearbySearch(true)
        setLocationError('')
      },
      (err) => {
        setLocationError('ÙØ´Ù„ Ø§Ù„Ø­ØµÙˆÙ„ Ø¹Ù„Ù‰ Ø§Ù„Ù…ÙˆÙ‚Ø¹. ØªØ£ÙƒØ¯ Ù…Ù† Ø§Ù„Ø³Ù…Ø§Ø­ Ø¨Ø§Ù„ÙˆØµÙˆÙ„.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  }

  async function handleSaveRoute(routeId) {
    if (!user) return

    setSavingRouteId(routeId)
    try {
      if (savedRouteIds.includes(routeId)) {
        await api.delete(`/api/routes/save/${routeId}`)
        setSavedRouteIds((prev) => prev.filter((id) => id !== routeId))
      } else {
        await api.post(`/api/routes/save/${routeId}`)
        setSavedRouteIds((prev) => Array.from(new Set([...prev, routeId])))
        setJustSavedRouteId(routeId)
        setTimeout(() => setJustSavedRouteId(null), 1000)
      }
    } catch (err) {
      // ignore errors silently for now
    } finally {
      setTimeout(() => setSavingRouteId(null), 1000)
    }
  }

  const noResults = isSuccess && results?.length === 0
  const noNearbyResults = isSuccessNearby && nearbyResults?.length === 0

  return (
    <div
      className="min-h-screen pb-16"
      style={{ backgroundColor: '#FDF6EC', fontFamily: 'Cairo, sans-serif' }}
      dir="rtl"
    >
      {/* â”€â”€ Search bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        className="sticky top-0 z-30 shadow-md"
        style={{ backgroundColor: '#1B2A4A' }}
      >
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <StationAutocomplete
              value={origin}
              onChange={(value) => {
                setOrigin(value)
                if (originCoords) setOriginCoords(null)
              }}
              placeholder="Ù…Ù† Ø£ÙŠÙ†ØŸ"
              stations={stations}
            />

            {/* Swap button */}
            <button
              onClick={swap}
              className="flex items-center justify-center rounded-xl p-3.5 transition-colors hover:opacity-80 flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}
              aria-label="ØªØ¨Ø¯ÙŠÙ„ Ø§Ù„Ù†Ù‚Ø·ØªÙŠÙ†"
            >
              <SwapIcon />
            </button>

            <StationAutocomplete
              value={destination}
              onChange={setDestination}
              placeholder="Ø¥Ù„Ù‰ Ø£ÙŠÙ†ØŸ"
              stations={stations}
            />

            <button
              onClick={handleSearch}
              disabled={((!origin.trim() && !originCoords) || !destination.trim())}
              className="rounded-xl px-6 py-4 text-base font-bold transition-all flex-shrink-0 sm:w-auto w-full"
              style={{
                backgroundColor: '#F4A833',
                color:           '#1B2A4A',
                opacity:         ((!origin.trim() && !originCoords) || !destination.trim()) ? 0.6 : 1,
                cursor:          ((!origin.trim() && !originCoords) || !destination.trim()) ? 'not-allowed' : 'pointer',
              }}
            >
              Ø§Ø¨Ø­Ø«
            </button>
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={!user}
              className="rounded-xl px-5 py-4 text-base font-bold transition-all flex-shrink-0 sm:w-auto w-full flex items-center justify-center gap-2"
              style={{
                backgroundColor: user ? '#D1FAE5' : '#E5E7EB',
                color:           user ? '#065F46' : '#6B7280',
                cursor:          user ? 'pointer' : 'not-allowed',
              }}
              title={user ? 'Ø§Ø³ØªØ®Ø¯Ù… Ù…ÙˆÙ‚Ø¹ÙŠ Ø§Ù„Ø­Ø§Ù„ÙŠ ÙƒÙ…Ø­Ø·Ø© Ø¨Ø¯Ø§ÙŠØ©' : 'ÙŠØªØ·Ù„Ø¨ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„'}
            >
              ðŸŒ Ù…ÙˆÙ‚Ø¹ÙŠ Ø§Ù„Ø­Ø§Ù„ÙŠ
            </button>
            <button
              onClick={() => user && navigate('/dashboard')}
              disabled={!user}
              className="rounded-xl px-5 py-4 text-base font-bold transition-all flex-shrink-0 sm:w-auto w-full flex items-center justify-center gap-2"
              style={{
                backgroundColor: user ? '#DBEAFE' : '#E5E7EB',
                color:           user ? '#1E40AF' : '#6B7280',
                cursor:          user ? 'pointer' : 'not-allowed',
              }}
              title={user ? 'Ø§Ù†ØªÙ‚Ù„ Ø¥Ù„Ù‰ Ø³Ø¬Ù„ Ø§Ù„Ø¨Ø­Ø«' : 'Ø³Ø¬Ù„ Ø§Ù„Ø¨Ø­Ø« Ù…ØªØ§Ø­ ÙÙ‚Ø· Ø¨Ø¹Ø¯ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„'}
            >
              <HistoryIcon />
              Ø³Ø¬Ù„ Ø§Ù„Ø¨Ø­Ø«
            </button>
            <button
              type="button"
              onClick={handleNearbySearch}
              disabled={!user}
              className="rounded-xl px-5 py-4 text-base font-bold transition-all flex-shrink-0 sm:w-auto w-full flex items-center justify-center gap-2"
              style={{
                backgroundColor: user ? '#FECACA' : '#E5E7EB',
                color:           user ? '#7F1D1D' : '#6B7280',
                cursor:          user ? 'pointer' : 'not-allowed',
              }}
              title={user ? 'Ø§Ø¨Ø­Ø« Ø¹Ù† Ø£Ù‚Ø±Ø¨ 5 Ø®Ø·ÙˆØ· Ù…Ù† Ù…ÙˆÙ‚Ø¹Ùƒ Ø§Ù„Ø­Ø§Ù„ÙŠ' : 'ÙŠØªØ·Ù„Ø¨ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„'}
            >
              ðŸ“ Ø§Ù„Ø®Ø·ÙˆØ· Ø§Ù„Ù‚Ø±ÙŠØ¨Ø©
            </button>
          </div>
          {locationError && (
            <div className="mt-4 px-4 text-right text-base" style={{ color: '#F87171' }}>
              {locationError}
            </div>
          )}
          {originCoords && !locationError && (
            <div className="mt-4 px-4 text-right text-base" style={{ color: '#D1FAE5' }}>
              ÙŠØªÙ… Ø§Ù„Ø¨Ø­Ø« Ù…Ù† Ù…ÙˆÙ‚Ø¹ÙŠ Ø§Ù„Ø­Ø§Ù„ÙŠ
            </div>
          )}
        </div>
      </div>

      {/* â”€â”€ Results area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
            <p className="text-sm font-semibold" style={{ color: '#6B7280' }}>
              {results.length} Ù†ØªÙŠØ¬Ø© Ù„Ù€ Â«{originCoords && !origin.trim() ? 'Ù…ÙˆÙ‚Ø¹ÙŠ Ø§Ù„Ø­Ø§Ù„ÙŠ' : origin} â† {destination}Â»
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
              <p className="text-sm font-semibold" style={{ color: '#6B7280' }}>
                Ø£Ù‚Ø±Ø¨ {nearbyResults.length} Ø®Ø·ÙˆØ· Ù…Ù† Ù…ÙˆÙ‚Ø¹Ùƒ Ø§Ù„Ø­Ø§Ù„ÙŠ
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

        {/* Empty state for regular search */}
        {!isFetching && searched && noResults && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: '#FDF6EC', border: '2px solid #F4A833' }}
          >
            <AmGhareebAvatar size={64} className="mx-auto mb-4" />
            <p className="text-lg font-bold mb-1" style={{ color: '#1B2A4A' }}>
              Ù…ÙÙŠØ´ Ù†ØªØ§ÙŠØ¬ Ù„Ù„Ù…Ø³Ø§Ø± Ø¯Ù‡
            </p>
            <p className="text-sm mb-5" style={{ color: '#6B7280' }}>
              Ø§Ø³Ø£Ù„ Ø¹Ù… ØºØ±ÙŠØ¨ Ù…Ø¨Ø§Ø´Ø±Ø©Ù‹ ÙˆÙ‡ÙŠØ³Ø§Ø¹Ø¯Ùƒ!
            </p>
            <button
              onClick={() => navigate(`/chat?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`)}
              className="px-6 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#F4A833', color: '#1B2A4A' }}
            >
              Ø§Ø³Ø£Ù„ Ø¹Ù… ØºØ±ÙŠØ¨!
            </button>
          </div>
        )}

        {/* Empty state for nearby search */}
        {!isFetchingNearby && nearbySearch && noNearbyResults && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: '#FDF6EC', border: '2px solid #F4A833' }}
          >
            <AmGhareebAvatar size={64} className="mx-auto mb-4" />
            <p className="text-lg font-bold mb-1" style={{ color: '#1B2A4A' }}>
              Ù…ÙÙŠØ´ Ø®Ø·ÙˆØ· Ù‚Ø±ÙŠØ¨Ø© Ù…Ù†Ùƒ Ø¯Ù„ÙˆÙ‚ØªÙŠ
            </p>
            <p className="text-sm mb-5" style={{ color: '#6B7280' }}>
              Ø¬Ø±Ù‘Ø¨ Ù…ÙˆÙ‚Ø¹ Ø¢Ø®Ø± Ø£Ùˆ Ø§Ø¨Ø­Ø« Ø¨Ù†Ù‚Ø·Ø© Ø¨Ø¯Ø§ÙŠØ© ÙˆÙˆØ¬Ù‡Ø©
            </p>
          </div>
        )}

        {/* Initial state â€” not yet searched */}
        {!searched && !nearbySearch && (
          <div className="text-center py-16">
            <AmGhareebAvatar size={80} className="mx-auto mb-4" />
            <p className="text-base font-semibold" style={{ color: '#1B2A4A' }}>
              Ø§Ø®ØªØ§Ø± Ù†Ù‚Ø·Ø© Ø§Ù„Ø¨Ø¯Ø§ÙŠØ© ÙˆØ§Ù„ÙˆØ¬Ù‡Ø© ÙˆØ§Ø¨Ø­Ø«
            </p>
            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
              Ø¨Ù†Ø¹Ø±Ø¶ Ù„Ùƒ ÙƒÙ„ Ø§Ù„Ø®Ø·ÙˆØ· Ø§Ù„Ù…ØªØ§Ø­Ø© Ù…Ø¹ ØªÙ‚ÙŠÙŠÙ…Ø§Øª Ø§Ù„Ø¯Ù‚Ø©
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
  )
}


