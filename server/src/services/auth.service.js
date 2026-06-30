const jwt = require('jsonwebtoken')
const { User, Rating, TravelPlanRating } = require('../models/index.js')

function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
  }
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function issueEmailOtp(user) {
  const otp = generateOtp()
  user.emailVerificationOtp = otp
  user.emailVerificationOtpExpires = new Date(Date.now() + 10 * 60 * 1000)
  await user.save()

  if (process.env.NODE_ENV !== 'test') {
    console.log(`Email verification OTP for ${user.email}: ${otp}`)
  }

  return otp
}

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
  await issueEmailOtp(user)

  const tokens = generateTokens(user._id, user.role)
  user.refreshToken = tokens.refreshToken
  await user.save()

  return {
    user: publicUser(user),
    verificationRequired: true,
    ...(process.env.NODE_ENV === 'test' ? { otp: user.emailVerificationOtp } : {}),
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
    user: publicUser(user),
    ...tokens,
  }
}

async function verifyEmail(userId, otp) {
  const user = await User.findById(userId)
  if (!user) throw { statusCode: 404, message: 'المستخدم غير موجود' }
  if (user.emailVerified) return { user: publicUser(user), message: 'تم تأكيد البريد بالفعل' }
  if (!user.emailVerificationOtp || user.emailVerificationOtp !== String(otp).trim()) {
    throw { statusCode: 400, message: 'كود التحقق غير صحيح' }
  }
  if (!user.emailVerificationOtpExpires || user.emailVerificationOtpExpires < new Date()) {
    throw { statusCode: 400, message: 'انتهت صلاحية كود التحقق' }
  }

  user.emailVerified = true
  user.emailVerificationOtp = null
  user.emailVerificationOtpExpires = null
  await user.save()

  return { user: publicUser(user), message: 'تم تأكيد البريد بنجاح' }
}

async function resendVerificationOtp(userId) {
  const user = await User.findById(userId)
  if (!user) throw { statusCode: 404, message: 'المستخدم غير موجود' }
  if (user.emailVerified) return { message: 'البريد مؤكد بالفعل' }
  const otp = await issueEmailOtp(user)
  return {
    message: 'تم إرسال كود تحقق جديد',
    ...(process.env.NODE_ENV === 'test' ? { otp } : {}),
  }
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId)
  if (!user) throw { statusCode: 404, message: 'المستخدم غير موجود' }
  if (!user.passwordHash) {
    throw { statusCode: 400, message: 'هذا الحساب يستخدم تسجيل دخول خارجي ولا يملك كلمة مرور محلية' }
  }

  const valid = await user.comparePassword(currentPassword)
  if (!valid) throw { statusCode: 401, message: 'كلمة المرور الحالية غير صحيحة' }

  user.passwordHash = newPassword
  await user.save()
  return { message: 'تم تغيير كلمة المرور بنجاح' }
}

async function getUserRatings(userId, limit = 10) {
  const max = Math.min(parseInt(limit, 10) || 10, 50)
  const [routeRatings, travelPlanRatings] = await Promise.all([
    Rating.find({ user: userId })
      .populate('route', 'routeId nameAr nameEn localName type')
      .sort({ createdAt: -1 })
      .limit(max),
    TravelPlanRating.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(max),
  ])

  return [...routeRatings.map((rating) => ({
    _id: rating._id,
    type: 'route',
    isAccurate: rating.isAccurate,
    comment: rating.comment,
    createdAt: rating.createdAt,
    route: rating.route,
  })), ...travelPlanRatings.map((rating) => ({
    _id: rating._id,
    type: 'travelPlan',
    isAccurate: rating.isAccurate,
    comment: rating.comment,
    createdAt: rating.createdAt,
    travelPlanId: rating.travelPlanId,
    routeIds: rating.routeIds,
    transferCount: rating.transferCount,
  }))].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, max)
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
  return User.findById(userId).select('-passwordHash -refreshToken -emailVerificationOtp -emailVerificationOtpExpires')
}

module.exports = {
  generateTokens,
  register,
  login,
  verifyEmail,
  resendVerificationOtp,
  changePassword,
  getUserRatings,
  refreshTokens,
  logout,
  getMe,
}
