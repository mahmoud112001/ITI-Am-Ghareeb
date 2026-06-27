import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import AmGhareebAvatar from '../components/AmGhareebAvatar'
import RouteCard from '../components/RouteCard'
import TravelPlanCard from '../components/TravelPlanCard'
import RatingModal from '../components/RatingModal'
import TravelPlanRatingModal from '../components/TravelPlanRatingModal'
import api from '../lib/axios'
import ar from '../i18n/ar'

const { dashboard: t, common } = ar

// ── Relative time ─────────────────────────────────────────────────────────────
function relativeAr(dateStr) {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 60)  return common.minutesAgo(mins)
  if (hours < 24)  return common.hoursAgo(hours)
  if (days  === 1) return common.yesterday
  return common.daysAgo(days)
}

// ── Tab button ────────────────────────────────────────────────────────────────
function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-5 py-2.5 text-sm font-bold transition-all relative"
      style={{
        color:           active ? '#1B2A4A' : '#9CA3AF',
        backgroundColor: 'transparent',
        borderBottom:    active ? '3px solid #F4A833' : '3px solid transparent',
        fontFamily:      'Cairo, sans-serif',
      }}
    >
      {children}
    </button>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ message, actionLabel, actionTo }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AmGhareebAvatar size={64} className="mb-4" />
      <p className="text-base font-semibold mb-4" style={{ color: '#6B7280' }}>
        {message}
      </p>
      <button
        onClick={() => navigate(actionTo)}
        className="px-6 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
        style={{ backgroundColor: '#F4A833', color: '#1B2A4A' }}
      >
        {actionLabel}
      </button>
    </div>
  )
}

