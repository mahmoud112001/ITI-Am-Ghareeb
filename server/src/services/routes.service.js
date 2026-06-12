const {
  Location,
  Route,
  SearchHistory,
  User,
} = require("../models/index.js");
const {
  hasMeaningfulCoords,
  normalizeSearchText,
  populateRouteGraph,
  summarizeLocation,
  toPublicRoute,
} = require("../utils/routeNetwork.js");

const WALKING_TRANSFER_METERS = 500;
const LOCATION_RESULT_LIMIT = 8;

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

function isSearchable(stop) {
  return stop?.isSearchable !== false;
}

function getNearestMapPointDistance(route, userLocation) {
  const mapPoints = route.mapPoints || [];
  let minDistance = Number.POSITIVE_INFINITY;

  for (const point of mapPoints) {
    if (!hasMeaningfulCoords(point.coords)) continue;
    const dist = distanceMeters(userLocation, point.coords);
    if (dist < minDistance) minDistance = dist;
  }

  return Number.isFinite(minDistance) ? minDistance : null;
}

async function findMatchingLocations(query, { searchableOnly = true } = {}) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];

  const regex = new RegExp(query.trim(), "i");
  const filter = {
    $or: [
      { nameAr: regex },
      { nameEn: regex },
      { "aliases.ar": regex },
      { "aliases.en": regex },
    ],
  };

  if (searchableOnly) {
    filter.isSearchable = true;
  }

  return Location.find(filter)
    .sort({ isSearchable: -1, nameAr: 1 })
    .limit(LOCATION_RESULT_LIMIT)
    .lean();
}

function selectOrderedSegment(stops, originLocationIds, destinationLocationIds) {
  let bestMatch = null;

  for (let i = 0; i < stops.length; i += 1) {
    const originStop = stops[i];
    if (!originLocationIds.has(getStopId(originStop))) continue;
    if (!canPickup(originStop)) continue;

    for (let j = i + 1; j < stops.length; j += 1) {
      const destinationStop = stops[j];
      if (!destinationLocationIds.has(getStopId(destinationStop))) continue;
      if (!canDropoff(destinationStop)) continue;

      const score = j - i;
      if (!bestMatch || score < bestMatch.score) {
        bestMatch = {
          originIndex: i,
          destinationIndex: j,
          score,
        };
      }
      break;
    }
  }

  return bestMatch;
}

