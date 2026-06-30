const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const { Schema } = mongoose

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'البريد الإلكتروني غير صحيح',
      },
    },
    passwordHash: {
      type: String,
      default: null,
    },
    googleId: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    refreshToken: {
      type: String,
      default: null,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationOtp: {
      type: String,
      default: null,
    },
    emailVerificationOtpExpires: {
      type: Date,
      default: null,
    },
    savedRoutes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Route',
      },
    ],
  },
  { timestamps: true }
)

// Pre-save hook: hash passwordHash if modified and not null
UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash') || this.passwordHash === null) {
    return next()
  }
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12)
  next()
})

// Instance method: compare plaintext password against stored hash
UserSchema.methods.comparePassword = async function (plaintext) {
  if (!this.passwordHash) return false
  return bcrypt.compare(plaintext, this.passwordHash)
}

// Static method: find user by email (case-insensitive)
UserSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase().trim() })
}

module.exports = mongoose.model('User', UserSchema)
