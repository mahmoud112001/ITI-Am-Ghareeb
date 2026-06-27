const { TravelPlanRating, Rating, Route } = require('../models/index.js')

async function submitRating(userId, routeId, isAccurate, comment = null) {
  const route = await Route.findOne({ routeId })
  if (!route) {
    throw { statusCode: 404, message: 'الخط غير موجود' }
  }

  const rating = await Rating.findOneAndUpdate(
    { user: userId, route: route._id },
    { isAccurate, comment, user: userId, route: route._id },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  // Auto-suspend check
  const total = await Rating.countDocuments({ route: route._id })
  if (total >= 3) {
    const accurate = await Rating.countDocuments({ route: route._id, isAccurate: true })
    const inaccurate = total - accurate
    if (inaccurate >= 2 * accurate) {
      await Route.findByIdAndUpdate(route._id, { isActive: false })
    }
  }

  return { message: 'تم إرسال تقييمك ✓', rating }
}

async function submitTravelPlanRating(userId, travelPlanId, routeIds, transferCount, isAccurate, comment = null) {
  const normalizedRouteIds = Array.from(
    new Set(
      (Array.isArray(routeIds) ? routeIds : [])
        .map((id) => String(id || '').trim())
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
    { travelPlanId, routeIds: normalizedRouteIds, transferCount, isAccurate, comment, user: userId },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  return { message: 'تم إرسال تقييم الرحلة ✓', rating }
}

async function getRatingStats(routeId) {
  return Route.getAccuracyStats(routeId)
}

module.exports = { submitRating, submitTravelPlanRating, getRatingStats }