const {
  SavedTravelPlan,
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

function buildRawTravelPlanId(travelSegments) {
  return travelSegments
    .map(
      (travelSegment) =>
        `${travelSegment.route.routeId}:${travelSegment.selectedDirection}:${travelSegment.match.originIndex}:${travelSegment.match.destinationIndex}`,
    )
    .join("__");
}

function sortRawTravelPlans(a, b) {
  if (a.travelSegments.length !== b.travelSegments.length) {
    return a.travelSegments.length - b.travelSegments.length;
  }

  if (a.score !== b.score) {
    return a.score - b.score;
  }

  return buildRawTravelPlanId(a.travelSegments).localeCompare(buildRawTravelPlanId(b.travelSegments));
}

function searchTravelPlansBySegmentCount({
  boardIndex,
  destinationIdSet,
  exactTravelSegmentCount,
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
      travelSegments: [],
    },
  ];

  const results = [];

  for (let travelSegmentIndex = 0; travelSegmentIndex < exactTravelSegmentCount; travelSegmentIndex += 1) {
    const isFinalTravelSegment = travelSegmentIndex === exactTravelSegmentCount - 1;
    const nextStates = [];
    const bestStateScoreByKey = new Map();

    for (const state of states) {
      const boardChoices = state.travelSegments.length === 0
        ? initialBoardOptions
        : getTransferBoardOptions(boardIndex, state.currentLocation);

      for (const boardChoice of boardChoices) {
        const routeId = boardChoice.option.variant.routeId;
        if (state.usedRouteIds.has(routeId)) continue;

        const alightOptions = getDestinationAlightOptions(
          boardChoice.option.variant,
          boardChoice.option.stopIndex,
          isFinalTravelSegment ? destinationIdSet : null,
        );

        for (const alightOption of alightOptions) {
          if (
            !isFinalTravelSegment &&
            state.visitedLocationIds.has(alightOption.locationId)
          ) {
            continue;
          }

          const nextTravelSegment = {
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

          if (isFinalTravelSegment) {
            results.push({
              travelPlanType: exactTravelSegmentCount === 1 ? "direct" : "transfer",
              score: nextScore,
              originWalkDistanceMeters:
                state.travelSegments.length === 0
                  ? boardChoice.walkDistanceMeters
                  : state.originWalkDistanceMeters,
              travelSegments: [...state.travelSegments, nextTravelSegment],
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
              state.travelSegments.length === 0
                ? boardChoice.walkDistanceMeters
                : state.originWalkDistanceMeters,
            usedRouteIds,
            visitedLocationIds,
            travelSegments: [...state.travelSegments, nextTravelSegment],
          };

          const stateKey = [
            travelSegmentIndex,
            alightOption.locationId,
            routeId,
            nextTravelSegment.match.originIndex,
            nextTravelSegment.match.destinationIndex,
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

  const bestByTravelPlan = new Map();

  for (const result of results) {
    const travelPlanKey = buildRawTravelPlanId(result.travelSegments);
    const existing = bestByTravelPlan.get(travelPlanKey);
    if (!existing || result.score < existing.score) {
      bestByTravelPlan.set(travelPlanKey, result);
    }
  }

  return Array.from(bestByTravelPlan.values()).sort(sortRawTravelPlans);
}

function buildTravelSegment(routeDoc, selectedDirection, match, accuracyStats) {
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

async function formatDirectTravelPlanResult(travelSegments, originCoords = null, originWalkDistanceMeters = 0) {
  const [rawTravelSegment] = travelSegments;
  const accuracyStats = await Route.getAccuracyStats(rawTravelSegment.route.routeId);
  const travelSegment = buildTravelSegment(
    rawTravelSegment.route,
    rawTravelSegment.selectedDirection,
    rawTravelSegment.match || null,
    accuracyStats,
  );
  const route = { ...travelSegment.route };

  if (originCoords) {
    route.distanceMeters = originWalkDistanceMeters;
  }

  return {
    travelPlanType: "direct",
    travelPlanId: buildRawTravelPlanId(travelSegments),
    transferCount: 0,
    route,
    accuracyStats,
    travelSegments: [{ ...travelSegment, route }],
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

async function formatTransferTravelPlanResult(travelSegments, originWalkDistanceMeters = 0) {
  const accuracyStatsList = await Promise.all(
    travelSegments.map((travelSegment) => Route.getAccuracyStats(travelSegment.route.routeId)),
  );

  const formattedTravelSegments = travelSegments.map((travelSegment, index) =>
    buildTravelSegment(
      travelSegment.route,
      travelSegment.selectedDirection,
      travelSegment.match,
      accuracyStatsList[index],
    ),
  );

  const transferWalks = [];
  for (let index = 0; index < formattedTravelSegments.length - 1; index += 1) {
    const fromTravelSegment = formattedTravelSegments[index];
    const toTravelSegment = formattedTravelSegments[index + 1];
    const distance = getTransferDistance(fromTravelSegment.alightAt, toTravelSegment.boardAt);

    transferWalks.push({
      from: summarizeLocation(fromTravelSegment.alightAt),
      to: summarizeLocation(toTravelSegment.boardAt),
      distanceMeters: distance == null ? 0 : distance,
    });
  }

  const totalFare = formattedTravelSegments.reduce(
    (carry, travelSegment) => mergeFareRanges(carry, travelSegment.route.fare),
    null,
  );
  const transferPlaces = transferWalks.map((walk) =>
    walk.distanceMeters === 0 ? walk.from : walk.to,
  );

  return {
    travelPlanType: "transfer",
    travelPlanId: buildRawTravelPlanId(travelSegments),
    transferCount: Math.max(0, formattedTravelSegments.length - 1),
    transferPlace: transferPlaces[0] || null,
    transferPlaces,
    transferWalk: transferWalks[0] || null,
    transferWalks,
    originWalkDistanceMeters,
    totalFare,
    travelSegments: formattedTravelSegments,
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

function getTravelSegmentRouteIds(travelSegments = []) {
  return Array.from(
    new Set(
      travelSegments
        .map((travelSegment) => String(travelSegment?.route?.routeId || travelSegment?.routeId || "").trim())
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

  let travelPlanMatches = [];

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

  const directMatches = searchTravelPlansBySegmentCount({
    ...searchOptions,
    exactTravelSegmentCount: 1,
  });
  const oneTransferMatches = searchTravelPlansBySegmentCount({
    ...searchOptions,
    exactTravelSegmentCount: 2,
  });

  if (directMatches.length) {
    travelPlanMatches = directMatches.sort(sortRawTravelPlans);
  } else if (oneTransferMatches.length) {
    travelPlanMatches = oneTransferMatches
      .slice(0, MAX_ONE_TRANSFER_FALLBACK_RESULTS)
      .sort(sortRawTravelPlans);
  } else {
    for (let transferCount = 2; transferCount <= MAX_TRANSFER_SEARCH_DEPTH; transferCount += 1) {
      const exactMatches = searchTravelPlansBySegmentCount({
        ...searchOptions,
        exactTravelSegmentCount: transferCount + 1,
      });

      if (exactMatches.length) {
        travelPlanMatches = exactMatches.slice(0, MAX_DEEP_FALLBACK_RESULTS);
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
      routesFound: travelPlanMatches.length,
    });
  }

  const results = await Promise.all(
    travelPlanMatches.map((match) => {
      if (match.travelSegments.length > 1) {
        return formatTransferTravelPlanResult(
          match.travelSegments,
          match.originWalkDistanceMeters || 0,
        );
      }
      return formatDirectTravelPlanResult(
        match.travelSegments,
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
          travelPlanType: "direct",
          transferCount: 0,
          route,
          accuracyStats,
          travelSegments: [
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

async function saveTravelPlan(userId, travelPlan = {}) {
  const normalizedTravelPlanId = String(travelPlan?.travelPlanId || "").trim();
  const normalizedTransferCount = Number(travelPlan?.transferCount || 0);
  const normalizedTravelSegments = Array.isArray(travelPlan?.travelSegments) ? travelPlan.travelSegments : [];
  const normalizedRouteIds = getTravelSegmentRouteIds(normalizedTravelSegments);

  if (!normalizedTravelPlanId || normalizedTransferCount < 1 || normalizedTravelSegments.length < 2) {
    throw { statusCode: 400, message: "بيانات الرحلة غير مكتملة" };
  }

  const routes = await Route.find({
    routeId: { $in: normalizedRouteIds },
    isActive: true,
  });

  if (routes.length !== normalizedRouteIds.length) {
    throw { statusCode: 404, message: "بعض خطوط الرحلة غير موجودة" };
  }

  const savedTravelSegments = normalizedTravelSegments.map((travelSegment) => ({
    routeId: String(travelSegment?.route?.routeId || travelSegment?.routeId || "").trim(),
    selectedDirection:
      travelSegment?.route?.selectedDirection === "reverse" || travelSegment?.selectedDirection === "reverse"
        ? "reverse"
        : "forward",
    originStopId: travelSegment?.route?.matchedSegment?.originStopId || travelSegment?.originStopId || travelSegment?.boardAt?._id || null,
    destinationStopId:
      travelSegment?.route?.matchedSegment?.destinationStopId || travelSegment?.destinationStopId || travelSegment?.alightAt?._id || null,
    boardAt: normalizeLocationSummary(travelSegment?.boardAt),
    alightAt: normalizeLocationSummary(travelSegment?.alightAt),
  }));

  const transferWalks = (Array.isArray(travelPlan?.transferWalks) ? travelPlan.transferWalks : []).map(
    (walk) => ({
      from: normalizeLocationSummary(walk?.from),
      to: normalizeLocationSummary(walk?.to),
      distanceMeters: Math.max(0, Number(walk?.distanceMeters || 0)),
    }),
  );

  const savedTravelPlanDoc = await SavedTravelPlan.findOneAndUpdate(
    { user: userId, travelPlanId: normalizedTravelPlanId },
    {
      user: userId,
      travelPlanId: normalizedTravelPlanId,
      transferCount: normalizedTransferCount,
      routeIds: normalizedRouteIds,
      travelSegments: savedTravelSegments,
      transferWalks,
      totalFare: normalizeFare(travelPlan?.totalFare),
      originWalkDistanceMeters: Math.max(
        0,
        Number(travelPlan?.originWalkDistanceMeters || 0),
      ),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return {
    message: "تم حفظ الرحلة ✓",
    travelPlanId: savedTravelPlanDoc.travelPlanId,
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

async function unsaveTravelPlan(userId, travelPlanId) {
  const normalizedTravelPlanId = String(travelPlanId || "").trim();
  if (!normalizedTravelPlanId) {
    throw { statusCode: 400, message: "يرجى إرسال travelPlanId صحيحة" };
  }

  await SavedTravelPlan.deleteOne({
    user: userId,
    travelPlanId: normalizedTravelPlanId,
  });

  return {
    message: "تم إزالة الرحلة ✓",
    travelPlanId: normalizedTravelPlanId,
  };
}

async function clearSavedRoutes(userId) {
  await Promise.all([
    User.findByIdAndUpdate(
      userId,
      { $set: { savedRoutes: [] } },
      { new: true },
    ),
    SavedTravelPlan.deleteMany({ user: userId }),
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

  const travelPlans = await SavedTravelPlan.find({ user: userId })
    .sort({ createdAt: -1 })
    .lean();

  const hydratedTravelPlans = await Promise.all(
    travelPlans.map(async (savedTravelPlanDoc) => {
      const travelSegments = await Promise.all(
        savedTravelPlanDoc.travelSegments.map(async (savedTravelSegment) => {
          try {
            const { route, accuracyStats } = await getRouteById(
              savedTravelSegment.routeId,
              savedTravelSegment.selectedDirection,
            );
            const boardAt =
              findRouteStopById(route, savedTravelSegment.originStopId) ||
              savedTravelSegment.boardAt ||
              route.origin;
            const alightAt =
              findRouteStopById(route, savedTravelSegment.destinationStopId) ||
              savedTravelSegment.alightAt ||
              route.destination;

            return {
              route: {
                ...route,
                matchedSegment: {
                  originStopId: savedTravelSegment.originStopId || boardAt?._id || null,
                  destinationStopId:
                    savedTravelSegment.destinationStopId || alightAt?._id || null,
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

      const validTravelSegments = travelSegments.filter(Boolean);
      if (validTravelSegments.length < 2) {
        return null;
      }

      const transferPlaces = (savedTravelPlanDoc.transferWalks || []).map((walk) =>
        walk.distanceMeters === 0 ? walk.from : walk.to,
      );

      return {
        travelPlanType: "transfer",
        travelPlanId: savedTravelPlanDoc.travelPlanId,
        transferCount: savedTravelPlanDoc.transferCount,
        transferWalks: savedTravelPlanDoc.transferWalks || [],
        transferWalk: savedTravelPlanDoc.transferWalks?.[0] || null,
        transferPlaces,
        transferPlace: transferPlaces[0] || null,
        totalFare: savedTravelPlanDoc.totalFare || null,
        originWalkDistanceMeters: savedTravelPlanDoc.originWalkDistanceMeters || 0,
        travelSegments: validTravelSegments,
      };
    }),
  );

  return {
    routes: routesWithStats.filter(Boolean),
    travelPlans: hydratedTravelPlans.filter(Boolean),
  };
}

module.exports = {
  searchRoutes,
  findNearestRoutes,
  getStations,
  getRouteById,
  saveRoute,
  saveTravelPlan,
  unsaveRoute,
  unsaveTravelPlan,
  clearSavedRoutes,
  getHistory,
  getSavedRoutes,
};
