const mongoose = require("mongoose");

const { Schema } = mongoose;

const ItineraryRatingSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    itineraryId: {
      type: String,
      required: true,
      trim: true,
    },
    routeIds: {
      type: [String],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "routeIds must contain at least one route",
      },
    },
    transferCount: {
      type: Number,
      required: true,
      min: 1,
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
  { timestamps: true },
);

ItineraryRatingSchema.index({ user: 1, itineraryId: 1 }, { unique: true });

module.exports = mongoose.model("ItineraryRating", ItineraryRatingSchema);
