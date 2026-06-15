const { TravelPlanRating, Rating, Route } = require('../models/index.js')

/**
 * submitRating — creates or updates a user's rating for a route.
 * Uses upsert so a user can change their vote without hitting the unique index.
 * Throws 404 if the route doesn't exist.
 */
async function submitRating(userId, routeId, isAccurate, comment = null) {
  const route = await Route.findOne({ routeId })
  if (!route) {
    throw { statusCode: 404, message: 'الخط غير موجود' }
  }

  const rating = await Rating.findOneAndUpdate(
    { user: userId, route: route._id },
    { isAccurate, comment, user: userId, route: route._id },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  return { message: 'تم إرسال تقييمك ✓', rating }
}

/**
 * submitTravelPlanRating — creates or updates a user's rating for a transfer travelPlan.
 * Stores journey-level feedback without affecting per-route accuracy stats.
 */
async function submitTravelPlanRating(
  userId,
  travelPlanId,
  routeIds,
  transferCount,
  isAccurate,
  comment = null,
) {
  const normalizedRouteIds = Array.from(
    new Set(
      (Array.isArray(routeIds) ? routeIds : [])
        .map((routeId) => String(routeId || '').trim())
        .filter(Boolean),
    ),
  )

  if (!travelPlanId || !normalizedRouteIds.length) {
    throw { statusCode: 400, message: 'بيانات الرحلة غير مكتملة' }
  }

  const existingRoutes = await Route.countDocuments({
    routeId: { $in: normalizedRouteIds },
    isActive: true,
  })

  if (existingRoutes !== normalizedRouteIds.length) {
    throw { statusCode: 404, message: 'بعض خطوط الرحلة غير موجودة' }
  }

  const rating = await TravelPlanRating.findOneAndUpdate(
    { user: userId, travelPlanId },
    {
      travelPlanId,
      routeIds: normalizedRouteIds,
      transferCount,
      isAccurate,
      comment,
      user: userId,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  return { message: 'تم إرسال تقييم الرحلة ✓', rating }
}

/**
 * getRatingStats — returns accuracy statistics for a given route.
 * Delegates to the Route static method which applies threshold rules and Arabic labels.
 */
async function getRatingStats(routeId) {
  return Route.getAccuracyStats(routeId)
}

module.exports = { submitRating, submitTravelPlanRating, getRatingStats }
