import { useNavigate } from 'react-router-dom'

// ── Type badge config ─────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  microbus:           { label: 'مشروع',  bg: '#FEF3C7', color: '#92400E' },
  bus:                { label: 'أتوبيس', bg: '#DBEAFE', color: '#1E40AF' },
  tram:               { label: 'ترام',   bg: '#D1FAE5', color: '#065F46' },
  university_shuttle: { label: 'شاتل',   bg: '#EDE9FE', color: '#5B21B6' },
}

// ── Accuracy badge config ─────────────────────────────────────────────────────
function AccuracyBadge({ stats }) {
  if (!stats) return null
  const { percentage, label, total } = stats

  let bg, color
  if (percentage === null) {
    bg = '#F3F4F6'; color = '#6B7280'
  } else if (percentage >= 80) {
    bg = '#D1FAE5'; color = '#065F46'
  } else if (percentage >= 60) {
    bg = '#FEF3C7'; color = '#92400E'
  } else {
    bg = '#FEE2E2'; color = '#991B1B'
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className="text-xs font-bold px-3 py-1 rounded-full"
        style={{ backgroundColor: bg, color }}
      >
        {percentage !== null ? `${percentage}% — ` : ''}{label}
        {percentage !== null && percentage >= 80 ? ' ✓' : ''}
      </span>
      {total > 0 && (
        <span className="text-xs" style={{ color: '#9CA3AF' }}>
          من {total} تقييم
        </span>
      )}
    </div>
  )
}

// ── Peak hours check ──────────────────────────────────────────────────────────
function isCurrentlyPeak(peakHours = []) {
  if (!peakHours.length) return false
  const now     = new Date()
  const current = now.getHours() * 60 + now.getMinutes()

  return peakHours.some((range) => {
    // Expected format: "8:00–10:00" (en dash or hyphen)
    const parts = range.split(/[–-]/)
    if (parts.length !== 2) return false
    function toMins(t) {
      const [h, m] = t.trim().split(':').map(Number)
      return h * 60 + (m || 0)
    }
    return current >= toMins(parts[0]) && current <= toMins(parts[1])
  })
}

