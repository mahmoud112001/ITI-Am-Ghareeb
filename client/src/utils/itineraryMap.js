function normalizeLegDescriptor(leg) {
  if (!leg?.routeId) return null

  return {
    routeId: String(leg.routeId),
    direction: leg.direction === 'reverse' ? 'reverse' : 'forward',
    originStopId: leg.originStopId ? String(leg.originStopId) : null,
    destinationStopId: leg.destinationStopId ? String(leg.destinationStopId) : null,
  }
}

export function buildLegMapDescriptor(leg) {
  if (!leg?.route?.routeId) return null

  return normalizeLegDescriptor({
    routeId: leg.route.routeId,
    direction: leg.route.selectedDirection || 'forward',
    originStopId: leg.route.matchedSegment?.originStopId || leg.boardAt?._id || null,
    destinationStopId:
      leg.route.matchedSegment?.destinationStopId || leg.alightAt?._id || null,
  })
}

export function buildMapSearchParamsForLegs(legs = []) {
  const legDescriptors = (Array.isArray(legs) ? legs : [])
    .map(buildLegMapDescriptor)
    .filter(Boolean)

  const params = new URLSearchParams()
  if (legDescriptors.length) {
    params.set('legs', JSON.stringify(legDescriptors))
  }

  return params
}

export function parseMapLegDescriptors(searchParams) {
  const legsParam = searchParams.get('legs')
  if (legsParam) {
    try {
      const parsed = JSON.parse(legsParam)
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeLegDescriptor).filter(Boolean)
      }
    } catch {
      return []
    }
  }

  const routeId = searchParams.get('routeId')
  if (routeId) {
    return [
      normalizeLegDescriptor({
        routeId,
        direction: searchParams.get('direction') || 'forward',
        originStopId: searchParams.get('matchedOriginId'),
        destinationStopId: searchParams.get('matchedDestinationId'),
      }),
    ].filter(Boolean)
  }

  const firstRouteId = searchParams.get('firstRouteId')
  const secondRouteId = searchParams.get('secondRouteId')
  if (firstRouteId && secondRouteId) {
    return [
      normalizeLegDescriptor({
        routeId: firstRouteId,
        direction: searchParams.get('firstDirection') || 'forward',
        originStopId: searchParams.get('firstOriginId'),
        destinationStopId: searchParams.get('firstDestinationId'),
      }),
      normalizeLegDescriptor({
        routeId: secondRouteId,
        direction: searchParams.get('secondDirection') || 'forward',
        originStopId: searchParams.get('secondOriginId'),
        destinationStopId: searchParams.get('secondDestinationId'),
      }),
    ].filter(Boolean)
  }

  return []
}
