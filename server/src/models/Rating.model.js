const mongoose = require('mongoose')

const { Schema } = mongoose

const RatingSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    route: {
      type: Schema.Types.ObjectId,
      ref: 'Route',
      required: true,
    },
    isAccurate: {
      type: Boolean,
      required: true,
    },
    comment: {
      type: String,
      maxlength: 280,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
)

// Prevent a user from rating the same route more than once
RatingSchema.index({ user: 1, route: 1 }, { unique: true })

module.exports = mongoose.model('Rating', RatingSchema)
