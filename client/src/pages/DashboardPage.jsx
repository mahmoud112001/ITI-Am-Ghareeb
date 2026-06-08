import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import AmGhareebAvatar from '../components/AmGhareebAvatar'
import RouteCard from '../components/RouteCard'
import RatingModal from '../components/RatingModal'
import api from '../lib/axios'

// ── Relative time ─────────────────────────────────────────────────────────────
function relativeAr(dateStr) {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 60)  return `منذ ${mins} دقيقة`
  if (hours < 24)  return `منذ ${hours} ساعة`
  if (days  === 1) return 'أمس'
  return `منذ ${days} أيام`
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
  const { data, isLoading } = useQuery({
    queryKey: ['route-history'],
    queryFn:  () => api.get('/api/routes/history').then((r) => r.data.history),
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

  if (!data?.length) {
    return (
      <EmptyState
        message="لسه معملتش أي بحث — ابدأ دلوقتي!"
        actionLabel="ابحث عن خط"
        actionTo="/search"
      />
    )
  }

  return (
    <div className="pt-4 overflow-x-auto">
      <table className="w-full text-sm" style={{ fontFamily: 'Cairo, sans-serif' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
            <th className="text-right pb-3 font-bold" style={{ color: '#1B2A4A' }}>من</th>
            <th className="text-right pb-3 font-bold" style={{ color: '#1B2A4A' }}>إلى</th>
            <th className="text-right pb-3 font-bold hidden sm:table-cell" style={{ color: '#9CA3AF' }}>التاريخ</th>
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
                  ابحث تاني
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Saved Routes tab ──────────────────────────────────────────────────────────
function SavedRoutesTab() {
  const [ratingRouteId, setRatingRouteId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['saved-routes'],
    queryFn:  () => api.get('/api/routes/saved').then((r) => r.data.routes),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 pt-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl h-28 animate-pulse"
            style={{ backgroundColor: '#E5E7EB' }}
          />
        ))}
      </div>
    )
  }

  if (!data?.length) {
    return (
      <EmptyState
        message="مفيش خطوط محفوظة — ابحث وحفظ الخطوط المهمة ليك!"
        actionLabel="ابحث عن خط"
        actionTo="/search"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      {data.map((route) => (
        <RouteCard
          key={route._id || route.routeId}
          route={route}
          accuracyStats={route.accuracyStats}
          onRateClick={(id) => setRatingRouteId(id)}
          compact
        />
      ))}
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
            أهلاً يا {user?.name}! 👋
          </h1>
        </div>

        {/* Tabs */}
        <div
          className="rounded-2xl overflow-hidden shadow-sm"
          style={{ backgroundColor: '#FFFFFF' }}
        >
          <div className="flex border-b" style={{ borderColor: '#E5E7EB' }}>
            <Tab active={activeTab === 0} onClick={() => setActiveTab(0)}>
              بحثاتي الأخيرة
            </Tab>
            <Tab active={activeTab === 1} onClick={() => setActiveTab(1)}>
              خطوطي المحفوظة
            </Tab>
          </div>

          <div className="p-5">
            {activeTab === 0 ? <SearchHistoryTab /> : <SavedRoutesTab />}
          </div>
        </div>
      </div>
    </div>
  )
}
