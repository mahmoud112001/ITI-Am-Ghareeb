const mongoose = require("mongoose");

const { Schema } = mongoose;

const SavedLocationSummarySchema = new Schema(
  {
    _id: { type: String, default: null },
    nameAr: { type: String, default: null },
    nameEn: { type: String, default: null },
    coords: {
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 },
    },
  },
  { _id: false },
);

const SavedItineraryLegSchema = new Schema(
  {
    routeId: {
      type: String,
      required: true,
      trim: true,
    },
    selectedDirection: {
      type: String,
      enum: ["forward", "reverse"],
      default: "forward",
    },
    originStopId: {
      type: String,
      default: null,
      trim: true,
    },
    destinationStopId: {
      type: String,
      default: null,
      trim: true,
    },
    boardAt: {
      type: SavedLocationSummarySchema,
      default: null,
    },
    alightAt: {
      type: SavedLocationSummarySchema,
      default: null,
    },
  },
  { _id: false },
);

const SavedTransferWalkSchema = new Schema(
  {
    from: {
      type: SavedLocationSummarySchema,
      default: null,
    },
    to: {
      type: SavedLocationSummarySchema,
      default: null,
    },
    distanceMeters: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

const SavedFareSchema = new Schema(
  {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
    currency: { type: String, default: "EGP" },
  },
  { _id: false },
);

const SavedItinerarySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    itineraryId: {
      type: String,
      required: true,
      trim: true,
    },
    transferCount: {
      type: Number,
      required: true,
      min: 1,
    },
    routeIds: {
      type: [String],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length >= 2;
        },
        message: "routeIds must contain at least two routes",
      },
    },
    legs: {
      type: [SavedItineraryLegSchema],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length >= 2;
        },
        message: "legs must contain at least two segments",
      },
    },
    transferWalks: {
      type: [SavedTransferWalkSchema],
      default: [],
    },
    totalFare: {
      type: SavedFareSchema,
      default: null,
    },
    originWalkDistanceMeters: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

SavedItinerarySchema.index({ user: 1, itineraryId: 1 }, { unique: true });

module.exports = mongoose.model("SavedItinerary", SavedItinerarySchema);
