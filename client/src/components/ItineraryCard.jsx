import { useNavigate } from 'react-router-dom'
import RouteCard from './RouteCard'
import { buildMapSearchParamsForLegs } from '../utils/itineraryMap'

function ordinalLabel(index) {
  const labels = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة']
  return labels[index] || `${index + 1}`
}

function formatFare(fare) {
  if (!fare) return 'غير محددة'
  return `${fare.min}–${fare.max} ${fare.currency || 'EGP'}`
}

function formatTransferTitle(transferCount) {
  if (transferCount === 1) return 'رحلة بتحويلة واحدة'
  if (transferCount === 2) return 'رحلة بتحويلتين'
  return `رحلة بـ ${transferCount} تحويلات`
}

function getTotalWalkMeters(itinerary) {
  return (itinerary.transferWalks || []).reduce(
    (total, walk) => total + (walk?.distanceMeters || 0),
    0,
  )
}

function getSaveButtonState({ isSaved, isPartiallySaved, isSaving, isJustSaved }) {
  if (isSaving) return 'جارٍ الحفظ...'
  if (isJustSaved) return 'Saved !'
  if (isSaved) return 'الغاء حفظ الرحلة'
  if (isPartiallySaved) return 'احفظ الخطوط الناقصة'
  return 'احفظ الرحلة'
}

export default function ItineraryCard({
  itinerary,
  onRateClick,
  onSaveClick,
  onUnsaveClick,
  isSaved = false,
  isPartiallySaved = false,
  isSaving = false,
  isJustSaved = false,
}) {
  const navigate = useNavigate()
  const legs = itinerary?.legs || []

  if (legs.length < 2) return null

  const totalWalkMeters = getTotalWalkMeters(itinerary)
  const saveButtonLabel = getSaveButtonState({
    isSaved,
    isPartiallySaved,
    isSaving,
    isJustSaved,
  })

  const saveButtonStyle = isSaved
    ? { borderColor: '#DC2626', color: '#B91C1C', backgroundColor: 'transparent' }
    : { borderColor: '#10B981', color: '#047857', backgroundColor: 'transparent' }

  function openMap() {
    const params = buildMapSearchParamsForLegs(legs)
    navigate(`/map?${params.toString()}`)
  }

  function handleSaveClick() {
    if (isSaved) {
      onUnsaveClick?.(itinerary)
      return
    }

    onSaveClick?.(itinerary)
  }

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRight: '4px solid #F4A833',
      }}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p
              className="font-bold text-base leading-tight"
              style={{ color: '#1B2A4A', fontFamily: 'Cairo, sans-serif' }}
            >
              {formatTransferTitle(itinerary.transferCount)}
            </p>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              {legs[0]?.boardAt?.nameAr} ← {legs[legs.length - 1]?.alightAt?.nameAr}
            </p>
          </div>
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
          >
            {itinerary.transferCount === 1 ? 'تحويلة واحدة' : `${itinerary.transferCount} تحويلات`}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}
          >
            إجمالي التعريفة: {formatFare(itinerary.totalFare)}
          </span>
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ backgroundColor: '#F3F4F6', color: '#4B5563' }}
          >
            {legs.length} ركوبات
          </span>
          {totalWalkMeters > 0 && (
            <span
              className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ backgroundColor: '#ECFCCB', color: '#3F6212' }}
            >
              إجمالي المشي: {Math.round(totalWalkMeters)} متر
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 flex flex-col gap-3">
        {legs.map((leg, index) => (
          <div
            key={`${itinerary.itineraryId}-${leg.route.routeId}-${index}`}
            className="rounded-2xl p-3"
            style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
          >
            <p className="text-sm font-bold mb-2" style={{ color: '#1B2A4A' }}>
              الركوبة {ordinalLabel(index)}: {leg.boardAt?.nameAr} ← {leg.alightAt?.nameAr}
            </p>
            <RouteCard route={leg.route} accuracyStats={leg.accuracyStats} compact />

            {index < legs.length - 1 && (
              <div
                className="mt-3 rounded-xl px-3 py-2"
                style={{ backgroundColor: '#FFFBEB', border: '1px dashed #F4A833' }}
              >
                <p className="text-xs font-bold" style={{ color: '#92400E' }}>
                  التحويلة {index + 1}
                </p>
                <p className="text-sm mt-1" style={{ color: '#4B5563' }}>
                  {itinerary.transferWalks?.[index]?.distanceMeters > 0
                    ? `انزل في ${itinerary.transferWalks[index].from?.nameAr} ثم امشِ إلى ${itinerary.transferWalks[index].to?.nameAr}`
                    : `التحويل عند ${itinerary.transferWalks?.[index]?.from?.nameAr || itinerary.transferWalks?.[index]?.to?.nameAr || 'المحطة المشتركة'}`}
                </p>
              </div>
            )}
          </div>
        ))}

        <div
          className="flex gap-2"
          style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12 }}
        >
          <button
            onClick={() => onRateClick?.(itinerary)}
            className="flex-1 rounded-xl py-2 text-sm font-semibold border-2 transition-colors hover:opacity-80"
            style={{ borderColor: '#F4A833', color: '#F4A833', backgroundColor: 'transparent' }}
          >
            قيّم الرحلة
          </button>
          <button
            onClick={handleSaveClick}
            disabled={isSaving}
            className="flex-1 rounded-xl py-2 text-sm font-semibold border-2 transition-colors hover:opacity-80 disabled:opacity-60 disabled:cursor-not-allowed"
            style={saveButtonStyle}
          >
            {saveButtonLabel}
          </button>
          <button
            onClick={openMap}
            className="flex-1 rounded-xl py-2 text-sm font-semibold border-2 transition-colors hover:opacity-80"
            style={{ borderColor: '#1B2A4A', color: '#1B2A4A', backgroundColor: 'transparent' }}
          >
            الخريطة
          </button>
        </div>
      </div>
    </div>
  )
}