function selectBestDirectMatch(route, originLocationIds, destinationLocationIds) {
  let bestCandidate = null;

  for (const selectedDirection of getRouteDirections(route)) {
    const stops = getRouteStops(route, selectedDirection);
    const match = selectOrderedSegment(
      stops,
      originLocationIds,
      destinationLocationIds,
    );

    if (!match) continue;

    const candidate = {
      route,
      selectedDirection,
      match,
      score: match.score,
    };

    if (
      !bestCandidate ||
      candidate.score < bestCandidate.score ||
      (candidate.score === bestCandidate.score &&
        bestCandidate.selectedDirection === "reverse" &&
        candidate.selectedDirection === "forward")
    ) {
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

function buildReachableTransferStops(stops, originLocationIds) {
  const bestByLocation = new Map();

  for (let i = 0; i < stops.length; i += 1) {
    const originStop = stops[i];
    if (!originLocationIds.has(getStopId(originStop))) continue;
    if (!canPickup(originStop)) continue;

    for (let j = i + 1; j < stops.length; j += 1) {
      const transferStop = stops[j];
      if (!canDropoff(transferStop) || !isSearchable(transferStop)) continue;

      const locationId = getStopId(transferStop);
      const score = j - i;
      const existing = bestByLocation.get(locationId);

      if (!existing || score < existing.score) {
        bestByLocation.set(locationId, {
          transferStop,
          originIndex: i,
          destinationIndex: j,
          score,
        });
      }
    }
  }

  return bestByLocation;
}

function buildBoardsToDestination(stops, destinationLocationIds) {
  const bestByLocation = new Map();

  for (let j = 1; j < stops.length; j += 1) {
    const destinationStop = stops[j];
    if (!destinationLocationIds.has(getStopId(destinationStop))) continue;
    if (!canDropoff(destinationStop)) continue;

    for (let i = 0; i < j; i += 1) {
      const boardStop = stops[i];
      if (!canPickup(boardStop) || !isSearchable(boardStop)) continue;

      const locationId = getStopId(boardStop);
      const score = j - i;
      const existing = bestByLocation.get(locationId);

      if (!existing || score < existing.score) {
        bestByLocation.set(locationId, {
          boardStop,
          originIndex: i,
          destinationIndex: j,
          score,
        });
      }
    }
  }

  return bestByLocation;
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

function selectNearestBoardingSegment(stops, destinationLocationIds, userCoords) {
  let bestMatch = null;

  for (let j = 1; j < stops.length; j += 1) {
    const destinationStop = stops[j];
    if (!destinationLocationIds.has(getStopId(destinationStop))) continue;
    if (!canDropoff(destinationStop)) continue;

    for (let i = 0; i < j; i += 1) {
      const boardStop = stops[i];
      const boardSummary = summarizeLocation(boardStop);
      if (!canPickup(boardStop) || !hasMeaningfulCoords(boardSummary?.coords)) {
        continue;
      }

      const boardDistance = distanceMeters(userCoords, boardSummary.coords);
      const stopSpan = j - i;
      const score = boardDistance + stopSpan * 120;
      if (!bestMatch || score < bestMatch.score) {
        bestMatch = {
          originIndex: i,
          destinationIndex: j,
          score,
          boardDistanceMeters: boardDistance,
        };
      }
    }
  }

  return bestMatch;
}

async function loadRoutesByLocationIds(locationIds) {
  return populateRouteGraph(
    Route.find({
      isActive: true,
      "stops.location": { $in: locationIds },
    }),
  );
}

async function searchDirectRoutes(originQuery, destinationQuery) {
  const [originLocations, destinationLocations] = await Promise.all([
    findMatchingLocations(originQuery),
    findMatchingLocations(destinationQuery),
  ]);

  if (!originLocations.length || !destinationLocations.length) {
    return [];
  }

  const originIds = originLocations.map((location) => location._id);
  const destinationIds = destinationLocations.map((location) => location._id);
  const originIdSet = new Set(originIds.map(String));
  const destinationIdSet = new Set(destinationIds.map(String));

  const routes = await populateRouteGraph(
    Route.find({
      isActive: true,
      $and: [
        { "stops.location": { $in: originIds } },
        { "stops.location": { $in: destinationIds } },
      ],
    }).sort({ verified: -1, createdAt: -1 }),
  );

  return routes
    .map((route) =>
      selectBestDirectMatch(route, originIdSet, destinationIdSet),
    )
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);
}

async function searchTransferRoutes(originQuery, destinationQuery) {
  const [originLocations, destinationLocations] = await Promise.all([
    findMatchingLocations(originQuery),
    findMatchingLocations(destinationQuery),
  ]);

  if (!originLocations.length || !destinationLocations.length) {
    return [];
  }

  const originIds = originLocations.map((location) => location._id);
  const destinationIds = destinationLocations.map((location) => location._id);
  const originIdSet = new Set(originIds.map(String));
  const destinationIdSet = new Set(destinationIds.map(String));

  const [originRoutes, destinationRoutes] = await Promise.all([
    loadRoutesByLocationIds(originIds),
    loadRoutesByLocationIds(destinationIds),
  ]);

  const destinationOptions = [];
  for (const route of destinationRoutes) {
    for (const selectedDirection of getRouteDirections(route)) {
      const stops = getRouteStops(route, selectedDirection);
      const transferBoards = buildBoardsToDestination(stops, destinationIdSet);
      if (!transferBoards.size) continue;
      destinationOptions.push({
        route,
        selectedDirection,
        stops,
        transferBoards,
      });
    }
  }

  const bestCandidates = new Map();

  for (const firstRoute of originRoutes) {
    for (const firstDirection of getRouteDirections(firstRoute)) {
      const firstStops = getRouteStops(firstRoute, firstDirection);
      const firstTransfers = buildReachableTransferStops(firstStops, originIdSet);
      if (!firstTransfers.size) continue;

      for (const secondLeg of destinationOptions) {
        if (String(secondLeg.route._id) === String(firstRoute._id)) continue;

        for (const firstTransfer of firstTransfers.values()) {
          for (const secondTransfer of secondLeg.transferBoards.values()) {
            const transferDistance = getTransferDistance(
              firstTransfer.transferStop,
              secondTransfer.boardStop,
            );

            if (
              transferDistance == null ||
              transferDistance > WALKING_TRANSFER_METERS
            ) {
              continue;
            }

            const walkingPenalty = transferDistance === 0
              ? 0
              : transferDistance / 120;
            const score =
              firstTransfer.score + secondTransfer.score + walkingPenalty;

            const candidateKey = [
              firstRoute._id,
              firstDirection,
              getStopId(firstTransfer.transferStop),
              secondLeg.route._id,
              secondLeg.selectedDirection,
              getStopId(secondTransfer.boardStop),
            ].join(":");

            const existing = bestCandidates.get(candidateKey);
            if (!existing || score < existing.score) {
              bestCandidates.set(candidateKey, {
                itineraryType: "transfer",
                score,
                transferDistanceMeters: transferDistance,
                firstLeg: {
                  route: firstRoute,
                  selectedDirection: firstDirection,
                  match: {
                    originIndex: firstTransfer.originIndex,
                    destinationIndex: firstTransfer.destinationIndex,
                    score: firstTransfer.score,
                  },
                },
                secondLeg: {
                  route: secondLeg.route,
                  selectedDirection: secondLeg.selectedDirection,
                  match: {
                    originIndex: secondTransfer.originIndex,
                    destinationIndex: secondTransfer.destinationIndex,
                    score: secondTransfer.score,
                  },
                },
                transferFrom: summarizeLocation(firstTransfer.transferStop),
                transferTo: summarizeLocation(secondTransfer.boardStop),
              });
            }
          }
        }
      }
    }
  }

  return Array.from(bestCandidates.values()).sort((a, b) => {
    if (a.transferDistanceMeters !== b.transferDistanceMeters) {
      return a.transferDistanceMeters - b.transferDistanceMeters;
    }
    return a.score - b.score;
  });
}

async function searchRoutesFromCurrentLocation(originCoords, destinationQuery) {
  const destinationLocations = await findMatchingLocations(destinationQuery);
  if (!destinationLocations.length) {
    return [];
  }

  const destinationIds = destinationLocations.map((location) => location._id);
  const destinationIdSet = new Set(destinationIds.map(String));

  const routes = await populateRouteGraph(
    Route.find({
      isActive: true,
      "stops.location": { $in: destinationIds },
    }),
  );

  const bestByRoute = new Map();

  for (const route of routes) {
    for (const selectedDirection of getRouteDirections(route)) {
      const stops = getRouteStops(route, selectedDirection);
      const match = selectNearestBoardingSegment(
        stops,
        destinationIdSet,
        originCoords,
      );

      if (!match) continue;

      const candidate = {
        route,
        selectedDirection,
        match,
        distanceMeters: match.boardDistanceMeters,
        score: match.score,
      };
      const routeKey = String(route._id);
      const existing = bestByRoute.get(routeKey);
      if (!existing || candidate.score < existing.score) {
        bestByRoute.set(routeKey, candidate);
      }
    }
  }

  return Array.from(bestByRoute.values()).sort((a, b) => a.score - b.score);
}

function buildLeg(routeDoc, selectedDirection, match, accuracyStats) {
  const route = toPublicRoute(routeDoc, { selectedDirection });
  const boardAt = route.mapPoints?.[match?.originIndex ?? 0] || route.origin;
  const alightAt =
    route.mapPoints?.[match?.destinationIndex ?? route.mapPoints.length - 1] ||
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

async function formatDirectResult(match, originCoords = null) {
  const accuracyStats = await Route.getAccuracyStats(match.route.routeId);
  const leg = buildLeg(
    match.route,
    match.selectedDirection,
    match.match || null,
    accuracyStats,
  );
  const route = { ...leg.route };

  if (originCoords) {
    route.distanceMeters = match.distanceMeters;
  }

  return {
    itineraryType: "direct",
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

async function formatTransferResult(candidate) {
  const [firstAccuracyStats, secondAccuracyStats] = await Promise.all([
    Route.getAccuracyStats(candidate.firstLeg.route.routeId),
    Route.getAccuracyStats(candidate.secondLeg.route.routeId),
  ]);

  const firstLeg = buildLeg(
    candidate.firstLeg.route,
    candidate.firstLeg.selectedDirection,
    candidate.firstLeg.match,
    firstAccuracyStats,
  );
  const secondLeg = buildLeg(
    candidate.secondLeg.route,
    candidate.secondLeg.selectedDirection,
    candidate.secondLeg.match,
    secondAccuracyStats,
  );

  return {
    itineraryType: "transfer",
    itineraryId: [
      firstLeg.route.routeId,
      candidate.transferFrom?._id || "walk-from",
      candidate.transferTo?._id || "walk-to",
      secondLeg.route.routeId,
    ].join("__"),
    transferCount: 1,
    transferPlace: candidate.transferDistanceMeters === 0
      ? candidate.transferFrom
      : candidate.transferTo,
    transferWalk: {
      from: candidate.transferFrom,
      to: candidate.transferTo,
      distanceMeters: candidate.transferDistanceMeters,
    },
    totalFare: mergeFareRanges(firstLeg.route.fare, secondLeg.route.fare),
    legs: [firstLeg, secondLeg],
  };
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

  if (useLocationSearch) {
    if (!normalizedDestination) {
      throw { statusCode: 400, message: "يرجى إدخال الوجهة" };
    }
    itineraryMatches = await searchRoutesFromCurrentLocation(
      originCoords,
      normalizedDestination,
    );
  } else {
    if (!normalizedOrigin || !normalizedDestination) {
      throw { statusCode: 400, message: "يرجى إدخال نقطة البداية والوجهة" };
    }

    itineraryMatches = await searchDirectRoutes(
      normalizedOrigin,
      normalizedDestination,
    );

    if (!itineraryMatches.length) {
      itineraryMatches = await searchTransferRoutes(
        normalizedOrigin,
        normalizedDestination,
      );
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
      if (match.itineraryType === "transfer") {
        return formatTransferResult(match);
      }
      return formatDirectResult(match, useLocationSearch ? originCoords : null);
    }),
  );

  return results.slice(0, 5);
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
  const locations = await Location.find(
    { isSearchable: true },
    { nameAr: 1 },
  )
    .sort({ nameAr: 1 })
    .lean();

  return locations.map((location) => location.nameAr);
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

async function clearSavedRoutes(userId) {
  await User.findByIdAndUpdate(
    userId,
    { $set: { savedRoutes: [] } },
    { new: true },
  );
  return { message: "تم حذف كل الخطوط المحفوظة ✓" };
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

  return routesWithStats.filter(Boolean);
}

module.exports = {
  searchRoutes,
  findNearestRoutes,
  getStations,
  getRouteById,
  saveRoute,
  unsaveRoute,
  clearSavedRoutes,
  getHistory,
  getSavedRoutes,
};
