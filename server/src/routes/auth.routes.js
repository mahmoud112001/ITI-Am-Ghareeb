const express = require('express')
const passport = require('passport')
const Joi = require('joi')

const authController = require('../controllers/auth.controller')
const { authLimiter } = require('../middleware/rateLimit.middleware')
const validate = require('../middleware/validate.middleware')
const { protect } = require('../middleware/auth.middleware')

const router = express.Router()

// ── Validation schemas ────────────────────────────────────────────────────────

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.pattern.base': 'كلمة المرور يجب أن تحتوي على حرف كبير ورقم واحد على الأقل',
    }),
})

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
})

const verifyEmailSchema = Joi.object({
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
})

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.pattern.base': 'كلمة المرور يجب أن تحتوي على حرف كبير ورقم واحد على الأقل',
    }),
})

// ── Routes ────────────────────────────────────────────────────────────────────

router.post('/register', authLimiter, validate(registerSchema), authController.register)
router.post('/login', authLimiter, validate(loginSchema), authController.login)
router.post('/refresh', authController.refresh)
router.post('/verify-email', protect, validate(verifyEmailSchema), authController.verifyEmail)
router.post('/resend-verification', protect, authLimiter, authController.resendVerificationOtp)
router.patch('/password', protect, validate(changePasswordSchema), authController.changePassword)
router.post('/logout', protect, authController.logout)
router.get('/me', protect, authController.getMe)
router.get('/me/ratings', protect, authController.getMyRatings)

// ── Google OAuth ──────────────────────────────────────────────────────────────

const isGoogleConfigured =
  !!process.env.GOOGLE_CLIENT_ID &&
  !!process.env.GOOGLE_CLIENT_SECRET &&
  !!process.env.GOOGLE_CALLBACK_URL

const googleUnavailable = (_req, res) =>
  res.status(503).json({ success: false, message: 'Google login is not configured on this server.' })

// Google OAuth — start the flow
router.get(
  '/google',
  isGoogleConfigured
    ? passport.authenticate('google', { scope: ['profile', 'email'] })
    : googleUnavailable
)

// Google OAuth — callback after user grants permission
router.get(
  '/google/callback',
  isGoogleConfigured
    ? passport.authenticate('google', { session: false, failureRedirect: '/login' })
    : googleUnavailable,
  authController.googleCallback
)

module.exports = router
