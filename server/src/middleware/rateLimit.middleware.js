const rateLimit = require('express-rate-limit')

/**
 * authLimiter — tight limit for login/register endpoints.
 * 10 requests per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'محاولات كثيرة جداً — حاول بعد 15 دقيقة',
  },
})

/**
 * apiLimiter — general limit for all API routes.
 * 100 requests per 15 minutes per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'محاولات كثيرة جداً — حاول بعد 15 دقيقة',
  },
})

/**
 * aiLimiter — strict limit for AI chat endpoint.
 * 20 requests per hour, keyed by userId (authenticated) or IP (fallback).
 */
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: {
    success: false,
    message: 'تجاوزت الحد المسموح — حاول بعد ساعة',
  },
})

module.exports = { authLimiter, apiLimiter, aiLimiter }
