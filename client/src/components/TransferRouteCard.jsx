import { useNavigate } from 'react-router-dom'
import RouteCard from './RouteCard'

function formatFare(fare) {
  if (!fare) return 'غير محددة'
  return `${fare.min}–${fare.max} ${fare.currency || 'EGP'}`
}

export default function TransferRouteCard({ itinerary }) {
  const navigate = useNavigate()
  const [firstLeg, secondLeg] = itinerary.legs || []

  if (!firstLeg || !secondLeg) return null

  function openTransferMap() {
    const params = new URLSearchParams({
      itineraryType: 'transfer',
      firstRouteId: firstLeg.route.routeId,
      firstDirection: firstLeg.route.selectedDirection || 'forward',
      secondRouteId: secondLeg.route.routeId,
      secondDirection: secondLeg.route.selectedDirection || 'forward',
    })

    if (firstLeg.route.matchedSegment?.originStopId) {
      params.set('firstOriginId', firstLeg.route.matchedSegment.originStopId)
    }
    if (firstLeg.route.matchedSegment?.destinationStopId) {
      params.set('firstDestinationId', firstLeg.route.matchedSegment.destinationStopId)
    }
    if (secondLeg.route.matchedSegment?.originStopId) {
      params.set('secondOriginId', secondLeg.route.matchedSegment.originStopId)
    }
    if (secondLeg.route.matchedSegment?.destinationStopId) {
      params.set('secondDestinationId', secondLeg.route.matchedSegment.destinationStopId)
    }
    if (itinerary.transferWalk?.from?._id) {
      params.set('transferFromId', itinerary.transferWalk.from._id)
    }
    if (itinerary.transferWalk?.to?._id) {
      params.set('transferToId', itinerary.transferWalk.to._id)
    }

    navigate(`/map?${params.toString()}`)
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
              رحلة بتحويلة واحدة
            </p>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              {itinerary.transferWalk?.distanceMeters > 0
                ? `انزل في ${itinerary.transferWalk?.from?.nameAr} ثم امشِ إلى ${itinerary.transferWalk?.to?.nameAr}`
                : `انزل في ${itinerary.transferPlace?.nameAr} ثم اركب الخط التالي`}
            </p>
          </div>
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
          >
            تحويلة واحدة
          </span>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}
          >
            إجمالي التعريفة: {formatFare(itinerary.totalFare)}
          </span>
          {itinerary.transferWalk?.distanceMeters > 0 && (
            <span
              className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ backgroundColor: '#F3F4F6', color: '#4B5563' }}
            >
              مشي: {Math.round(itinerary.transferWalk.distanceMeters)} متر
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pb-4">
        <div
          className="rounded-2xl p-3 mb-3"
          style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
        >
          <p className="text-sm font-bold mb-2" style={{ color: '#1B2A4A' }}>
            الركوبة الأولى: {firstLeg.boardAt?.nameAr} ← {firstLeg.alightAt?.nameAr}
          </p>
          <RouteCard
            route={firstLeg.route}
            accuracyStats={firstLeg.accuracyStats}
            compact
          />
        </div>

        <div
          className="rounded-2xl p-3"
          style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
        >
          <p className="text-sm font-bold mb-2" style={{ color: '#1B2A4A' }}>
            الركوبة الثانية: {secondLeg.boardAt?.nameAr} ← {secondLeg.alightAt?.nameAr}
          </p>
          <RouteCard
            route={secondLeg.route}
            accuracyStats={secondLeg.accuracyStats}
            compact
          />
        </div>

        <div className="mt-3">
          <button
            onClick={openTransferMap}
            className="w-full rounded-xl py-2.5 text-sm font-semibold border-2 transition-colors hover:opacity-80"
            style={{ borderColor: '#1B2A4A', color: '#1B2A4A', backgroundColor: 'transparent' }}
          >
            الخريطة
          </button>
        </div>
      </div>
    </div>
  )
}
