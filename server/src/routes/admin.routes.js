const express = require('express')
const Joi = require('joi')
const adminService = require('../services/admin.service')
const { protect, requireAdmin } = require('../middleware/auth.middleware')
const validate = require('../middleware/validate.middleware')

// ── Validation schema ─────────────────────────────────────────────────────────

const routeSchema = Joi.object({
  routeId: Joi.string().required(),
  type: Joi.string().valid('microbus', 'bus', 'tram', 'university_shuttle').required(),
  localName: Joi.string().optional(),
  nameAr: Joi.string().required(),
  nameEn: Joi.string().required(),
  origin: Joi.object({
    nameAr: Joi.string().required(),
    nameEn: Joi.string().required(),
    coords: Joi.object({
      lat: Joi.number().default(0),
      lng: Joi.number().default(0),
    }).optional(),
  }).required(),
  destination: Joi.object({
    nameAr: Joi.string().required(),
    nameEn: Joi.string().required(),
    coords: Joi.object({
      lat: Joi.number().default(0),
      lng: Joi.number().default(0),
    }).optional(),
  }).required(),
  stations: Joi.array()
    .items(
      Joi.object({
        order: Joi.number().required(),
        nameAr: Joi.string().required(),
        nameEn: Joi.string().required(),
        coords: Joi.object({
          lat: Joi.number().default(0),
          lng: Joi.number().default(0),
        }).optional(),
      })
    )
    .min(2)
    .required(),
  fare: Joi.object({
    min: Joi.number().required(),
    max: Joi.number().required(),
    currency: Joi.string().default('EGP'),
    lastVerified: Joi.string().optional(),
  }).required(),
  operatingHours: Joi.object({
    start: Joi.string().optional(),
    end: Joi.string().optional(),
  }).optional(),
  peakHours: Joi.array().items(Joi.string()).optional(),
  frequency: Joi.string().optional(),
  direction: Joi.string().valid('bidirectional', 'one_way').optional(),
  tips: Joi.array().items(Joi.string()).optional(),
  verified: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
})

// ── Controller handlers ───────────────────────────────────────────────────────

const listRoutes = async (req, res, next) => {
  try {
    const result = await adminService.getAllRoutes(req.query.page, req.query.limit)
    res.status(200).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

const createRoute = async (req, res, next) => {
  try {
    const route = await adminService.createRoute(req.body)
    res.status(201).json({ success: true, route })
  } catch (err) {
    next(err)
  }
}

const updateRoute = async (req, res, next) => {
  try {
    const route = await adminService.updateRoute(req.params.id, req.body)
    res.status(200).json({ success: true, route })
  } catch (err) {
    next(err)
  }
}

const deleteRoute = async (req, res, next) => {
  try {
    const result = await adminService.softDeleteRoute(req.params.id)
    res.status(200).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

const getStats = async (req, res, next) => {
  try {
    const stats = await adminService.getStats()
    res.status(200).json({ success: true, stats })
  } catch (err) {
    next(err)
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

const router = express.Router()

// All admin routes require authentication AND admin role
router.use(protect, requireAdmin)

// ⚠️ /stats MUST be before /:id to avoid being matched as an id param
router.get('/stats', getStats)
router.get('/', listRoutes)
router.post('/', validate(routeSchema), createRoute)
router.put('/:id', updateRoute)
router.delete('/:id', deleteRoute)

module.exports = router
