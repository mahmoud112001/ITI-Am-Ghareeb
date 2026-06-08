const { Route, SearchHistory, User } = require('../models/index.js')

/**
 * searchRoutes — finds active routes where stations contain both the origin
 * and destination queries (Arabic or English name match).
 * Optionally saves a SearchHistory record when a userId is provided.
 */
async function searchRoutes(originQuery, destinationQuery, userId = null) {
  const originRegex = new RegExp(originQuery, 'i')
  const destRegex = new RegExp(destinationQuery, 'i')

  const routes = await Route.find({
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
  })

  if (userId) {
    await SearchHistory.create({
      user: userId,
      originQuery,
      destinationQuery,
      routesFound: routes.length,
    })
  }

  const routesWithStats = await Promise.all(
    routes.map(async (route) => {
      const accuracyStats = await Route.getAccuracyStats(route.routeId)
      return { route, accuracyStats }
    })
  )

  return routesWithStats
}

/**
 * getStations — returns a deduplicated, sorted list of all Arabic station names
 * across all active routes. Used to populate search autocomplete.
 */
async function getStations() {
  const result = await Route.aggregate([
    { $match: { isActive: true } },
    { $unwind: '$stations' },
    { $group: { _id: '$stations.nameAr' } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, name: '$_id' } },
  ])

  return result.map((r) => r.name)
}

/**
 * getRouteById — fetches a single active route by its routeId string,
 * along with its accuracy stats. Throws 404 if not found.
 */
async function getRouteById(routeId) {
  const route = await Route.findOne({ routeId, isActive: true })
  if (!route) {
    throw { statusCode: 404, message: 'الخط غير موجود' }
  }

  const accuracyStats = await Route.getAccuracyStats(routeId)
  return { route, accuracyStats }
}

/**
 * saveRoute — adds a route to the user's savedRoutes list (no duplicates).
 * Throws 404 if the route doesn't exist or has been soft-deleted.
 */
async function saveRoute(userId, routeId) {
  const route = await Route.findOne({ routeId, isActive: true })
  if (!route) {
    throw { statusCode: 404, message: 'الخط غير موجود' }
  }

  await User.findByIdAndUpdate(
    userId,
    { $addToSet: { savedRoutes: route._id } },
    { new: true }
  )

  return { message: 'تم حفظ الخط ✓' }
}

/**
 * unsaveRoute — removes a route from the user's savedRoutes list.
 * Throws 404 if the route doesn't exist or has been soft-deleted.
 */
async function unsaveRoute(userId, routeId) {
  const route = await Route.findOne({ routeId, isActive: true })
  if (!route) {
    throw { statusCode: 404, message: 'الخط غير موجود' }
  }

  await User.findByIdAndUpdate(
    userId,
    { $pull: { savedRoutes: route._id } },
    { new: true }
  )

  return { message: 'تم إزالة الخط ✓' }
}

/**
 * getHistory — returns the last 20 search history records for a user,
 * sorted by most recent first.
 */
async function getHistory(userId) {
  return SearchHistory.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean()
}

/**
 * getSavedRoutes — returns all routes saved by a user with accuracy stats
 * attached to each. Throws 404 if the user is not found.
 */
async function getSavedRoutes(userId) {
  const user = await User.findById(userId).populate('savedRoutes')
  if (!user) {
    throw { statusCode: 404, message: 'المستخدم غير موجود' }
  }

  const routesWithStats = await Promise.all(
    user.savedRoutes.map(async (route) => {
      const accuracyStats = await Route.getAccuracyStats(route.routeId)
      return { ...route.toObject(), accuracyStats }
    })
  )

  return routesWithStats
}

module.exports = {
  searchRoutes,
  getStations,
  getRouteById,
  saveRoute,
  unsaveRoute,
  getHistory,
  getSavedRoutes,
}
