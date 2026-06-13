const express = require("express");
const Joi = require("joi");
const adminService = require("../services/admin.service");
const { protect, requireAdmin } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");

const stopSchema = Joi.object({
  order: Joi.number().required(),
  nameAr: Joi.string().required(),
  nameEn: Joi.string().required(),
  coords: Joi.object({
    lat: Joi.number().default(0),
    lng: Joi.number().default(0),
  }).optional(),
  allowPickup: Joi.boolean().optional(),
  allowDropoff: Joi.boolean().optional(),
  district: Joi.string().optional().allow(null, ""),
  aliases: Joi.object({
    ar: Joi.array().items(Joi.string()).optional(),
    en: Joi.array().items(Joi.string()).optional(),
  }).optional(),
}).custom((value, helpers) => {
  if (value.allowPickup === false && value.allowDropoff === false) {
    return helpers.error("any.invalid");
  }
  return value;
}, "route stop directionality");

const geometrySchema = Joi.object({
  type: Joi.string().valid("LineString").default("LineString"),
  coordinates: Joi.array()
    .items(
      Joi.array()
        .ordered(Joi.number().required(), Joi.number().required())
        .length(2),
    )
    .min(2)
    .required(),
}).required();

const fareSchema = Joi.object({
  min: Joi.number().required(),
  max: Joi.number().required(),
  currency: Joi.string().default("EGP"),
  lastVerified: Joi.string().optional().allow(null, ""),
}).required();

const operatingHoursSchema = Joi.object({
  start: Joi.string().optional().allow(null, ""),
  end: Joi.string().optional().allow(null, ""),
})
  .optional()
  .allow(null);

const routeSchema = Joi.object({
  routeId: Joi.string().required(),
  type: Joi.string()
    .valid("microbus", "bus", "tram", "train", "university_shuttle")
    .required(),
  localName: Joi.string().optional(),
  nameAr: Joi.any().strip(),
  nameEn: Joi.any().strip(),
  fare: fareSchema,
  operatingHours: operatingHoursSchema,
  frequency: Joi.string().optional().allow(null, ""),
  peakHours: Joi.array().items(Joi.string()).optional(),
  tips: Joi.array().items(Joi.string()).optional(),
  isBidirectional: Joi.boolean().optional(),
  verified: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
  stops: Joi.array().items(stopSchema).min(2).required(),
  geometry: geometrySchema,
});

const routeUpdateSchema = Joi.object({
  routeId: Joi.string().optional(),
  type: Joi.string()
    .valid("microbus", "bus", "tram", "train", "university_shuttle")
    .optional(),
  localName: Joi.string().optional(),
  nameAr: Joi.any().strip(),
  nameEn: Joi.any().strip(),
  fare: fareSchema.optional(),
  operatingHours: operatingHoursSchema,
  frequency: Joi.string().optional().allow(null, ""),
  peakHours: Joi.array().items(Joi.string()).optional(),
  tips: Joi.array().items(Joi.string()).optional(),
  isBidirectional: Joi.boolean().optional(),
  verified: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
  stops: Joi.array().items(stopSchema).min(2).optional(),
  geometry: geometrySchema.optional(),
}).min(1);

const listRoutes = async (req, res, next) => {
  try {
    const result = await adminService.getAllRoutes(req.query.page, req.query.limit);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const createRoute = async (req, res, next) => {
  try {
    const route = await adminService.createRoute(req.body);
    res.status(201).json({ success: true, route });
  } catch (err) {
    next(err);
  }
};

const updateRoute = async (req, res, next) => {
  try {
    const route = await adminService.updateRoute(req.params.id, req.body);
    res.status(200).json({ success: true, route });
  } catch (err) {
    next(err);
  }
};

const deleteRoute = async (req, res, next) => {
  try {
    const result = await adminService.softDeleteRoute(req.params.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const restoreRoute = async (req, res, next) => {
  try {
    const result = await adminService.restoreRoute(req.params.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const router = express.Router();

router.use(protect, requireAdmin);
router.get("/", listRoutes);
router.post("/", validate(routeSchema), createRoute);
router.put("/:id", validate(routeUpdateSchema), updateRoute);
router.patch("/:id/restore", restoreRoute);
router.delete("/:id", deleteRoute);

module.exports = router;
