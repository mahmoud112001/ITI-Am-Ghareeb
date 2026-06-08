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

// ── Routes ────────────────────────────────────────────────────────────────────

router.post('/register', authLimiter, validate(registerSchema), authController.register)
router.post('/login', authLimiter, validate(loginSchema), authController.login)
router.post('/refresh', authController.refresh)
router.post('/logout', protect, authController.logout)
router.get('/me', protect, authController.getMe)

// Google OAuth — start the flow
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

// Google OAuth — callback after user grants permission
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  authController.googleCallback
)

module.exports = router
