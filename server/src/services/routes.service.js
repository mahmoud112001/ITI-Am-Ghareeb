const { Route, SearchHistory, User } = require("../models/index.js");

/**
 * Helper functions for distance calculation using Haversine formula
 */
function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(pointA, pointB) {
  const R = 6371000; // Earth radius in meters
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

function getNearestStationDistance(route, userLocation) {
  const stations = route.stations || [];
  let minDistance = Number.POSITIVE_INFINITY;
  for (const station of stations) {
    if (station.coords?.lat == null || station.coords?.lng == null) continue;
    const dist = distanceMeters(userLocation, station.coords);
    if (dist < minDistance) minDistance = dist;
  }
  return Number.isFinite(minDistance) ? minDistance : null;
}

/**
 * searchRoutes — finds active routes where stations contain both the origin
 * and destination queries (Arabic or English name match).
 * Optionally saves a SearchHistory record when a userId is provided.
 */
async function searchRoutes(
  originQuery,
  destinationQuery,
  userId = null,
  originCoords = null,
) {
  function normalizeQuery(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  originQuery = normalizeQuery(originQuery);
  destinationQuery = normalizeQuery(destinationQuery);
  const useLocationSearch =
    originCoords && originCoords.lat != null && originCoords.lng != null;

  const originRegex = new RegExp(originQuery, "i");
  const destRegex = new RegExp(destinationQuery, "i");

  let routes;
  if (useLocationSearch) {
    const query = { isActive: true };
    if (destinationQuery) {
      query.$and = [
        {
          stations: {
            $elemMatch: {
              $or: [{ nameAr: destRegex }, { nameEn: destRegex }],
            },
          },
        },
      ];
    }
    routes = await Route.find(query);
  } else {
    if (!originQuery || !destinationQuery) {
      throw { statusCode: 400, message: "يرجى إدخال نقطة البداية والوجهة" };
    }

    routes = await Route.find({
      isActive: true,
      $and: [
        {
          stations: {
            $elemMatch: {
              $or: [{ nameAr: originRegex }, { nameEn: originRegex }],
            },
          },
        },
        {
          stations: {
            $elemMatch: {
              $or: [{ nameAr: destRegex }, { nameEn: destRegex }],
            },
          },
        },
      ],
    });
  }

  if (userId) {
    await SearchHistory.create({
      user: userId,
      originQuery: useLocationSearch
        ? originQuery || "موقعي الحالي"
        : originQuery,
      destinationQuery,
      routesFound: routes.length,
    });
  }

  const routesWithStats = await Promise.all(
    routes.map(async (route) => {
      const accuracyStats = await Route.getAccuracyStats(route.routeId);
      const routeObj = route.toObject();
      if (useLocationSearch) {
        routeObj.distanceMeters = getNearestStationDistance(
          routeObj,
          originCoords,
        );
      }
      return { route: routeObj, accuracyStats };
    }),
  );

  if (useLocationSearch) {
    routesWithStats.sort((a, b) => {
      const da = a.route.distanceMeters ?? Number.POSITIVE_INFINITY;
      const db = b.route.distanceMeters ?? Number.POSITIVE_INFINITY;
      return da - db;
    });
    return routesWithStats.slice(0, 5);
  }

  return routesWithStats;
}

/**
 * findNearestRoutes — finds the 5 nearest routes from user's current location.
 * No destination query required — searches all routes and sorts by distance to nearest station.
 * Optionally saves a SearchHistory record when a userId is provided.
 */
async function findNearestRoutes(userCoords, userId = null) {
  if (!userCoords || userCoords.lat == null || userCoords.lng == null) {
    throw { statusCode: 400, message: "إحداثيات الموقع غير صحيحة" };
  }

  // Find all active routes
  const routes = await Route.find({ isActive: true });

  // Calculate distance to nearest station for each route
  const routesWithDistance = routes.map((route) => {
    const distanceMeters_val = getNearestStationDistance(route, userCoords);
    return {
      route,
      distanceMeters: distanceMeters_val,
    };
  });

  // Filter out routes with no valid stations and sort by distance
  const validRoutes = routesWithDistance
    .filter((r) => r.distanceMeters !== null)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 5); // Get top 5 nearest

  // Attach accuracy stats to each route
  const routesWithStats = await Promise.all(
    validRoutes.map(async (item) => {
      const accuracyStats = await Route.getAccuracyStats(item.route.routeId);
      return {
        route: item.route.toObject(),
        accuracyStats,
        distanceMeters: item.distanceMeters,
      };
    }),
  );

  // Save search history
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

/**
 * getStations — returns a deduplicated, sorted list of all Arabic station names
 * across all active routes. Used to populate search autocomplete.
 */
async function getStations() {
  const result = await Route.aggregate([
    { $match: { isActive: true } },
    { $unwind: "$stations" },
    { $group: { _id: "$stations.nameAr" } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, name: "$_id" } },
  ]);

  return result.map((r) => r.name);
}

/**
 * getRouteById — fetches a single active route by its routeId string,
 * along with its accuracy stats. Throws 404 if not found.
 */
async function getRouteById(routeId) {
  const route = await Route.findOne({ routeId, isActive: true });
  if (!route) {
    throw { statusCode: 404, message: "الخط غير موجود" };
  }

  const accuracyStats = await Route.getAccuracyStats(routeId);
  return { route, accuracyStats };
}

/**
 * saveRoute — adds a route to the user's savedRoutes list (no duplicates).
 * Throws 404 if the route doesn't exist or has been soft-deleted.
 */
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

/**
 * unsaveRoute — removes a route from the user's savedRoutes list.
 * Throws 404 if the route doesn't exist or has been soft-deleted.
 */
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

/**
 * getHistory — returns the last 20 search history records for a user,
 * sorted by most recent first.
 */
async function getHistory(userId) {
  return SearchHistory.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
}

/**
 * getSavedRoutes — returns all routes saved by a user with accuracy stats
 * attached to each. Throws 404 if the user is not found.
 */
async function getSavedRoutes(userId) {
  const user = await User.findById(userId).populate("savedRoutes");
  if (!user) {
    throw { statusCode: 404, message: "المستخدم غير موجود" };
  }

  const routesWithStats = await Promise.all(
    user.savedRoutes.map(async (route) => {
      const accuracyStats = await Route.getAccuracyStats(route.routeId);
      return { ...route.toObject(), accuracyStats };
    }),
  );

  return routesWithStats;
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
