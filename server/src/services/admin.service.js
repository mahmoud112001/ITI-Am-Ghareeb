const {
  Route,
  User,
  Rating,
  SearchHistory,
} = require("../models/index.js");
const {
  extractRouteFields,
  populateRouteGraph,
  syncRouteLocations,
  toAdminRoute,
} = require("../utils/routeNetwork.js");
const osrmService = require("./osrm.service");

function normalizeWaypoint(waypoint) {
  const lat = Number(waypoint?.lat);
  const lng = Number(waypoint?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function normalizeWaypoints(waypoints = []) {
  if (!Array.isArray(waypoints)) return [];
  return waypoints.map(normalizeWaypoint).filter(Boolean);
}

function geometrySignature(geometry) {
  return (geometry?.coordinates || [])
    .map((point) => {
      if (!Array.isArray(point) || point.length !== 2) return null;
      return point.map((value) => Number(value).toFixed(6)).join(",");
    })
    .filter(Boolean)
    .join("|");
}

async function getAllRoutes(page = 1, limit = 10) {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const skip = (pageNum - 1) * limitNum;

  const [routes, total] = await Promise.all([
    populateRouteGraph(
      Route.find().skip(skip).limit(limitNum).sort({ createdAt: -1 }),
    ),
    Route.countDocuments(),
  ]);

  const routesWithStats = await Promise.all(
    routes.map(async (route) => {
      try {
        const accuracyStats = await Route.getAccuracyStats(route.routeId);
        return {
          route: toAdminRoute(route),
          accuracyStats,
        };
      } catch {
        return {
          route: toAdminRoute(route),
          accuracyStats: null,
        };
      }
    }),
  );

  return {
    routes: routesWithStats,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
  };
}

async function createRoute(data) {
  const existing = await Route.findOne({ routeId: data.routeId });
  if (existing) {
    throw { statusCode: 409, message: "رقم الخط مستخدم بالفعل" };
  }

  const route = new Route(extractRouteFields(data));
  await syncRouteLocations(route, data);
  return populateRouteGraph(Route.findById(route._id));
}

async function updateRoute(id, data) {
  const route = await Route.findById(id);
  if (!route) {
    throw { statusCode: 404, message: "الخط غير موجود" };
  }

  if (data.routeId && data.routeId !== route.routeId) {
    const existing = await Route.findOne({
      routeId: data.routeId,
      _id: { $ne: route._id },
    });

    if (existing) {
      throw { statusCode: 409, message: "رقم الخط مستخدم بالفعل" };
    }
  }

  const hadGeneratedPath = Array.isArray(route.path) && route.path.length > 1;
  const existingGeometrySignature = geometrySignature(route.geometry);

  Object.assign(
    route,
    extractRouteFields({
      ...route.toObject(),
      ...data,
    }),
  );

  const nextGeometrySignature = geometrySignature(route.geometry);
  const routeShapeChanged = existingGeometrySignature !== nextGeometrySignature;

  if (hadGeneratedPath && routeShapeChanged) {
    route.pathStale = true;
  }

  if (data.stops || data.geometry) {
    await syncRouteLocations(route, {
      ...route.toObject(),
      ...data,
    });
    if (hadGeneratedPath && routeShapeChanged) {
      route.pathStale = true;
      await route.save();
    }
  } else {
    await route.save();
  }

  return populateRouteGraph(Route.findById(route._id));
}

async function softDeleteRoute(id) {
  const route = await Route.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true },
  );

  if (!route) {
    throw { statusCode: 404, message: "الخط غير موجود" };
  }

  return { message: "تم حذف الخط ✓" };
}

async function restoreRoute(id) {
  const route = await Route.findByIdAndUpdate(
    id,
    { isActive: true },
    { new: true },
  );

  if (!route) {
    throw { statusCode: 404, message: "الخط غير موجود" };
  }

  return { message: "تم استعادة الخط ✓" };
}

async function getStats() {
  const [totalRoutes, totalUsers, totalRatings, topSearched] = await Promise.all([
    Route.countDocuments({ isActive: true }),
    User.countDocuments({ role: "user" }),
    Rating.countDocuments(),
    SearchHistory.aggregate([
      {
        $group: {
          _id: { origin: "$originQuery", destination: "$destinationQuery" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          origin: "$_id.origin",
          destination: "$_id.destination",
          count: 1,
        },
      },
    ]),
  ]);

  return { totalRoutes, totalUsers, totalRatings, topSearched };
}

async function generateRoutePath(id, waypoints) {
  const route = await populateRouteGraph(Route.findById(id));
  if (!route) {
    throw { statusCode: 404, message: "Route not found" };
  }

  const cleanWaypoints = Array.isArray(waypoints)
    ? normalizeWaypoints(waypoints)
    : normalizeWaypoints(route.waypoints);

  if (Array.isArray(waypoints)) {
    route.waypoints = cleanWaypoints;
  }

  let coords = osrmService.buildRoutingCoords({
    ...route.toObject(),
    waypoints: cleanWaypoints,
  });

  if (coords.length < 2 && cleanWaypoints.length >= 2) {
    coords = cleanWaypoints;
  }

  if (coords.length < 2) {
    throw {
      statusCode: 400,
      message: `OSRM needs at least two valid points. Received ${cleanWaypoints.length} valid waypoint(s). Save route geometry or add at least two OSRM points.`,
    };
  }

  const generatedPath = await osrmService.generatePath(coords);
  route.path = generatedPath;
  route.pathGeneratedAt = new Date();
  route.pathStale = false;
  await route.save();

  return {
    pointCount: generatedPath.length,
    path: route.path,
    pathGeneratedAt: route.pathGeneratedAt,
    pathStale: route.pathStale,
    waypoints: route.waypoints,
  };
}

async function clearRoutePath(id) {
  const route = await Route.findByIdAndUpdate(
    id,
    { path: [], pathGeneratedAt: null, pathStale: false, waypoints: [] },
    { new: true },
  );

  if (!route) {
    throw { statusCode: 404, message: "Route not found" };
  }

  return { message: "Generated path cleared" };
}

module.exports = {
  getAllRoutes,
  createRoute,
  updateRoute,
  softDeleteRoute,
  restoreRoute,
  getStats,
  generateRoutePath,
  clearRoutePath,
};
