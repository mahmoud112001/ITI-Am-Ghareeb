import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/axios'

// ── Type config ───────────────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value: 'microbus',           label: 'مشروع'  },
  { value: 'bus',                label: 'أتوبيس' },
  { value: 'tram',               label: 'ترام'   },
  { value: 'university_shuttle', label: 'شاتل'   },
]
const TYPE_BADGE = {
  microbus:           { bg: '#FEF3C7', color: '#92400E' },
  bus:                { bg: '#DBEAFE', color: '#1E40AF' },
  tram:               { bg: '#D1FAE5', color: '#065F46' },
  university_shuttle: { bg: '#EDE9FE', color: '#5B21B6' },
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label }) {
  return (
    <div
      className="rounded-2xl p-5 flex items-center gap-4 shadow-sm"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-2xl font-black" style={{ color: '#1B2A4A' }}>{value ?? '—'}</p>
        <p className="text-xs font-semibold" style={{ color: '#9CA3AF' }}>{label}</p>
      </div>
    </div>
  )
}

// ── Route form (shared add/edit) ──────────────────────────────────────────────
const EMPTY_FORM = {
  routeId: '', nameAr: '', nameEn: '',
  type: 'microbus',
  fareMin: '', fareMax: '',
  hoursStart: '', hoursEnd: '',
}

