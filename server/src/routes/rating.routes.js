const express = require('express')
const Joi = require('joi')
const ratingService = require('../services/rating.service')
const { protect } = require('../middleware/auth.middleware')
const validate = require('../middleware/validate.middleware')

// ── Validation schema ─────────────────────────────────────────────────────────

const ratingSchema = Joi.object({
  routeId: Joi.string().required(),
  isAccurate: Joi.boolean().required(),
  comment: Joi.string().max(280).optional().allow(null, ''),
})

const travelPlanRatingSchema = Joi.object({
  travelPlanId: Joi.string().required(),
  routeIds: Joi.array().items(Joi.string()).min(1).required(),
  transferCount: Joi.number().integer().min(1).required(),
  isAccurate: Joi.boolean().required(),
  comment: Joi.string().max(280).optional().allow(null, ''),
})

// ── Controller handlers ───────────────────────────────────────────────────────

const submitRating = async (req, res, next) => {
  try {
    const { routeId, isAccurate, comment } = req.body
    const result = await ratingService.submitRating(
      req.user.userId,
      routeId,
      isAccurate,
      comment
    )
    res.status(200).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

const submitTravelPlanRating = async (req, res, next) => {
  try {
    const { travelPlanId, routeIds, transferCount, isAccurate, comment } = req.body
    const result = await ratingService.submitTravelPlanRating(
      req.user.userId,
      travelPlanId,
      routeIds,
      transferCount,
      isAccurate,
      comment,
    )
    res.status(200).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

const getRatingStats = async (req, res, next) => {
  try {
    const stats = await ratingService.getRatingStats(req.params.routeId)
    res.status(200).json({ success: true, stats })
  } catch (err) {
    next(err)
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

const router = express.Router()

router.post('/', protect, validate(ratingSchema), submitRating)
router.post('/travel-plan', protect, validate(travelPlanRatingSchema), submitTravelPlanRating)
router.get('/:routeId/stats', getRatingStats)

module.exports = router
