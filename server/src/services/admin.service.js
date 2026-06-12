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

  Object.assign(
    route,
    extractRouteFields({
      ...route.toObject(),
      ...data,
    }),
  );

  if (data.stops || data.geometry) {
    await syncRouteLocations(route, {
      ...route.toObject(),
      ...data,
    });
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

module.exports = {
  getAllRoutes,
  createRoute,
  updateRoute,
  softDeleteRoute,
  restoreRoute,
  getStats,
};
