import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminRatingMessages } from '../hooks/useAdminRoutes'

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function reviewTarget(review) {
  if (review.type === 'travelPlan') {
    return `رحلة (${review.routeIds?.join('، ') || 'بدون خطوط'})`
  }
  return review.route?.nameAr || review.route?.localName || review.route?.routeId || 'خط مواصلات'
}

function StatPill({ label, value, color = '#1B2A4A' }) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: '#FFFFFF' }}>
      <p className="text-xs font-bold mb-1" style={{ color: '#9CA3AF' }}>{label}</p>
      <p className="text-xl font-black" style={{ color }}>{value}</p>
    </div>
  )
}

export default function AdminReviewsPage() {
  const { data, isLoading, isError } = useAdminRatingMessages(200)
  const [accuracyFilter, setAccuracyFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')

  const reviews = data?.messages || []

  const filteredReviews = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return reviews.filter((review) => {
      if (accuracyFilter === 'accurate' && review.isAccurate !== true) return false
      if (accuracyFilter === 'inaccurate' && review.isAccurate !== false) return false
      if (typeFilter !== 'all' && review.type !== typeFilter) return false
      if (!needle) return true

      const haystack = [
        review.comment,
        review.user?.name,
        review.user?.email,
        review.route?.nameAr,
        review.route?.localName,
        review.route?.routeId,
        review.routeIds?.join(' '),
      ].filter(Boolean).join(' ').toLowerCase()

      return haystack.includes(needle)
    })
  }, [accuracyFilter, reviews, search, typeFilter])

  const accurateCount = reviews.filter((review) => review.isAccurate).length
  const inaccurateCount = reviews.filter((review) => review.isAccurate === false).length

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: '#FDF6EC', fontFamily: 'Cairo, sans-serif' }} dir="rtl">
      <div className="max-w-5xl mx-auto px-4 pt-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#1B2A4A' }}>رسائل التقييمات</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              مساحة منفصلة لمراجعة تعليقات المستخدمين واتخاذ قرارات تعديل الخطوط.
            </p>
          </div>
          <Link
            to="/admin"
            className="rounded-xl px-5 py-2.5 text-sm font-bold hover:opacity-80"
            style={{ backgroundColor: '#FFFFFF', color: '#1B2A4A', border: '1px solid #E5E7EB' }}
          >
            رجوع لإدارة الخطوط
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatPill label="كل الرسائل" value={reviews.length} />
          <StatPill label="تقييمات دقيقة" value={accurateCount} color="#065F46" />
          <StatPill label="تقييمات غير دقيقة" value={inaccurateCount} color="#991B1B" />
          <StatPill label="المعروض الآن" value={filteredReviews.length} color="#92400E" />
        </div>

        <div className="rounded-2xl p-4 mb-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="grid md:grid-cols-3 gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-xl border px-4 py-2.5 text-sm outline-none"
              style={{ borderColor: '#D1D5DB' }}
              placeholder="ابحث بالرسالة أو المستخدم أو الخط"
            />
            <select
              value={accuracyFilter}
              onChange={(event) => setAccuracyFilter(event.target.value)}
              className="rounded-xl border px-4 py-2.5 text-sm outline-none"
              style={{ borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' }}
            >
              <option value="all">كل حالات الدقة</option>
              <option value="accurate">دقيق فقط</option>
              <option value="inaccurate">غير دقيق فقط</option>
            </select>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-xl border px-4 py-2.5 text-sm outline-none"
              style={{ borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' }}
            >
              <option value="all">كل الأنواع</option>
              <option value="route">تقييم خط</option>
              <option value="travelPlan">تقييم رحلة</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
          {isLoading ? (
            <div className="p-6 flex flex-col gap-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: '#E5E7EB' }} />
              ))}
            </div>
          ) : isError ? (
            <div className="p-8 text-center">
              <p className="text-base font-bold" style={{ color: '#991B1B' }}>تعذر تحميل رسائل التقييمات.</p>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold" style={{ color: '#6B7280' }}>لا توجد رسائل مطابقة للفلاتر الحالية.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
              {filteredReviews.map((review) => (
                <article key={`${review.type}-${review._id}`} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-base font-black" style={{ color: '#1B2A4A' }}>
                        {reviewTarget(review)}
                      </p>
                      <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                        {review.user?.name || 'مستخدم'} - {review.user?.email || 'بدون بريد'}
                      </p>
                    </div>
                    <div className="flex items-start gap-2 flex-wrap">
                      <span
                        className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{
                          backgroundColor: review.type === 'travelPlan' ? '#EDE9FE' : '#DBEAFE',
                          color: review.type === 'travelPlan' ? '#5B21B6' : '#1E40AF',
                        }}
                      >
                        {review.type === 'travelPlan' ? 'رحلة' : 'خط'}
                      </span>
                      <span
                        className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{
                          backgroundColor: review.isAccurate ? '#D1FAE5' : '#FEE2E2',
                          color: review.isAccurate ? '#065F46' : '#991B1B',
                        }}
                      >
                        {review.isAccurate ? 'دقيق' : 'غير دقيق'}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm leading-7 mt-4" style={{ color: '#374151' }}>
                    {review.comment}
                  </p>
                  <p className="text-xs mt-3" style={{ color: '#9CA3AF' }}>
                    {formatDate(review.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
