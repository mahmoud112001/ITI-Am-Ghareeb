const { Strategy: GoogleStrategy } = require('passport-google-oauth20')
const { User } = require('../models/index.js')

/**
 * configurePassport(passport) — registers the Google OAuth strategy.
 * Call this once in app.js before mounting routes.
 * If Google credentials are absent, skips registration and logs a warning.
 */
module.exports = (passport) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } = process.env

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_CALLBACK_URL) {
    console.warn('[passport] Google OAuth credentials missing — Google login disabled.')
    return
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID:     GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL:  GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id
          const email    = profile.emails?.[0]?.value
          const name     = profile.displayName

          // 1. Try to find by googleId first (returning user)
          let user = await User.findOne({ googleId })

          if (!user && email) {
            // 2. Try to find by email (existing account without Google linked)
            user = await User.findOne({ email })

            if (user) {
              // Link Google to existing email account
              user.googleId = googleId
              await user.save()
            } else {
              // 3. Brand-new user — create one (no password hash for OAuth users)
              user = await User.create({ name, email, googleId, passwordHash: null })
            }
          }

          return done(null, user)
        } catch (err) {
          return done(err, null)
        }
      }
    )
  )
}