// ── Search History tab ────────────────────────────────────────────────────────
function SearchHistoryTab() {
  const navigate = useNavigate()
  const { user, isLoading: authIsLoading } = useAuth()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['route-history'],
    queryFn:  () => api.get('/api/routes/history').then((r) => r.data.history),
    enabled:  !!user && !authIsLoading,
    retry:    false,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 pt-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl h-16 animate-pulse"
            style={{ backgroundColor: '#E5E7EB' }}
          />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div
        className="rounded-2xl p-8 text-center mt-4"
        style={{ backgroundColor: '#FEE2E2', border: '2px solid #DC2626' }}
      >
        <p className="text-base font-bold mb-1" style={{ color: '#7F1D1D' }}>
          {t.errorTitle}
        </p>
        <p className="text-sm" style={{ color: '#991B1B' }}>
          {t.errorBody}
        </p>
      </div>
    )
  }

  if (!data?.length) {
    return (
      <EmptyState
        message={t.emptyHistory}
        actionLabel={t.emptyActionLabel}
        actionTo="/search"
      />
    )
  }

  return (
    <div className="pt-4 overflow-x-auto">
      <table className="w-full text-sm" style={{ fontFamily: 'Cairo, sans-serif' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
            <th className="text-right pb-3 font-bold" style={{ color: '#1B2A4A' }}>{t.historyFrom}</th>
            <th className="text-right pb-3 font-bold" style={{ color: '#1B2A4A' }}>{t.historyTo}</th>
            <th className="text-right pb-3 font-bold hidden sm:table-cell" style={{ color: '#9CA3AF' }}>{t.historyDate}</th>
            <th className="pb-3" />
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr key={item._id || i} style={{ borderBottom: '1px solid #F3F4F6' }}>
              <td className="py-3 font-medium" style={{ color: '#1B2A4A' }}>
                {item.originQuery}
              </td>
              <td className="py-3 font-medium" style={{ color: '#1B2A4A' }}>
                {item.destinationQuery}
              </td>
              <td className="py-3 hidden sm:table-cell" style={{ color: '#9CA3AF' }}>
                {relativeAr(item.createdAt)}
              </td>
              <td className="py-3 text-left">
                <button
                  onClick={() =>
                    navigate(
                      `/search?origin=${encodeURIComponent(item.originQuery)}&destination=${encodeURIComponent(item.destinationQuery)}`
                    )
                  }
                  className="text-xs font-bold px-3 py-1 rounded-lg transition-opacity hover:opacity-70"
                  style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                >
                  {t.searchAgain}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Saved Items tab ───────────────────────────────────────────────────────────
function SavedItemsTab() {
  const queryClient = useQueryClient()
  const [ratingRouteId, setRatingRouteId] = useState(null)
  const [ratingTravelPlan, setRatingTravelPlan] = useState(null)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)
  const [pendingRouteId, setPendingRouteId] = useState(null)
  const [pendingTravelPlanId, setPendingTravelPlanId] = useState(null)

  const { user, isLoading: authIsLoading } = useAuth()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['saved-items'],
    queryFn:  () => api.get('/api/routes/saved').then((r) => r.data),
    enabled:  !!user && !authIsLoading,
    retry:    false,
  })

  const savedRoutes = data?.routes || []
  const savedTravelPlans = data?.travelPlans || []
  const hasSavedItems = savedRoutes.length > 0 || savedTravelPlans.length > 0

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 pt-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl h-28 animate-pulse"
            style={{ backgroundColor: '#E5E7EB' }}
          />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div
        className="rounded-2xl p-8 text-center mt-4"
        style={{ backgroundColor: '#FEE2E2', border: '2px solid #DC2626' }}
      >
        <p className="text-base font-bold mb-1" style={{ color: '#7F1D1D' }}>
          {t.errorTitle}
        </p>
        <p className="text-sm" style={{ color: '#991B1B' }}>
          {t.errorBody}
        </p>
      </div>
    )
  }

  async function handleUnsaveRoute(routeId) {
    setPendingRouteId(routeId)
    try {
      await api.delete(`/api/routes/save/${routeId}`)
      queryClient.invalidateQueries({ queryKey: ['saved-items'] })
    } finally {
      setPendingRouteId(null)
    }
  }

  async function handleUnsaveTravelPlan(travelPlan) {
    if (!travelPlan?.travelPlanId) return

    setPendingTravelPlanId(travelPlan.travelPlanId)
    try {
      await api.delete('/api/routes/saved-travel-plans', {
        data: { travelPlanId: travelPlan.travelPlanId },
      })
      queryClient.invalidateQueries({ queryKey: ['saved-items'] })
    } finally {
      setPendingTravelPlanId(null)
    }
  }

  async function handleClearSavedRoutes() {
    setClearingAll(true)
    try {
      await api.delete('/api/routes/saved/clear')
      queryClient.invalidateQueries({ queryKey: ['saved-items'] })
      setClearConfirm(false)
    } finally {
      setClearingAll(false)
    }
  }

  if (!hasSavedItems) {
    return (
      <EmptyState
        message={t.emptySaved}
        actionLabel={t.emptyActionLabel}
        actionTo="/search"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-col items-end gap-2">
        {!clearConfirm ? (
          <button
            onClick={() => setClearConfirm(true)}
            className="rounded-xl px-4 py-2 text-sm font-bold transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}
          >
            {t.clearAllBtn}
          </button>
        ) : (
          <div className="rounded-2xl border p-4 text-right" style={{ borderColor: '#FECACA', backgroundColor: '#FFF1F2' }}>
            <p className="text-sm font-semibold mb-3" style={{ color: '#991B1B' }}>
              {t.clearConfirmMsg}
            </p>
            <div className="flex gap-2 flex-wrap justify-end">
              <button
                onClick={handleClearSavedRoutes}
                disabled={clearingAll}
                className="rounded-xl px-4 py-2 text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
              >
                {clearingAll ? t.clearingAll : t.clearConfirmYes}
              </button>
              <button
                onClick={() => setClearConfirm(false)}
                className="rounded-xl px-4 py-2 text-sm font-bold transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#E5E7EB', color: '#374151' }}
              >
                {common.cancel}
              </button>
            </div>
          </div>
        )}
      </div>
      {savedTravelPlans.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="text-right">
            <h3 className="text-base font-bold" style={{ color: '#1B2A4A' }}>
              {t.savedTravelPlansTitle}
            </h3>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              {t.savedTravelPlansHint}
            </p>
          </div>
          {savedTravelPlans.map((travelPlan) => (
            <TravelPlanCard
              key={travelPlan.travelPlanId}
              travelPlan={travelPlan}
              onRateClick={setRatingTravelPlan}
              onUnsaveClick={handleUnsaveTravelPlan}
              isSaved
              isSaving={pendingTravelPlanId === travelPlan.travelPlanId}
            />
          ))}
        </section>
      )}
      {savedRoutes.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="text-right">
            <h3 className="text-base font-bold" style={{ color: '#1B2A4A' }}>
              {t.savedRoutesTitle}
            </h3>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              {t.savedRoutesHint}
            </p>
          </div>
          {savedRoutes.map((route) => (
            <RouteCard
              key={route._id || route.routeId}
              route={route}
              accuracyStats={route.accuracyStats}
              onRateClick={(id) => setRatingRouteId(id)}
              onUnsaveClick={handleUnsaveRoute}
              isSaved
              isSaving={pendingRouteId === route.routeId}
              compact={false}
            />
          ))}
        </section>
      )}
      {ratingRouteId && (
        <RatingModal
          routeId={ratingRouteId}
          onClose={() => setRatingRouteId(null)}
          onSuccess={() => setRatingRouteId(null)}
        />
      )}
      {ratingTravelPlan && (
        <TravelPlanRatingModal
          travelPlan={ratingTravelPlan}
          onClose={() => setRatingTravelPlan(null)}
          onSuccess={() => setRatingTravelPlan(null)}
        />
      )}
    </div>
  )
}

// ── DashboardPage ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div
      className="min-h-screen pb-16"
      style={{ backgroundColor: '#FDF6EC', fontFamily: 'Cairo, sans-serif' }}
      dir="rtl"
    >
      <div className="max-w-3xl mx-auto px-4 pt-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <AmGhareebAvatar size={56} />
          <h1 className="text-2xl font-black" style={{ color: '#1B2A4A' }}>
            {t.greeting(user?.name)}
          </h1>
        </div>

        {/* Tabs */}
        <div
          className="rounded-2xl overflow-hidden shadow-sm"
          style={{ backgroundColor: '#FFFFFF' }}
        >
          <div className="flex border-b" style={{ borderColor: '#E5E7EB' }}>
            <Tab active={activeTab === 0} onClick={() => setActiveTab(0)}>
              {t.tabHistory}
            </Tab>
            <Tab active={activeTab === 1} onClick={() => setActiveTab(1)}>
              {t.tabSaved}
            </Tab>
          </div>

          <div className="p-5">
            {activeTab === 0 ? <SearchHistoryTab /> : <SavedItemsTab />}
          </div>
        </div>
      </div>
    </div>
  )
}