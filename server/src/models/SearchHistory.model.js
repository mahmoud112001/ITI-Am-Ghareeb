const mongoose = require('mongoose')

const { Schema } = mongoose

const SearchHistorySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    originQuery: {
      type: String,
      required: true,
      trim: true,
    },
    destinationQuery: {
      type: String,
      required: true,
      trim: true,
    },
    routesFound: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
)

SearchHistorySchema.index({ user: 1, createdAt: -1 })

module.exports = mongoose.model('SearchHistory', SearchHistorySchema)
