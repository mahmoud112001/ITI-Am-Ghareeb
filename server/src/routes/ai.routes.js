const express = require('express')
const { protect } = require('../middleware/auth.middleware')
const { aiLimiter } = require('../middleware/rateLimit.middleware')
const { streamTransitAdvice } = require('../services/ai.service')

const router = express.Router()

/**
 * POST /api/ai/ask
 * Protected + rate limited. Validates body BEFORE setting SSE headers
 * so validation failures return JSON 400 (not an SSE event).
 */
router.post('/ask', protect, aiLimiter, async (req, res, next) => {
  try {
    const { origin, destination, message } = req.body

    // All validation MUST happen before streamTransitAdvice is called,
    // because once SSE headers are flushed we can't send HTTP error codes.
    if (!origin) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال نقطة البداية' })
    }
    if (!destination) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال الوجهة' })
    }
    if (!message) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال رسالتك' })
    }
    if (message.length > 500) {
      return res.status(400).json({ success: false, message: 'الرسالة طويلة جداً — الحد الأقصى 500 حرف' })
    }

    await streamTransitAdvice(origin.trim(), destination.trim(), message.trim(), res)
  } catch (err) {
    next(err)
  }
})

module.exports = router
