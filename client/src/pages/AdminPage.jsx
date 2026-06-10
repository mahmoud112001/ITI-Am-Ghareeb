// src/pages/AdminPage.jsx
import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import {
  useAdminStats,
  useAdminRoutes,
  useCreateRoute,
  useUpdateRoute,
  useDeleteRoute,
} from '../hooks/useAdminRoutes'

// ── Fix Leaflet default marker icon (Vite asset pipeline breaks it) ───────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Transport type config ─────────────────────────────────────────────────────
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

// Alexandria centre — default map view
const ALEX_CENTER = [31.2001, 29.9187]

// ── Empty station factory ─────────────────────────────────────────────────────
const EMPTY_STATION = () => ({ nameAr: '', nameEn: '', lat: '', lng: '' })

// ── Empty form ────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  routeId: '', nameAr: '', nameEn: '',
  type: 'microbus',
  fareMin: '', fareMax: '',
  hoursStart: '', hoursEnd: '',
  // first station = origin, last station = destination
  stations: [EMPTY_STATION(), EMPTY_STATION()],
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label }) {
  return (
    <div className="rounded-2xl p-5 flex items-center gap-4 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-2xl font-black" style={{ color: '#1B2A4A' }}>{value ?? '—'}</p>
        <p className="text-xs font-semibold" style={{ color: '#9CA3AF' }}>{label}</p>
      </div>
    </div>
  )
}

// ── Reusable text input ───────────────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text', placeholder = '', readOnly = false }) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1" style={{ color: '#1B2A4A' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
        style={{
          borderColor: '#D1D5DB',
          fontFamily: 'Cairo, sans-serif',
          backgroundColor: readOnly ? '#F9FAFB' : 'white',
        }}
        onFocus={(e) => !readOnly && (e.target.style.borderColor = '#F4A833')}
        onBlur={(e)  => (e.target.style.borderColor = '#D1D5DB')}
      />
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="text-xs font-black uppercase tracking-widest pt-2 pb-1" style={{ color: '#9CA3AF' }}>
      {children}
    </p>
  )
}

// ── Map click handler (inside MapContainer) ───────────────────────────────────
function MapClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

// ── Map picker modal ──────────────────────────────────────────────────────────
function MapUpdater({ lat, lng }) {
  const map = useMapEvents({})

  useEffect(() => {
    map.setView([lat, lng], map.getZoom())
  }, [lat, lng, map])

  return null
}