// ── Stations stepper ──────────────────────────────────────────────────────────
function StationsStepper({ stations }) {
  if (!stations?.length) return null

  return (
    <div className="overflow-x-auto pb-2" style={{ direction: 'ltr' }}>
      <div className="flex items-start gap-0 min-w-max" style={{ direction: 'rtl' }}>
        {stations.map((station, i) => {
          const isFirst = i === 0
          const isLast  = i === stations.length - 1
          const isInter = !isFirst && !isLast

          let dotBg, dotBorder
          if (isFirst)     { dotBg = '#F4A833'; dotBorder = '#F4A833' }
          else if (isLast) { dotBg = '#1B2A4A'; dotBorder = '#1B2A4A' }
          else             { dotBg = 'white';   dotBorder = '#9CA3AF' }

          return (
            <div key={i} className="flex items-start">
              {/* Station node */}
              <div className="flex flex-col items-center" style={{ minWidth: 72 }}>
                <div
                  className="rounded-full border-2 flex items-center justify-center"
                  style={{
                    width:           isFirst || isLast ? 14 : 10,
                    height:          isFirst || isLast ? 14 : 10,
                    backgroundColor: dotBg,
                    borderColor:     dotBorder,
                    flexShrink:      0,
                    marginTop:       isFirst || isLast ? 0 : 2,
                  }}
                />
                <span
                  className="text-center leading-tight mt-1"
                  style={{
                    fontSize:   11,
                    color:      isInter ? '#6B7280' : '#1B2A4A',
                    fontWeight: isFirst || isLast ? 600 : 400,
                    fontFamily: 'Cairo, sans-serif',
                    maxWidth:   68,
                  }}
                >
                  {station.nameAr}
                </span>
              </div>

              {/* Connector line */}
              {i < stations.length - 1 && (
                <div
                  style={{
                    height:          2,
                    width:           24,
                    backgroundColor: '#1B2A4A',
                    marginTop:       isFirst ? 6 : 4,
                    flexShrink:      0,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── RouteCard ─────────────────────────────────────────────────────────────────
export default function RouteCard({
  route,
  accuracyStats,
  onRateClick,
  onSaveClick,
  onUnsaveClick,
  isSaved = false,
  isSaving = false,
  isJustSaved = false,
  compact = false,
}) {
  const navigate = useNavigate()
  const typeConf = TYPE_CONFIG[route.type] || TYPE_CONFIG.microbus
  const isPeak   = isCurrentlyPeak(route.peakHours)

  const saveButtonLabel = isSaving
    ? 'جارٍ الحفظ...'
    : isJustSaved
      ? 'Saved !'
      : isSaved
        ? 'الغاء حفظ الخط'
        : 'احفظ الخط'

  const saveButtonStyle = isSaved
    ? { borderColor: '#DC2626', color: '#B91C1C', backgroundColor: 'transparent' }
    : { borderColor: '#10B981', color: '#047857', backgroundColor: 'transparent' }

  function handleSaveClick() {
    if (isSaved) {
      onUnsaveClick?.(route.routeId)
    } else {
      onSaveClick?.(route.routeId)
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      style={{
        backgroundColor: '#FFFFFF',
        border:      '1px solid #E5E7EB',
        borderRight: '4px solid #1B2A4A',
      }}
    >
      {/* ── TOP ROW ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2 gap-3">
        <div className="min-w-0">
          <p
            className="font-bold text-base leading-tight"
            style={{ color: '#1B2A4A', fontFamily: 'Cairo, sans-serif' }}
          >
            {route.nameAr}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
            {route.nameEn}
          </p>
        </div>
        <span
          className="text-xs font-bold px-3 py-1 rounded-full flex-shrink-0"
          style={{ backgroundColor: typeConf.bg, color: typeConf.color }}
        >
          {typeConf.label}
        </span>
      </div>

      {/* ── STATIONS STEPPER ─────────────────────────────────────────────── */}
      <div className="px-4 pb-3">
        <StationsStepper stations={route.stations} />
      </div>

      {/* ── FARE + PEAK ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
        <span
          className="text-xs font-bold px-3 py-1 rounded-full"
          style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
        >
          التعريفة: {route.fare?.min}–{route.fare?.max} جنيه
        </span>
        {isPeak && (
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}
          >
            ⚠️ وقت الزحمة دلوقتي
          </span>
        )}
      </div>

      {/* ── ACCURACY ─────────────────────────────────────────────────────── */}
      <div className="px-4 pb-3">
        <AccuracyBadge stats={accuracyStats} />
      </div>

      {/* ── FOOTER BUTTONS ───────────────────────────────────────────────── */}
      {!compact && (
        <div
          className="flex gap-2 px-4 pb-4"
          style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12 }}
        >
          <button
            onClick={() => onRateClick && onRateClick(route.routeId)}
            className="flex-1 rounded-xl py-2 text-sm font-semibold border-2 transition-colors hover:opacity-80"
            style={{ borderColor: '#F4A833', color: '#F4A833', backgroundColor: 'transparent' }}
          >
            قيّم الخط
          </button>
          {(onSaveClick || onUnsaveClick) && (
            <button
              onClick={handleSaveClick}
              disabled={isSaving}
              className="flex-1 rounded-xl py-2 text-sm font-semibold border-2 transition-colors hover:opacity-80 disabled:opacity-60 disabled:cursor-not-allowed"
              style={saveButtonStyle}
            >
              {saveButtonLabel}
            </button>
          )}
          <button
            onClick={() => navigate(`/map?routeId=${route.routeId}`)}
            className="flex-1 rounded-xl py-2 text-sm font-semibold border-2 transition-colors hover:opacity-80"
            style={{ borderColor: '#1B2A4A', color: '#1B2A4A', backgroundColor: 'transparent' }}
          >
            الخريطة
          </button>
        </div>
      )}
    </div>
  )
}
