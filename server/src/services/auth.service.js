const jwt = require('jsonwebtoken')
const { User } = require('../models/index.js')

/**
 * generateTokens — creates a short-lived access token and a long-lived
 * refresh token for the given user.
 */
function generateTokens(userId, role) {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  )

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  )

  return { accessToken, refreshToken }
}

/**
 * register — creates a new user and returns tokens.
 * Throws 409 if email is already taken.
 */
async function register(name, email, password) {
  const existing = await User.findByEmail(email)
  if (existing) {
    throw { statusCode: 409, message: 'هذا البريد الإلكتروني مسجل بالفعل' }
  }

  // passwordHash field triggers the pre-save bcrypt hook in the User model
  const user = await User.create({ name, email, passwordHash: password })

  const tokens = generateTokens(user._id, user.role)
  user.refreshToken = tokens.refreshToken
  await user.save()

  return {
    user: { _id: user._id, name: user.name, email: user.email, role: user.role },
    ...tokens,
  }
}

/**
 * login — validates credentials and returns tokens.
 * Returns the same generic 401 for both cases to prevent user-enumeration.
 */
async function login(email, password) {
  const user = await User.findByEmail(email)
  if (!user) {
    throw { statusCode: 401, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }
  }

  const valid = await user.comparePassword(password)
  if (!valid) {
    throw { statusCode: 401, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }
  }

  const tokens = generateTokens(user._id, user.role)
  user.refreshToken = tokens.refreshToken
  await user.save()

  return {
    user: { _id: user._id, name: user.name, email: user.email, role: user.role },
    ...tokens,
  }
}

/**
 * refreshTokens — validates a refresh token and rotates both tokens.
 * Single-use rotation prevents replay attacks.
 */
async function refreshTokens(token) {
  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET)
  } catch {
    throw { statusCode: 401, message: 'توكن التحديث غير صالح' }
  }

  const user = await User.findById(decoded.userId)
  if (!user || user.refreshToken !== token) {
    throw { statusCode: 401, message: 'توكن التحديث غير صالح' }
  }

  const tokens = generateTokens(user._id, user.role)
  user.refreshToken = tokens.refreshToken
  await user.save()

  return tokens
}

/**
 * logout — nullifies the stored refresh token, invalidating the session.
 */
async function logout(userId) {
  await User.findByIdAndUpdate(userId, { refreshToken: null })
}

/**
 * getMe — returns the authenticated user's profile, excluding sensitive fields.
 */
async function getMe(userId) {
  return User.findById(userId).select('-passwordHash -refreshToken')
}

module.exports = { generateTokens, register, login, refreshTokens, logout, getMe }
