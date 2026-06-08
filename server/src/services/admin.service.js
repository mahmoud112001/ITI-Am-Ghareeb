const { Route, User, Rating, SearchHistory } = require('../models/index.js')

/**
 * getAllRoutes — paginated list of all routes (active and inactive) with
 * accuracy stats attached to each.
 */
async function getAllRoutes(page = 1, limit = 10) {
  const pageNum = parseInt(page, 10) || 1
  const limitNum = parseInt(limit, 10) || 10
  const skip = (pageNum - 1) * limitNum

  const [routes, total] = await Promise.all([
    Route.find().skip(skip).limit(limitNum).sort({ createdAt: -1 }),
    Route.countDocuments(),
  ])

  const routesWithStats = await Promise.all(
    routes.map(async (route) => {
      try {
        const accuracyStats = await Route.getAccuracyStats(route.routeId)
        return { route, accuracyStats }
      } catch {
        return { route, accuracyStats: null }
      }
    })
  )

  return {
    routes: routesWithStats,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
  }
}

/**
 * createRoute — inserts a new route document after checking for routeId uniqueness.
 * Throws 409 if a route with the same routeId already exists.
 */
async function createRoute(data) {
  const existing = await Route.findOne({ routeId: data.routeId })
  if (existing) {
    throw { statusCode: 409, message: 'رقم الخط مستخدم بالفعل' }
  }

  const route = await Route.create(data)
  return route
}

/**
 * updateRoute — updates a route by its MongoDB _id.
 * Throws 404 if not found.
 */
async function updateRoute(id, data) {
  const route = await Route.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  })
  if (!route) {
    throw { statusCode: 404, message: 'الخط غير موجود' }
  }
  return route
}

/**
 * softDeleteRoute — sets isActive=false instead of permanently deleting.
 * Throws 404 if not found.
 */
async function softDeleteRoute(id) {
  const route = await Route.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true }
  )
  if (!route) {
    throw { statusCode: 404, message: 'الخط غير موجود' }
  }
  return { message: 'تم حذف الخط ✓' }
}

/**
 * getStats — aggregates dashboard statistics.
 * topSearched returns { origin, destination, count } — NOT nameAr.
 */
async function getStats() {
  const [totalRoutes, totalUsers, totalRatings, topSearched] = await Promise.all([
    Route.countDocuments({ isActive: true }),
    User.countDocuments({ role: 'user' }),
    Rating.countDocuments(),
    SearchHistory.aggregate([
      {
        $group: {
          _id: { origin: '$originQuery', destination: '$destinationQuery' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          origin: '$_id.origin',
          destination: '$_id.destination',
          count: 1,
        },
      },
    ]),
  ])

  return { totalRoutes, totalUsers, totalRatings, topSearched }
}

module.exports = { getAllRoutes, createRoute, updateRoute, softDeleteRoute, getStats }
