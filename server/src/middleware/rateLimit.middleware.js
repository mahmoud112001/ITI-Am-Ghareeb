const rateLimit = require('express-rate-limit')

const isTestEnv = process.env.NODE_ENV === 'test'

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'محاولات كثيرة جداً — حاول بعد 15 دقيقة' },
})

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 10000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'محاولات كثيرة جداً — حاول بعد 15 دقيقة' },
})

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isTestEnv ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: { success: false, message: 'تجاوزت الحد المسموح — حاول بعد ساعة' },
})

const ratingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isTestEnv ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'لقد تجاوزت الحد المسموح به من التقييمات، حاول بعد ساعة' },
})

module.exports = { authLimiter, apiLimiter, aiLimiter, ratingLimiter }