/**
 * Central error-handling middleware.
 * Must be registered LAST in app.js (after all routes).
 * All async route errors should call next(err).
 */

const errorMiddleware = (err, req, res, next) => {
  const timestamp = new Date().toISOString()
  const status =
    err.statusCode ||
    (err.name === 'ValidationError' ? 400 : null) ||
    (err.code === 11000 ? 409 : null) ||
    (err.name === 'JsonWebTokenError' ? 401 : null) ||
    (err.name === 'TokenExpiredError' ? 401 : null) ||
    500

  console.error(`[${timestamp}] ${req.method} ${req.path} ${status} — ${err.message}`)

  // ── Mongoose validation error ─────────────────────────────────────────────
  if (err.name === 'ValidationError' && err.errors) {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }))
    return res.status(400).json({ success: false, message: 'بيانات غير صحيحة', errors })
  }

  // ── MongoDB duplicate key ─────────────────────────────────────────────────
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'هذا البريد الإلكتروني مسجل بالفعل' })
  }

  // ── JWT errors ────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'جلسة غير صالحة' })
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'انتهت صلاحية الجلسة' })
  }

  // ── Joi validation error ──────────────────────────────────────────────────
  if (err.isJoi || err.details) {
    const errors = (err.details || []).map((d) => ({
      field: d.path.join('.'),
      message: d.message,
    }))
    return res.status(400).json({ success: false, message: 'بيانات غير صحيحة', errors })
  }

  // ── Custom statusCode (thrown from services/controllers) ─────────────────
  if (err.statusCode) {
    return res.status(err.statusCode).json({ success: false, message: err.message })
  }

  // ── Default 500 ───────────────────────────────────────────────────────────
  const response = { success: false, message: 'حدث خطأ في الخادم' }

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack
  }

  return res.status(500).json(response)
}

module.exports = errorMiddleware