function MapPickerModal({
  initialLat,
  initialLng,
  stationLabel,
  onConfirm,
  onClose,
}) {
  const startLat =
    initialLat && initialLat !== ''
      ? Number(initialLat)
      : ALEX_CENTER[0]

  const startLng =
    initialLng && initialLng !== ''
      ? Number(initialLng)
      : ALEX_CENTER[1]

  const [picked, setPicked] = useState({
    lat: startLat,
    lng: startLng,
  })

  function getCurrentLocation() {
    if (!navigator.geolocation) {
      alert('المتصفح لا يدعم تحديد الموقع')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPicked({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      () => {
        alert('تعذر الحصول على الموقع الحالي')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    )
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-xl"
        style={{
          backgroundColor: '#FFFFFF',
          fontFamily: 'Cairo, sans-serif',
        }}
        dir="rtl"
      >
        {/* Header */}
        <div
          className="flex justify-between items-center px-5 py-4"
          style={{ borderBottom: '1px solid #E5E7EB' }}
        >
          <div>
            <h3
              className="text-base font-bold"
              style={{ color: '#1B2A4A' }}
            >
              اختر الموقع من الخريطة
            </h3>

            <p
              className="text-xs mt-0.5"
              style={{ color: '#9CA3AF' }}
            >
              {stationLabel}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Current Location Button */}
        <div
          className="px-5 py-3 flex justify-center"
          style={{
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB',
          }}
        >
          <button
            onClick={getCurrentLocation}
            className="rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-80"
            style={{
              backgroundColor: '#DBEAFE',
              color: '#1E40AF',
            }}
          >
            📍 استخدام موقعي الحالي
          </button>
        </div>

        {/* Map */}
        <div style={{ height: 340 }}>
          <MapContainer
            center={[picked.lat, picked.lng]}
            zoom={13}
            style={{
              height: '100%',
              width: '100%',
            }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            <MapUpdater
              lat={picked.lat}
              lng={picked.lng}
            />

            <MapClickHandler
              onPick={(lat, lng) =>
                setPicked({ lat, lng })
              }
            />

            <Marker
              position={[picked.lat, picked.lng]}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const pos = e.target.getLatLng()

                  setPicked({
                    lat: pos.lat,
                    lng: pos.lng,
                  })
                },
              }}
            />
          </MapContainer>
        </div>

        {/* Coordinates */}
        <div
          className="px-5 py-3 flex items-center gap-3"
          style={{
            backgroundColor: '#F9FAFB',
            borderTop: '1px solid #E5E7EB',
          }}
        >
          <span
            className="text-xs font-semibold"
            style={{ color: '#6B7280' }}
          >
            📍 {picked.lat.toFixed(6)},
            {' '}
            {picked.lng.toFixed(6)}
          </span>

          <span
            className="text-xs"
            style={{ color: '#9CA3AF' }}
          >
            انقر أو اسحب العلامة لتحديد الموقع
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold border-2"
            style={{
              borderColor: '#E5E7EB',
              color: '#6B7280',
            }}
          >
            إلغاء
          </button>

          <button
            onClick={() =>
              onConfirm(
                picked.lat.toFixed(6),
                picked.lng.toFixed(6)
              )
            }
            className="flex-1 rounded-xl py-2.5 text-sm font-bold hover:opacity-80"
            style={{
              backgroundColor: '#F4A833',
              color: '#1B2A4A',
            }}
          >
            تأكيد الموقع
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Route form modal (add & edit) ─────────────────────────────────────────────
function RouteFormModal({ initial, onClose, onSave, title, isPending }) {
  const [form, setForm]           = useState(initial || EMPTY_FORM)
  const [err,  setErr]            = useState('')
  const [mapPicker, setMapPicker] = useState(null) // { stationIndex, label }

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })) }

  // ── Station helpers ─────────────────────────────────────────────────────────
  function setStation(index, key, val) {
    setForm((f) => {
      const stations = f.stations.map((s, i) => i === index ? { ...s, [key]: val } : s)
      return { ...f, stations }
    })
  }

  function addStation() {
    setForm((f) => ({
      ...f,
      stations: [...f.stations, EMPTY_STATION()],
    }))
  }

  function removeStation(index) {
    setForm((f) => {
      if (f.stations.length <= 2) return f
      const stations = f.stations.filter((_, i) => i !== index)
      return { ...f, stations }
    })
  }

  function openMapPicker(index, label) {
    setMapPicker({ index, label })
  }

  function handleMapConfirm(lat, lng) {
    setStation(mapPicker.index, 'lat', lat)
    setStation(mapPicker.index, 'lng', lng)
    setMapPicker(null)
  }

  // ── Validation & submit ─────────────────────────────────────────────────────
  function handleSave() {
    if (!form.routeId || !form.nameAr || !form.nameEn) {
      setErr('يرجى ملء معرف الخط والاسمين')
      return
    }
    if (!form.fareMin || !form.fareMax) {
      setErr('يرجى إدخال التعريفة')
      return
    }
    if (form.stations.some((s) => !s.nameAr || !s.nameEn)) {
      setErr('يرجى ملء أسماء جميع المحطات')
      return
    }

    setErr('')

    const stations = form.stations.map((s, i) => ({
      order:  i + 1,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      coords: {
        lat: s.lat !== '' ? Number(s.lat) : 0,
        lng: s.lng !== '' ? Number(s.lng) : 0,
      },
    }))

    // Derive origin & destination from first / last station
    const origin = {
      nameAr: stations[0].nameAr,
      nameEn: stations[0].nameEn,
      coords: stations[0].coords,
    }
    const destination = {
      nameAr: stations[stations.length - 1].nameAr,
      nameEn: stations[stations.length - 1].nameEn,
      coords: stations[stations.length - 1].coords,
    }

    onSave({
      routeId:        form.routeId,
      nameAr:         form.nameAr,
      nameEn:         form.nameEn,
      type:           form.type,
      fare:           { min: Number(form.fareMin), max: Number(form.fareMax) },
      operatingHours: { start: form.hoursStart, end: form.hoursEnd },
      origin,
      destination,
      stations,
    })
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="w-full max-w-lg rounded-2xl p-6 overflow-y-auto"
          style={{ backgroundColor: '#FFFFFF', maxHeight: '90vh', fontFamily: 'Cairo, sans-serif' }}
          dir="rtl"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-bold" style={{ color: '#1B2A4A' }}>{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-3">

            {/* ── Basic info ── */}
            <SectionLabel>معلومات الخط</SectionLabel>
            <Field label="معرف الخط *"          value={form.routeId} onChange={(v) => set('routeId', v)} placeholder="ALEX-MICRO-01" />
            <Field label="اسم الخط بالعربي *"    value={form.nameAr}  onChange={(v) => set('nameAr',  v)} placeholder="محطة مصر ← سيدي بشر" />
            <Field label="اسم الخط بالإنجليزي *" value={form.nameEn}  onChange={(v) => set('nameEn',  v)} placeholder="Misr Station → Sidi Bishr" />

            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: '#1B2A4A' }}>النوع</label>
              <select
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: '#D1D5DB', fontFamily: 'Cairo, sans-serif' }}
              >
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* ── Fare & hours ── */}
            <SectionLabel>التعريفة والمواعيد</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Field label="أدنى تعريفة *" value={form.fareMin}    onChange={(v) => set('fareMin',    v)} type="number" placeholder="8" />
              <Field label="أقصى تعريفة *" value={form.fareMax}    onChange={(v) => set('fareMax',    v)} type="number" placeholder="12" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="بداية التشغيل" value={form.hoursStart} onChange={(v) => set('hoursStart', v)} placeholder="6:00" />
              <Field label="نهاية التشغيل" value={form.hoursEnd}   onChange={(v) => set('hoursEnd',   v)} placeholder="23:00" />
            </div>

            {/* ── Stations ── */}
            <SectionLabel>المحطات — الأولى هي الانطلاق، الأخيرة هي الوصول</SectionLabel>

            {form.stations.map((station, i) => {
              const isFirst     = i === 0
              const isLast      = i === form.stations.length - 1
              const stationLabel = isFirst ? '🟢 نقطة الانطلاق' : isLast ? '🔴 نقطة الوصول' : `محطة ${i + 1}`
              const borderColor  = isFirst ? '#D1FAE5' : isLast ? '#FEE2E2' : '#E5E7EB'
              const hasCoords    = station.lat !== '' && station.lng !== ''

              return (
                <div
                  key={i}
                  className="rounded-xl p-3 flex flex-col gap-2"
                  style={{ backgroundColor: '#F9FAFB', border: `2px solid ${borderColor}` }}
                >
                  {/* Station header */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold" style={{ color: '#374151' }}>{stationLabel}</span>
                    {!isFirst && !isLast && form.stations.length > 2 && (
                      <button onClick={() => removeStation(i)} className="text-xs font-semibold" style={{ color: '#DC2626' }}>
                        حذف
                      </button>
                    )}
                  </div>

                  {/* Name fields */}
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="بالعربي *"    value={station.nameAr} onChange={(v) => setStation(i, 'nameAr', v)} placeholder="محطة مصر" />
                    <Field label="بالإنجليزي *" value={station.nameEn} onChange={(v) => setStation(i, 'nameEn', v)} placeholder="Misr Station" />
                  </div>

                  {/* Coords row */}
                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      label="خط العرض (Lat)"
                      value={station.lat}
                      onChange={(v) => setStation(i, 'lat', v)}
                      type="number"
                      placeholder="31.2001"
                    />
                    <Field
                      label="خط الطول (Lng)"
                      value={station.lng}
                      onChange={(v) => setStation(i, 'lng', v)}
                      type="number"
                      placeholder="29.9187"
                    />
                  </div>

                  {/* Map picker button */}
                  <button
                    onClick={() => openMapPicker(i, stationLabel)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold w-full justify-center transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: hasCoords ? '#D1FAE5' : '#FEF3C7',
                      color:           hasCoords ? '#065F46' : '#92400E',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {hasCoords ? `📍 ${Number(station.lat).toFixed(4)}, ${Number(station.lng).toFixed(4)}` : 'اختر من الخريطة'}
                  </button>
                </div>
              )
            })}

            <button
              onClick={addStation}
              className="w-full rounded-xl py-2 text-sm font-semibold border-2 border-dashed hover:opacity-70"
              style={{ borderColor: '#F4A833', color: '#F4A833' }}
            >
              + إضافة محطة
            </button>

          </div>

          {err && <p className="text-sm text-center mt-3" style={{ color: '#DC2626' }}>{err}</p>}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={isPending}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold border-2"
              style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
            >
              إلغاء
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: '#F4A833', color: '#1B2A4A' }}
            >
              {isPending ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </div>
      </div>

      {/* Map picker renders on top of the form modal */}
      {mapPicker && (
        <MapPickerModal
          initialLat={form.stations[mapPicker.index]?.lat}
          initialLng={form.stations[mapPicker.index]?.lng}
          stationLabel={mapPicker.label}
          onConfirm={handleMapConfirm}
          onClose={() => setMapPicker(null)}
        />
      )}
    </>
  )
}

