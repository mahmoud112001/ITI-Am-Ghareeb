const authService = require('../services/auth.service')

/**
 * register — POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body
    const result = await authService.register(name, email, password)
    res.status(201).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

/**
 * login — POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    const result = await authService.login(email, password)
    res.status(200).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

/**
 * refresh — POST /api/auth/refresh
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    const tokens = await authService.refreshTokens(refreshToken)
    res.status(200).json({ success: true, ...tokens })
  } catch (err) {
    next(err)
  }
}

const verifyEmail = async (req, res, next) => {
  try {
    const result = await authService.verifyEmail(req.user.userId, req.body.otp)
    res.status(200).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

const resendVerificationOtp = async (req, res, next) => {
  try {
    const result = await authService.resendVerificationOtp(req.user.userId)
    res.status(200).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

const changePassword = async (req, res, next) => {
  try {
    const result = await authService.changePassword(
      req.user.userId,
      req.body.currentPassword,
      req.body.newPassword,
    )
    res.status(200).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

const getMyRatings = async (req, res, next) => {
  try {
    const ratings = await authService.getUserRatings(req.user.userId, req.query.limit)
    res.status(200).json({ success: true, ratings })
  } catch (err) {
    next(err)
  }
}

/**
 * logout — POST /api/auth/logout (protected)
 */
const logout = async (req, res, next) => {
  try {
    await authService.logout(req.user.userId)
    res.status(200).json({ success: true, message: 'تم تسجيل الخروج' })
  } catch (err) {
    next(err)
  }
}

/**
 * getMe — GET /api/auth/me (protected)
 */
const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.userId)
    res.status(200).json({ success: true, user })
  } catch (err) {
    next(err)
  }
}

/**
 * googleCallback — GET /api/auth/google/callback
 * Generates tokens and redirects to the frontend dashboard.
 */
const googleCallback = async (req, res, next) => {
  try {
    const { _id, role } = req.user
    const { accessToken } = authService.generateTokens(_id, role)
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
    res.redirect(`${clientUrl}/dashboard?token=${accessToken}`)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  register,
  login,
  refresh,
  verifyEmail,
  resendVerificationOtp,
  changePassword,
  getMyRatings,
  logout,
  getMe,
  googleCallback,
}
