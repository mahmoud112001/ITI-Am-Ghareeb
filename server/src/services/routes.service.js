const {
  SavedItinerary,
  Location,
  Route,
  SearchHistory,
  User,
} = require("../models/index.js");
const {
  geometryToPointSummaries,
  hasMeaningfulCoords,
  normalizeSearchText,
  populateRouteGraph,
  summarizeLocation,
  toPublicRoute,
} = require("../utils/routeNetwork.js");

const WALKING_TRANSFER_METERS = 500;
const LOCATION_RESULT_LIMIT = 8;
const MAX_TRANSFER_SEARCH_DEPTH = 5;
const MAX_ONE_TRANSFER_FALLBACK_RESULTS = 1;
const MAX_DEEP_FALLBACK_RESULTS = 1;
const MAX_INITIAL_BOARD_OPTIONS = 120;
const MAX_INTERMEDIATE_STATES = 2000;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(pointA, pointB) {
  const R = 6371000;
  const dLat = toRadians(pointB.lat - pointA.lat);
  const dLng = toRadians(pointB.lng - pointA.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(pointA.lat)) *
      Math.cos(toRadians(pointB.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getRouteStops(route, selectedDirection = "forward") {
  const stops = Array.isArray(route?.stops) ? [...route.stops] : [];
  return selectedDirection === "reverse" ? stops.reverse() : stops;
}

function getRouteDirections(route) {
  return route?.isBidirectional ? ["forward", "reverse"] : ["forward"];
}

function getStopId(stop) {
  return String(stop?.location?._id || stop?.location || stop?._id || stop || "");
}

function canPickup(stop) {
  return stop?.allowPickup !== false;
}

function canDropoff(stop) {
  return stop?.allowDropoff !== false;
}

function getNearestMapPointDistance(route, userLocation) {
  const mapPoints =
    route.geometryPoints ||
    geometryToPointSummaries(route.geometry) ||
    [];
  let minDistance = Number.POSITIVE_INFINITY;

  for (const point of mapPoints) {
    if (!hasMeaningfulCoords(point.coords)) continue;
    const dist = distanceMeters(userLocation, point.coords);
    if (dist < minDistance) minDistance = dist;
  }

  return Number.isFinite(minDistance) ? minDistance : null;
}

async function findMatchingLocations(query) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];

  const regex = new RegExp(escapeRegex(query.trim()), "i");
  const filter = {
    $or: [
      { nameAr: regex },
      { nameEn: regex },
      { "aliases.ar": regex },
      { "aliases.en": regex },
    ],
  };

  return Location.find(filter)
    .sort({ nameAr: 1 })
    .limit(LOCATION_RESULT_LIMIT)
    .lean();
}

function getTransferDistance(firstStop, secondStop) {
  if (getStopId(firstStop) === getStopId(secondStop)) {
    return 0;
  }

  const firstCoords = summarizeLocation(firstStop)?.coords;
  const secondCoords = summarizeLocation(secondStop)?.coords;
  if (!hasMeaningfulCoords(firstCoords) || !hasMeaningfulCoords(secondCoords)) {
    return null;
  }

  return distanceMeters(firstCoords, secondCoords);
}

async function loadAllActiveRoutes() {
  return populateRouteGraph(
    Route.find({ isActive: true }).sort({ verified: -1, createdAt: -1 }),
  );
}

function buildRouteVariants(routes) {
  return routes.flatMap((route) =>
    getRouteDirections(route).map((selectedDirection) => ({
      route,
      routeId: route.routeId,
      routeDbId: String(route._id),
      selectedDirection,
      variantKey: `${route.routeId}:${selectedDirection}`,
      stops: getRouteStops(route, selectedDirection),
    })),
  );
}

function buildBoardableStopIndex(variants) {
  const byLocationId = new Map();
  const all = [];

  for (const variant of variants) {
    const seenLocationIds = new Set();

    variant.stops.forEach((stop, stopIndex) => {
      if (!canPickup(stop)) return;

      const locationId = getStopId(stop);
      if (!locationId || seenLocationIds.has(locationId)) return;

      const locationSummary = summarizeLocation(stop);
      if (!locationSummary) return;

      seenLocationIds.add(locationId);

      const option = {
        variant,
        stopIndex,
        stop,
        locationId,
        locationSummary,
      };

      if (!byLocationId.has(locationId)) {
        byLocationId.set(locationId, []);
      }

      byLocationId.get(locationId).push(option);
      all.push(option);
    });
  }

  return { byLocationId, all };
}

function getDestinationAlightOptions(variant, boardIndex, destinationIdSet = null) {
  const bestByLocation = new Map();

  for (let stopIndex = boardIndex + 1; stopIndex < variant.stops.length; stopIndex += 1) {
    const stop = variant.stops[stopIndex];
    if (!canDropoff(stop)) continue;

    const locationId = getStopId(stop);
    if (!locationId) continue;
    if (destinationIdSet && !destinationIdSet.has(locationId)) continue;

    const existing = bestByLocation.get(locationId);
    if (existing) continue;

    const locationSummary = summarizeLocation(stop);
    if (!locationSummary) continue;

    bestByLocation.set(locationId, {
      stop,
      stopIndex,
      locationId,
      locationSummary,
      score: stopIndex - boardIndex,
    });
  }

  return Array.from(bestByLocation.values());
}

function getOriginBoardOptionsFromLocations(boardIndex, originLocationIdSet) {
  const options = [];

  for (const locationId of originLocationIdSet) {
    const matches = boardIndex.byLocationId.get(locationId);
    if (matches?.length) {
      options.push(
        ...matches.map((option) => ({
          option,
          walkDistanceMeters: 0,
        })),
      );
    }
  }

  return options;
}

function getOriginBoardOptionsFromCoords(boardIndex, originCoords) {
  return boardIndex.all
    .filter((boardOption) => hasMeaningfulCoords(boardOption.locationSummary?.coords))
    .map((option) => ({
      option,
      walkDistanceMeters: distanceMeters(originCoords, option.locationSummary.coords),
    }))
    .sort((a, b) => a.walkDistanceMeters - b.walkDistanceMeters)
    .slice(0, MAX_INITIAL_BOARD_OPTIONS);
}

function getTransferBoardOptions(boardIndex, currentLocation) {
  if (!currentLocation) return [];

  const currentLocationId = currentLocation._id ? String(currentLocation._id) : null;
  const options = [];

  if (currentLocationId && boardIndex.byLocationId.has(currentLocationId)) {
    options.push(
      ...boardIndex.byLocationId.get(currentLocationId).map((option) => ({
        option,
        walkDistanceMeters: 0,
      })),
    );
  }

  if (!hasMeaningfulCoords(currentLocation.coords)) {
    return options;
  }

  for (const option of boardIndex.all) {
    if (!hasMeaningfulCoords(option.locationSummary?.coords)) continue;
    if (currentLocationId && option.locationId === currentLocationId) continue;

    const transferDistance = distanceMeters(
      currentLocation.coords,
      option.locationSummary.coords,
    );

    if (transferDistance > WALKING_TRANSFER_METERS) continue;

    options.push({
      option,
      walkDistanceMeters: transferDistance,
    });
  }

  const deduped = new Map();
  for (const candidate of options) {
    const key = `${candidate.option.variant.variantKey}:${candidate.option.stopIndex}`;
    const existing = deduped.get(key);
    if (!existing || candidate.walkDistanceMeters < existing.walkDistanceMeters) {
      deduped.set(key, candidate);
    }
  }

  return Array.from(deduped.values()).sort(
    (a, b) => a.walkDistanceMeters - b.walkDistanceMeters,
  );
}

function buildRawItineraryId(legs) {
  return legs
    .map(
      (leg) =>
        `${leg.route.routeId}:${leg.selectedDirection}:${leg.match.originIndex}:${leg.match.destinationIndex}`,
    )
    .join("__");
}

function sortRawItineraries(a, b) {
  if (a.legs.length !== b.legs.length) {
    return a.legs.length - b.legs.length;
  }

  if (a.score !== b.score) {
    return a.score - b.score;
  }

  return buildRawItineraryId(a.legs).localeCompare(buildRawItineraryId(b.legs));
}

function searchItinerariesByLegCount({
  boardIndex,
  destinationIdSet,
  exactLegCount,
  originLocationIdSet = null,
  originCoords = null,
}) {
  const initialBoardOptions = originCoords
    ? getOriginBoardOptionsFromCoords(boardIndex, originCoords)
    : getOriginBoardOptionsFromLocations(boardIndex, originLocationIdSet);

  if (!initialBoardOptions.length) {
    return [];
  }

  let states = [
    {
      score: 0,
      currentLocation: null,
      originWalkDistanceMeters: 0,
      usedRouteIds: new Set(),
      visitedLocationIds: new Set(
        originLocationIdSet ? Array.from(originLocationIdSet) : [],
      ),
      legs: [],
    },
  ];

  const results = [];

  for (let legIndex = 0; legIndex < exactLegCount; legIndex += 1) {
    const isFinalLeg = legIndex === exactLegCount - 1;
    const nextStates = [];
    const bestStateScoreByKey = new Map();

    for (const state of states) {
      const boardChoices = state.legs.length === 0
        ? initialBoardOptions
        : getTransferBoardOptions(boardIndex, state.currentLocation);

      for (const boardChoice of boardChoices) {
        const routeId = boardChoice.option.variant.routeId;
        if (state.usedRouteIds.has(routeId)) continue;

        const alightOptions = getDestinationAlightOptions(
          boardChoice.option.variant,
          boardChoice.option.stopIndex,
          isFinalLeg ? destinationIdSet : null,
        );

        for (const alightOption of alightOptions) {
          if (
            !isFinalLeg &&
            state.visitedLocationIds.has(alightOption.locationId)
          ) {
            continue;
          }

          const nextLeg = {
            route: boardChoice.option.variant.route,
            selectedDirection: boardChoice.option.variant.selectedDirection,
            match: {
              originIndex: boardChoice.option.stopIndex,
              destinationIndex: alightOption.stopIndex,
              score: alightOption.score,
            },
            boardStop: boardChoice.option.stop,
            alightStop: alightOption.stop,
          };

          const nextScore =
            state.score +
            alightOption.score +
            boardChoice.walkDistanceMeters / 120;

          if (isFinalLeg) {
            results.push({
              itineraryType: exactLegCount === 1 ? "direct" : "transfer",
              score: nextScore,
              originWalkDistanceMeters:
                state.legs.length === 0
                  ? boardChoice.walkDistanceMeters
                  : state.originWalkDistanceMeters,
              legs: [...state.legs, nextLeg],
            });
            continue;
          }

          const usedRouteIds = new Set(state.usedRouteIds);
          usedRouteIds.add(routeId);

          const visitedLocationIds = new Set(state.visitedLocationIds);
          visitedLocationIds.add(alightOption.locationId);

          const nextState = {
            score: nextScore,
            currentLocation: alightOption.locationSummary,
            originWalkDistanceMeters:
              state.legs.length === 0
                ? boardChoice.walkDistanceMeters
                : state.originWalkDistanceMeters,
            usedRouteIds,
            visitedLocationIds,
            legs: [...state.legs, nextLeg],
          };

          const stateKey = [
            legIndex,
            alightOption.locationId,
            routeId,
            nextLeg.match.originIndex,
            nextLeg.match.destinationIndex,
          ].join(":");

          const existingScore = bestStateScoreByKey.get(stateKey);
          if (existingScore != null && existingScore <= nextScore) {
            continue;
          }

          bestStateScoreByKey.set(stateKey, nextScore);
          nextStates.push(nextState);
        }
      }
    }

    states = nextStates
      .sort((a, b) => a.score - b.score)
      .slice(0, MAX_INTERMEDIATE_STATES);
  }

  const bestByItinerary = new Map();

  for (const result of results) {
    const itineraryKey = buildRawItineraryId(result.legs);
    const existing = bestByItinerary.get(itineraryKey);
    if (!existing || result.score < existing.score) {
      bestByItinerary.set(itineraryKey, result);
    }
  }

  return Array.from(bestByItinerary.values()).sort(sortRawItineraries);
}

function buildLeg(routeDoc, selectedDirection, match, accuracyStats) {
  const route = toPublicRoute(routeDoc, { selectedDirection });
  const boardAt = route.stops?.[match?.originIndex ?? 0] || route.origin;
  const alightAt =
    route.stops?.[match?.destinationIndex ?? route.stops.length - 1] ||
    route.destination;

  return {
    route: {
      ...route,
      matchedSegment: match
        ? {
            originIndex: match.originIndex,
            destinationIndex: match.destinationIndex,
            originStopId: boardAt?._id ? String(boardAt._id) : null,
            destinationStopId: alightAt?._id ? String(alightAt._id) : null,
          }
        : null,
    },
    accuracyStats,
    boardAt,
    alightAt,
  };
}

async function formatDirectResult(legs, originCoords = null, originWalkDistanceMeters = 0) {
  const [rawLeg] = legs;
  const accuracyStats = await Route.getAccuracyStats(rawLeg.route.routeId);
  const leg = buildLeg(
    rawLeg.route,
    rawLeg.selectedDirection,
    rawLeg.match || null,
    accuracyStats,
  );
  const route = { ...leg.route };

  if (originCoords) {
    route.distanceMeters = originWalkDistanceMeters;
  }

  return {
    itineraryType: "direct",
    itineraryId: buildRawItineraryId(legs),
    transferCount: 0,
    route,
    accuracyStats,
    legs: [{ ...leg, route }],
  };
}

function mergeFareRanges(firstFare, secondFare) {
  if (!firstFare && !secondFare) return null;

  const currency = firstFare?.currency || secondFare?.currency || "EGP";
  return {
    min: (firstFare?.min || 0) + (secondFare?.min || 0),
    max: (firstFare?.max || 0) + (secondFare?.max || 0),
    currency,
  };
}

async function formatTransferResult(legs, originWalkDistanceMeters = 0) {
  const accuracyStatsList = await Promise.all(
    legs.map((leg) => Route.getAccuracyStats(leg.route.routeId)),
  );

  const formattedLegs = legs.map((leg, index) =>
    buildLeg(
      leg.route,
      leg.selectedDirection,
      leg.match,
      accuracyStatsList[index],
    ),
  );

  const transferWalks = [];
  for (let index = 0; index < formattedLegs.length - 1; index += 1) {
    const fromLeg = formattedLegs[index];
    const toLeg = formattedLegs[index + 1];
    const distance = getTransferDistance(fromLeg.alightAt, toLeg.boardAt);

    transferWalks.push({
      from: summarizeLocation(fromLeg.alightAt),
      to: summarizeLocation(toLeg.boardAt),
      distanceMeters: distance == null ? 0 : distance,
    });
  }

  const totalFare = formattedLegs.reduce(
    (carry, leg) => mergeFareRanges(carry, leg.route.fare),
    null,
  );
  const transferPlaces = transferWalks.map((walk) =>
    walk.distanceMeters === 0 ? walk.from : walk.to,
  );

  return {
    itineraryType: "transfer",
    itineraryId: buildRawItineraryId(legs),
    transferCount: Math.max(0, formattedLegs.length - 1),
    transferPlace: transferPlaces[0] || null,
    transferPlaces,
    transferWalk: transferWalks[0] || null,
    transferWalks,
    originWalkDistanceMeters,
    totalFare,
    legs: formattedLegs,
  };
}

function normalizeLocationSummary(location) {
  if (!location) return null;

  return {
    _id: location._id ? String(location._id) : null,
    nameAr: location.nameAr || null,
    nameEn: location.nameEn || null,
    coords: {
      lat: Number(location.coords?.lat || 0),
      lng: Number(location.coords?.lng || 0),
    },
  };
}

function normalizeFare(fare) {
  if (!fare) return null;

  return {
    min: Number(fare.min || 0),
    max: Number(fare.max || 0),
    currency: fare.currency || "EGP",
  };
}

function getLegRouteIds(legs = []) {
  return Array.from(
    new Set(
      legs
        .map((leg) => String(leg?.route?.routeId || leg?.routeId || "").trim())
        .filter(Boolean),
    ),
  );
}

function findRouteStopById(route, stopId) {
  if (!route || !stopId) return null;
  return (
    route.stops?.find((stop) => String(stop?._id) === String(stopId))
    || route.stations?.find((stop) => String(stop?._id) === String(stopId))
    || null
  );
}

async function searchRoutes(
  originQuery,
  destinationQuery,
  userId = null,
  originCoords = null,
) {
  const normalizedOrigin = typeof originQuery === "string" ? originQuery.trim() : "";
  const normalizedDestination =
    typeof destinationQuery === "string" ? destinationQuery.trim() : "";
  const useLocationSearch =
    originCoords && originCoords.lat != null && originCoords.lng != null;

  let itineraryMatches = [];

  if (useLocationSearch && !normalizedDestination) {
    throw { statusCode: 400, message: "يرجى إدخال الوجهة" };
  }

  if (!useLocationSearch && (!normalizedOrigin || !normalizedDestination)) {
    throw { statusCode: 400, message: "يرجى إدخال نقطة البداية والوجهة" };
  }

  const [activeRoutes, destinationLocations, originLocations] = await Promise.all([
    loadAllActiveRoutes(),
    findMatchingLocations(normalizedDestination),
    useLocationSearch ? Promise.resolve([]) : findMatchingLocations(normalizedOrigin),
  ]);

  if (!destinationLocations.length || (!useLocationSearch && !originLocations.length)) {
    return [];
  }

  const variants = buildRouteVariants(activeRoutes);
  const boardIndex = buildBoardableStopIndex(variants);
  const destinationIdSet = new Set(destinationLocations.map((location) => String(location._id)));
  const originLocationIdSet = new Set(originLocations.map((location) => String(location._id)));

  const searchOptions = {
    boardIndex,
    destinationIdSet,
    originLocationIdSet: useLocationSearch ? null : originLocationIdSet,
    originCoords: useLocationSearch ? originCoords : null,
  };

  const directMatches = searchItinerariesByLegCount({
    ...searchOptions,
    exactLegCount: 1,
  });
  const oneTransferMatches = searchItinerariesByLegCount({
    ...searchOptions,
    exactLegCount: 2,
  });

  if (directMatches.length) {
    itineraryMatches = directMatches.sort(sortRawItineraries);
  } else if (oneTransferMatches.length) {
    itineraryMatches = oneTransferMatches
      .slice(0, MAX_ONE_TRANSFER_FALLBACK_RESULTS)
      .sort(sortRawItineraries);
  } else {
    for (let transferCount = 2; transferCount <= MAX_TRANSFER_SEARCH_DEPTH; transferCount += 1) {
      const exactMatches = searchItinerariesByLegCount({
        ...searchOptions,
        exactLegCount: transferCount + 1,
      });

      if (exactMatches.length) {
        itineraryMatches = exactMatches.slice(0, MAX_DEEP_FALLBACK_RESULTS);
        break;
      }
    }
  }

  if (userId) {
    await SearchHistory.create({
      user: userId,
      originQuery: useLocationSearch
        ? normalizedOrigin || "موقعي الحالي"
        : normalizedOrigin,
      destinationQuery: normalizedDestination,
      routesFound: itineraryMatches.length,
    });
  }

  const results = await Promise.all(
    itineraryMatches.map((match) => {
      if (match.legs.length > 1) {
        return formatTransferResult(
          match.legs,
          match.originWalkDistanceMeters || 0,
        );
      }
      return formatDirectResult(
        match.legs,
        useLocationSearch ? originCoords : null,
        match.originWalkDistanceMeters || 0,
      );
    }),
  );

  return results;
}

async function findNearestRoutes(userCoords, userId = null) {
  if (!userCoords || userCoords.lat == null || userCoords.lng == null) {
    throw { statusCode: 400, message: "إحداثيات الموقع غير صحيحة" };
  }

  const routes = await populateRouteGraph(Route.find({ isActive: true }));

  const routesWithStats = await Promise.all(
    routes
      .map((route) => {
        const publicRoute = toPublicRoute(route);
        const nearestDistance = getNearestMapPointDistance(publicRoute, userCoords);
        if (nearestDistance == null) return null;
        return {
          route,
          publicRoute,
          distanceMeters: nearestDistance,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 5)
      .map(async (item) => {
        const accuracyStats = await Route.getAccuracyStats(item.route.routeId);
        const route = {
          ...item.publicRoute,
          distanceMeters: item.distanceMeters,
        };

        return {
          itineraryType: "direct",
          transferCount: 0,
          route,
          accuracyStats,
          legs: [
            {
              route,
              accuracyStats,
              boardAt: route.origin,
              alightAt: route.destination,
            },
          ],
          distanceMeters: item.distanceMeters,
        };
      }),
  );

  if (userId) {
    await SearchHistory.create({
      user: userId,
      originQuery: "موقعي الحالي",
      destinationQuery: "أقرب الخطوط",
      routesFound: routesWithStats.length,
    });
  }

  return routesWithStats;
}

async function getStations() {
  const activeLocationIds = await Route.distinct("stops.location", {
    isActive: true,
  });

  const locations = await Location.find(
    { _id: { $in: activeLocationIds } },
    { nameAr: 1 },
  )
    .sort({ nameAr: 1 })
    .lean();

  return Array.from(new Set(locations.map((location) => location.nameAr)));
}

async function getRouteById(routeId, selectedDirection = "forward") {
  const route = await populateRouteGraph(
    Route.findOne({ routeId, isActive: true }),
  );

  if (!route) {
    throw { statusCode: 404, message: "الخط غير موجود" };
  }

  const normalizedDirection =
    selectedDirection === "reverse" && route.isBidirectional
      ? "reverse"
      : "forward";

  const accuracyStats = await Route.getAccuracyStats(routeId);
  return {
    route: toPublicRoute(route, { selectedDirection: normalizedDirection }),
    accuracyStats,
  };
}

async function saveRoute(userId, routeId) {
  const route = await Route.findOne({ routeId, isActive: true });
  if (!route) {
    throw { statusCode: 404, message: "الخط غير موجود" };
  }

  await User.findByIdAndUpdate(
    userId,
    { $addToSet: { savedRoutes: route._id } },
    { new: true },
  );

  return { message: "تم حفظ الخط ✓" };
}

async function saveItinerary(userId, itinerary = {}) {
  const normalizedItineraryId = String(itinerary?.itineraryId || "").trim();
  const normalizedTransferCount = Number(itinerary?.transferCount || 0);
  const normalizedLegs = Array.isArray(itinerary?.legs) ? itinerary.legs : [];
  const normalizedRouteIds = getLegRouteIds(normalizedLegs);

  if (!normalizedItineraryId || normalizedTransferCount < 1 || normalizedLegs.length < 2) {
    throw { statusCode: 400, message: "بيانات الرحلة غير مكتملة" };
  }

  const routes = await Route.find({
    routeId: { $in: normalizedRouteIds },
    isActive: true,
  });

  if (routes.length !== normalizedRouteIds.length) {
    throw { statusCode: 404, message: "بعض خطوط الرحلة غير موجودة" };
  }

  const savedLegs = normalizedLegs.map((leg) => ({
    routeId: String(leg?.route?.routeId || leg?.routeId || "").trim(),
    selectedDirection:
      leg?.route?.selectedDirection === "reverse" || leg?.selectedDirection === "reverse"
        ? "reverse"
        : "forward",
    originStopId: leg?.route?.matchedSegment?.originStopId || leg?.originStopId || leg?.boardAt?._id || null,
    destinationStopId:
      leg?.route?.matchedSegment?.destinationStopId || leg?.destinationStopId || leg?.alightAt?._id || null,
    boardAt: normalizeLocationSummary(leg?.boardAt),
    alightAt: normalizeLocationSummary(leg?.alightAt),
  }));

  const transferWalks = (Array.isArray(itinerary?.transferWalks) ? itinerary.transferWalks : []).map(
    (walk) => ({
      from: normalizeLocationSummary(walk?.from),
      to: normalizeLocationSummary(walk?.to),
      distanceMeters: Math.max(0, Number(walk?.distanceMeters || 0)),
    }),
  );

  const savedItinerary = await SavedItinerary.findOneAndUpdate(
    { user: userId, itineraryId: normalizedItineraryId },
    {
      user: userId,
      itineraryId: normalizedItineraryId,
      transferCount: normalizedTransferCount,
      routeIds: normalizedRouteIds,
      legs: savedLegs,
      transferWalks,
      totalFare: normalizeFare(itinerary?.totalFare),
      originWalkDistanceMeters: Math.max(
        0,
        Number(itinerary?.originWalkDistanceMeters || 0),
      ),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return {
    message: "تم حفظ الرحلة ✓",
    itineraryId: savedItinerary.itineraryId,
  };
}

async function unsaveRoute(userId, routeId) {
  const route = await Route.findOne({ routeId, isActive: true });
  if (!route) {
    throw { statusCode: 404, message: "الخط غير موجود" };
  }

  await User.findByIdAndUpdate(
    userId,
    { $pull: { savedRoutes: route._id } },
    { new: true },
  );

  return { message: "تم إزالة الخط ✓" };
}

async function unsaveItinerary(userId, itineraryId) {
  const normalizedItineraryId = String(itineraryId || "").trim();
  if (!normalizedItineraryId) {
    throw { statusCode: 400, message: "يرجى إرسال itineraryId صحيحة" };
  }

  await SavedItinerary.deleteOne({
    user: userId,
    itineraryId: normalizedItineraryId,
  });

  return {
    message: "تم إزالة الرحلة ✓",
    itineraryId: normalizedItineraryId,
  };
}

async function clearSavedRoutes(userId) {
  await Promise.all([
    User.findByIdAndUpdate(
      userId,
      { $set: { savedRoutes: [] } },
      { new: true },
    ),
    SavedItinerary.deleteMany({ user: userId }),
  ]);
  return { message: "تم حذف كل المحفوظات ✓" };
}

async function getHistory(userId) {
  return SearchHistory.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
}

async function getSavedRoutes(userId) {
  const user = await User.findById(userId).populate("savedRoutes");
  if (!user) {
    throw { statusCode: 404, message: "المستخدم غير موجود" };
  }

  const routesWithStats = await Promise.all(
    user.savedRoutes.map(async (savedRoute) => {
      const route = await populateRouteGraph(
        Route.findOne({ _id: savedRoute._id, isActive: true }),
      );

      if (!route) return null;

      const accuracyStats = await Route.getAccuracyStats(route.routeId);
      return { ...toPublicRoute(route), accuracyStats };
    }),
  );

  const itineraries = await SavedItinerary.find({ user: userId })
    .sort({ createdAt: -1 })
    .lean();

  const hydratedItineraries = await Promise.all(
    itineraries.map(async (savedItinerary) => {
      const legs = await Promise.all(
        savedItinerary.legs.map(async (savedLeg) => {
          try {
            const { route, accuracyStats } = await getRouteById(
              savedLeg.routeId,
              savedLeg.selectedDirection,
            );
            const boardAt =
              findRouteStopById(route, savedLeg.originStopId) ||
              savedLeg.boardAt ||
              route.origin;
            const alightAt =
              findRouteStopById(route, savedLeg.destinationStopId) ||
              savedLeg.alightAt ||
              route.destination;

            return {
              route: {
                ...route,
                matchedSegment: {
                  originStopId: savedLeg.originStopId || boardAt?._id || null,
                  destinationStopId:
                    savedLeg.destinationStopId || alightAt?._id || null,
                },
              },
              accuracyStats,
              boardAt,
              alightAt,
            };
          } catch (error) {
            return null;
          }
        }),
      );

      const validLegs = legs.filter(Boolean);
      if (validLegs.length < 2) {
        return null;
      }

      const transferPlaces = (savedItinerary.transferWalks || []).map((walk) =>
        walk.distanceMeters === 0 ? walk.from : walk.to,
      );

      return {
        itineraryType: "transfer",
        itineraryId: savedItinerary.itineraryId,
        transferCount: savedItinerary.transferCount,
        transferWalks: savedItinerary.transferWalks || [],
        transferWalk: savedItinerary.transferWalks?.[0] || null,
        transferPlaces,
        transferPlace: transferPlaces[0] || null,
        totalFare: savedItinerary.totalFare || null,
        originWalkDistanceMeters: savedItinerary.originWalkDistanceMeters || 0,
        legs: validLegs,
      };
    }),
  );

  return {
    routes: routesWithStats.filter(Boolean),
    itineraries: hydratedItineraries.filter(Boolean),
  };
}

module.exports = {
  searchRoutes,
  findNearestRoutes,
  getStations,
  getRouteById,
  saveRoute,
  saveItinerary,
  unsaveRoute,
  unsaveItinerary,
  clearSavedRoutes,
  getHistory,
  getSavedRoutes,
};