// ── Delete confirmation dialog ────────────────────────────────────────────────
function DeleteDialog({ routeName, onConfirm, onCancel, isPending }) {
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
        <h3 className="text-lg font-bold mb-2" style={{ color: '#1B2A4A' }}>هل متأكد إنك عايز تحذف الخط ده؟</h3>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>{routeName}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isPending} className="flex-1 rounded-xl py-2.5 text-sm font-semibold border-2" style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>إلغاء</button>
          <button onClick={onConfirm} disabled={isPending} className="flex-1 rounded-xl py-2.5 text-sm font-bold disabled:opacity-50" style={{ backgroundColor: '#DC2626', color: 'white' }}>
            {isPending ? 'جاري الحذف...' : 'نعم، احذف'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Build edit form from a route document ─────────────────────────────────────
function buildEditForm(route) {
  return {
    routeId:    route.routeId,
    nameAr:     route.nameAr,
    nameEn:     route.nameEn,
    type:       route.type,
    fareMin:    route.fare?.min    ?? '',
    fareMax:    route.fare?.max    ?? '',
    hoursStart: route.operatingHours?.start ?? '',
    hoursEnd:   route.operatingHours?.end   ?? '',
    stations:   route.stations?.length >= 2
      ? route.stations.map((s) => ({
          nameAr: s.nameAr,
          nameEn: s.nameEn,
          lat:    s.coords?.lat != null && s.coords.lat !== 0 ? String(s.coords.lat) : '',
          lng:    s.coords?.lng != null && s.coords.lng !== 0 ? String(s.coords.lng) : '',
        }))
      : [EMPTY_STATION(), EMPTY_STATION()],
  }
}

// ── AdminPage ─────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [page,        setPage]        = useState(1)
  const [addOpen,     setAddOpen]     = useState(false)
  const [editRoute,   setEditRoute]   = useState(null)
  const [deleteRoute, setDeleteRoute] = useState(null)

  const { data: statsData }             = useAdminStats()
  const { data: routesData, isLoading } = useAdminRoutes(page)

  const routePairs = routesData?.routes || []
  const totalPages = routesData?.pages  || 1
  const s          = statsData?.stats   || {}

  const createMutation  = useCreateRoute()
  const updateMutation  = useUpdateRoute()
  const deleteMutation  = useDeleteRoute()
  const restoreMutation = useUpdateRoute()

  function handleCreate(body) {
    createMutation.mutate(body, { onSuccess: () => setAddOpen(false) })
  }

  function handleUpdate(body) {
    updateMutation.mutate({ id: editRoute._id, body }, { onSuccess: () => setEditRoute(null) })
  }

  function handleDelete() {
    deleteMutation.mutate(deleteRoute._id, { onSuccess: () => setDeleteRoute(null) })
  }

  function handleRestore(routeId) {
    restoreMutation.mutate({ id: routeId, body: { isActive: true } })
  }

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: '#FDF6EC', fontFamily: 'Cairo, sans-serif' }} dir="rtl">
      <div className="max-w-5xl mx-auto px-4 pt-8">

        {/* Heading */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h1 className="text-2xl font-black" style={{ color: '#1B2A4A' }}>لوحة التحكم</h1>
          <button
            onClick={() => setAddOpen(true)}
            className="rounded-xl px-5 py-2.5 text-sm font-bold hover:opacity-80"
            style={{ backgroundColor: '#F4A833', color: '#1B2A4A' }}
          >
            ＋ إضافة خط جديد
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon="🚌" value={s.totalRoutes}  label="إجمالي الخطوط"     />
          <StatCard icon="👥" value={s.totalUsers}   label="إجمالي المستخدمين" />
          <StatCard icon="⭐" value={s.totalRatings} label="إجمالي التقييمات"  />
          <StatCard
            icon="🔍"
            value={s.topSearched?.[0] ? `${s.topSearched[0].origin} ← ${s.topSearched[0].destination}` : '—'}
            label="أكثر مسار مطلوب"
          />
        </div>

        {/* Routes table */}
        <div className="rounded-2xl overflow-hidden shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="p-5 border-b" style={{ borderColor: '#E5E7EB' }}>
            <h2 className="text-base font-bold" style={{ color: '#1B2A4A' }}>إدارة الخطوط</h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 mx-auto rounded-full border-4 animate-spin" style={{ borderColor: '#F4A833', borderTopColor: 'transparent' }} />
            </div>
          ) : routePairs.length === 0 ? (
            <p className="p-8 text-center text-sm" style={{ color: '#9CA3AF' }}>لا توجد خطوط حتى الآن</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    {['#', 'معرف الخط', 'اسم الخط', 'النوع', 'التعريفة', 'الحالة', 'إجراءات'].map((h) => (
                      <th key={h} className="text-right px-4 py-3 text-xs font-bold" style={{ color: '#6B7280' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {routePairs.map(({ route }, i) => {
                    const badge     = TYPE_BADGE[route.type] || TYPE_BADGE.microbus
                    const typeLabel = TYPE_OPTIONS.find((o) => o.value === route.type)?.label || route.type
                    return (
                      <tr key={route._id} style={{ borderBottom: '1px solid #F3F4F6' }} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs" style={{ color: '#9CA3AF' }}>{(page - 1) * 10 + i + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: '#6B7280' }}>{route.routeId}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: '#1B2A4A', maxWidth: 180 }}>
                          <p className="truncate">{route.nameAr}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: badge.bg, color: badge.color }}>
                            {typeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>{route.fare?.min}–{route.fare?.max} جنيه</td>
                        <td className="px-4 py-3">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: route.isActive ? '#D1FAE5' : '#FEE2E2', color: route.isActive ? '#065F46' : '#991B1B' }}
                          >
                            {route.isActive ? 'نشط' : 'محذوف'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {/* Edit — always available */}
                            <button
                              onClick={() => setEditRoute({ _id: route._id, form: buildEditForm(route) })}
                              className="p-1.5 rounded-lg hover:opacity-70"
                              style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                              title="تعديل"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>

                            {/* Delete OR Restore depending on isActive */}
                            {route.isActive ? (
                              <button
                                onClick={() => setDeleteRoute(route)}
                                className="p-1.5 rounded-lg hover:opacity-70"
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
                            ) : (
                              <button
                                onClick={() => handleRestore(route._id)}
                                disabled={restoreMutation.isPending}
                                className="p-1.5 rounded-lg hover:opacity-70 disabled:opacity-40"
                                style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}
                                title="استعادة"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>
                              </button>
                            )}
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
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-1.5 rounded-lg text-sm font-semibold border disabled:cursor-not-allowed" style={{ borderColor: '#E5E7EB', color: page === 1 ? '#D1D5DB' : '#1B2A4A' }}>السابق</button>
              <span className="text-sm" style={{ color: '#6B7280' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-1.5 rounded-lg text-sm font-semibold border disabled:cursor-not-allowed" style={{ borderColor: '#E5E7EB', color: page === totalPages ? '#D1D5DB' : '#1B2A4A' }}>التالي</button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {addOpen && (
        <RouteFormModal title="إضافة خط جديد" onClose={() => setAddOpen(false)} onSave={handleCreate} isPending={createMutation.isPending} />
      )}
      {editRoute && (
        <RouteFormModal title="تعديل الخط" initial={editRoute.form} onClose={() => setEditRoute(null)} onSave={handleUpdate} isPending={updateMutation.isPending} />
      )}
      {deleteRoute && (
        <DeleteDialog routeName={deleteRoute.nameAr} onCancel={() => setDeleteRoute(null)} onConfirm={handleDelete} isPending={deleteMutation.isPending} />
      )}
    </div>
  )
}