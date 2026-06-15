function normalizeTravelSegmentDescriptor(travelSegment) {
  if (!travelSegment?.routeId) return null

  return {
    routeId: String(travelSegment.routeId),
    direction: travelSegment.direction === 'reverse' ? 'reverse' : 'forward',
    originStopId: travelSegment.originStopId ? String(travelSegment.originStopId) : null,
    destinationStopId: travelSegment.destinationStopId ? String(travelSegment.destinationStopId) : null,
  }
}

export function buildTravelSegmentMapDescriptor(travelSegment) {
  if (!travelSegment?.route?.routeId) return null

  return normalizeTravelSegmentDescriptor({
    routeId: travelSegment.route.routeId,
    direction: travelSegment.route.selectedDirection || 'forward',
    originStopId: travelSegment.route.matchedSegment?.originStopId || travelSegment.boardAt?._id || null,
    destinationStopId:
      travelSegment.route.matchedSegment?.destinationStopId || travelSegment.alightAt?._id || null,
  })
}

export function buildMapSearchParamsForTravelSegments(travelSegments = []) {
  const normalizedTravelSegments = (Array.isArray(travelSegments) ? travelSegments : [])
    .map(buildTravelSegmentMapDescriptor)
    .filter(Boolean)

  const params = new URLSearchParams()
  if (normalizedTravelSegments.length) {
    params.set('travelSegments', JSON.stringify(normalizedTravelSegments))
  }

  return params
}

export function parseTravelPlanSegmentDescriptors(searchParams) {
  const travelSegmentsParam = searchParams.get('travelSegments')
  if (!travelSegmentsParam) {
    return []
  }

  try {
    const parsed = JSON.parse(travelSegmentsParam)
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeTravelSegmentDescriptor).filter(Boolean)
    }
  } catch {
    return []
  }

  return []
}

