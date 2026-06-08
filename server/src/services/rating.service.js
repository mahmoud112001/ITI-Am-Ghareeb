const { Rating, Route } = require('../models/index.js')

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
 * getRatingStats — returns accuracy statistics for a given route.
 * Delegates to the Route static method which applies threshold rules and Arabic labels.
 */
async function getRatingStats(routeId) {
  return Route.getAccuracyStats(routeId)
}

module.exports = { submitRating, getRatingStats }