function RouteFormModal({ initial, onClose, onSave, title }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [err, setErr]   = useState('')

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })) }

  function handleSave() {
    if (!form.routeId || !form.nameAr || !form.nameEn || !form.fareMin || !form.fareMax) {
      setErr('يرجى ملء جميع الحقول المطلوبة')
      return
    }
    onSave({
      routeId: form.routeId,
      nameAr:  form.nameAr,
      nameEn:  form.nameEn,
      type:    form.type,
      fare:    { min: Number(form.fareMin), max: Number(form.fareMax) },
      operatingHours: { start: form.hoursStart, end: form.hoursEnd },
    })
  }

  const field = (label, key, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-semibold mb-1" style={{ color: '#1B2A4A' }}>
        {label}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all"
        style={{ borderColor: '#D1D5DB', fontFamily: 'Cairo, sans-serif' }}
        onFocus={(e) => (e.target.style.borderColor = '#F4A833')}
        onBlur={(e)  => (e.target.style.borderColor = '#D1D5DB')}
      />
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 overflow-y-auto"
        style={{ backgroundColor: '#FFFFFF', maxHeight: '90vh', fontFamily: 'Cairo, sans-serif' }}
        dir="rtl"
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold" style={{ color: '#1B2A4A' }}>{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {field('معرف الخط *',           'routeId',    'text',   'ALEX-MICRO-01')}
          {field('اسم الخط بالعربي *',     'nameAr',     'text',   'محطة مصر ← سيدي بشر')}
          {field('اسم الخط بالإنجليزي *',  'nameEn',     'text',   'Misr Station → Sidi Bishr')}

          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: '#1B2A4A' }}>النوع</label>
            <select
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: '#D1D5DB', fontFamily: 'Cairo, sans-serif' }}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('أدنى تعريفة *', 'fareMin', 'number', '8')}
            {field('أقصى تعريفة *', 'fareMax', 'number', '12')}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('بداية التشغيل', 'hoursStart', 'text', '6:00')}
            {field('نهاية التشغيل', 'hoursEnd',   'text', '23:00')}
          </div>
        </div>

        {err && <p className="text-sm text-center mt-3" style={{ color: '#DC2626' }}>{err}</p>}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold border-2 transition-colors"
            style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#F4A833', color: '#1B2A4A' }}
          >
            حفظ
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirmation dialog ────────────────────────────────────────────────
function DeleteDialog({ routeName, onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 text-center"
        style={{ backgroundColor: '#FFFFFF', fontFamily: 'Cairo, sans-serif' }}
        dir="rtl"
      >
        <div className="text-4xl mb-3">⚠️</div>
        <h3 className="text-lg font-bold mb-2" style={{ color: '#1B2A4A' }}>
          هل متأكد إنك عايز تحذف الخط ده؟
        </h3>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>{routeName}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold border-2"
            style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold"
            style={{ backgroundColor: '#DC2626', color: 'white' }}
          >
            نعم، احذف
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AdminPage ─────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const queryClient = useQueryClient()
  const [page, setPage]               = useState(1)
  const [addOpen, setAddOpen]         = useState(false)
  const [editRoute, setEditRoute]     = useState(null)
  const [deleteRoute, setDeleteRoute] = useState(null)

  // Stats
  const { data: statsData } = useQuery({
    queryKey: ['admin-stats'],
    queryFn:  () => api.get('/api/admin/stats').then((r) => r.data),
  })

  // Routes list
  const { data: routesData, isLoading } = useQuery({
    queryKey: ['admin-routes', page],
    queryFn:  () =>
      api.get('/api/admin', { params: { page, limit: 10 } }).then((r) => r.data),
    keepPreviousData: true,
  })

  // routes: [{ route, accuracyStats }] pairs — per contract
  const routePairs = routesData?.routes || []
  const totalPages = routesData?.pages  || 1
  // stats nested under .stats key — per contract
  const s = statsData?.stats || {}

  // Add mutation
  const addMutation = useMutation({
    mutationFn: (body) => api.post('/api/admin', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-routes'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      setAddOpen(false)
    },
  })

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: ({ id, body }) => api.put(`/api/admin/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-routes'] })
      setEditRoute(null)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/admin/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-routes'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      setDeleteRoute(null)
    },
  })

  return (
    <div
      className="min-h-screen pb-16"
      style={{ backgroundColor: '#FDF6EC', fontFamily: 'Cairo, sans-serif' }}
      dir="rtl"
    >
      <div className="max-w-5xl mx-auto px-4 pt-8">
        {/* Heading */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h1 className="text-2xl font-black" style={{ color: '#1B2A4A' }}>
            لوحة التحكم
          </h1>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#F4A833', color: '#1B2A4A' }}
          >
            ＋ إضافة خط جديد
          </button>
        </div>

        {/* Stats row */}
        {/* FIX 2: topSearched items have shape { origin, destination, count }
            Display as `${item.origin} ← ${item.destination}` — NO .nameAr field */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon="🚌" value={s.totalRoutes}   label="إجمالي الخطوط"    />
          <StatCard icon="👥" value={s.totalUsers}    label="إجمالي المستخدمين" />
          <StatCard icon="⭐" value={s.totalRatings}  label="إجمالي التقييمات"  />
          <StatCard
            icon="🔍"
            value={
              s.topSearched?.[0]
                ? `${s.topSearched[0].origin} ← ${s.topSearched[0].destination}`
                : '—'
            }
            label="أكثر مسار مطلوب"
          />
        </div>

        {/* Routes table */}
        <div
          className="rounded-2xl overflow-hidden shadow-sm"
          style={{ backgroundColor: '#FFFFFF' }}
        >
          <div className="p-5 border-b" style={{ borderColor: '#E5E7EB' }}>
            <h2 className="text-base font-bold" style={{ color: '#1B2A4A' }}>
              إدارة الخطوط
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div
                className="w-8 h-8 mx-auto rounded-full border-4 animate-spin"
                style={{ borderColor: '#F4A833', borderTopColor: 'transparent' }}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    {['#', 'معرف الخط', 'اسم الخط', 'النوع', 'التعريفة', 'الحالة', 'إجراءات'].map((h) => (
                      <th
                        key={h}
                        className="text-right px-4 py-3 text-xs font-bold"
                        style={{ color: '#6B7280' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {routePairs.map(({ route, accuracyStats: pairStats }, i) => {
                    const badge     = TYPE_BADGE[route.type] || TYPE_BADGE.microbus
                    const typeLabel = TYPE_OPTIONS.find((o) => o.value === route.type)?.label || route.type
                    return (
                      <tr
                        key={route._id}
                        style={{ borderBottom: '1px solid #F3F4F6' }}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-xs" style={{ color: '#9CA3AF' }}>
                          {(page - 1) * 10 + i + 1}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: '#6B7280' }}>
                          {route.routeId}
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color: '#1B2A4A', maxWidth: 180 }}>
                          <p className="truncate">{route.nameAr}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: badge.bg, color: badge.color }}
                          >
                            {typeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>
                          {route.fare?.min}–{route.fare?.max} جنيه
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: route.isActive ? '#D1FAE5' : '#FEE2E2',
                              color:           route.isActive ? '#065F46' : '#991B1B',
                            }}
                          >
                            {route.isActive ? 'نشط' : 'محذوف'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {/* Edit */}
                            <button
                              onClick={() =>
                                setEditRoute({
                                  _id:  route._id,
                                  form: {
                                    routeId:    route.routeId,
                                    nameAr:     route.nameAr,
                                    nameEn:     route.nameEn,
                                    type:       route.type,
                                    fareMin:    route.fare?.min ?? '',
                                    fareMax:    route.fare?.max ?? '',
                                    hoursStart: route.operatingHours?.start ?? '',
                                    hoursEnd:   route.operatingHours?.end   ?? '',
                                  },
                                })
                              }
                              className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                              style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                              title="تعديل"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => setDeleteRoute(route)}
                              className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                              style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}
                              title="حذف"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 p-4" style={{ borderTop: '1px solid #E5E7EB' }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold border transition-colors"
                style={{
                  borderColor: '#E5E7EB',
                  color:       page === 1 ? '#D1D5DB' : '#1B2A4A',
                  cursor:      page === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                السابق
              </button>
              <span className="text-sm" style={{ color: '#6B7280' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold border transition-colors"
                style={{
                  borderColor: '#E5E7EB',
                  color:       page === totalPages ? '#D1D5DB' : '#1B2A4A',
                  cursor:      page === totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                التالي
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add modal */}
      {addOpen && (
        <RouteFormModal
          title="إضافة خط جديد"
          onClose={() => setAddOpen(false)}
          onSave={(body) => addMutation.mutate(body)}
        />
      )}

      {/* Edit modal */}
      {editRoute && (
        <RouteFormModal
          title="تعديل الخط"
          initial={editRoute.form}
          onClose={() => setEditRoute(null)}
          onSave={(body) => editMutation.mutate({ id: editRoute._id, body })}
        />
      )}

      {/* Delete confirmation */}
      {deleteRoute && (
        <DeleteDialog
          routeName={deleteRoute.nameAr}
          onCancel={() => setDeleteRoute(null)}
          onConfirm={() => deleteMutation.mutate(deleteRoute._id)}
        />
      )}
    </div>
  )
}
