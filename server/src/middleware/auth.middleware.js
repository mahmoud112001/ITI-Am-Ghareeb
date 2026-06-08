const jwt = require('jsonwebtoken')

/**
 * protect — verifies Bearer token and attaches req.user.
 * JWT errors (JsonWebTokenError, TokenExpiredError) propagate to errorMiddleware.
 */
const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    return next({ statusCode: 401, message: 'لا يوجد توكن' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = { userId: decoded.userId, role: decoded.role }
    next()
  } catch (err) {
    // JsonWebTokenError / TokenExpiredError — handled by error middleware
    next(err)
  }
}

/**
 * requireAdmin — must be chained AFTER protect, or used standalone
 * (it calls protect internally if req.user is not yet set).
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return protect(req, res, (err) => {
      if (err) return next(err)
      checkAdmin(req, res, next)
    })
  }
  checkAdmin(req, res, next)
}

function checkAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return next({ statusCode: 403, message: 'غير مصرح لك بهذه العملية' })
  }
  next()
}

module.exports = { protect, requireAdmin }
