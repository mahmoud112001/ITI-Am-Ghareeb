const mongoose = require("mongoose");

const { Schema } = mongoose;

const FareSchema = new Schema(
  {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    currency: { type: String, default: "EGP" },
    lastVerified: { type: String, default: null },
  },
  { _id: false },
);

const OperatingHoursSchema = new Schema(
  {
    start: { type: String, default: null },
    end: { type: String, default: null },
  },
  { _id: false },
);

const GeometrySchema = new Schema(
  {
    type: {
      type: String,
      enum: ["LineString"],
      default: "LineString",
      required: true,
    },
    coordinates: {
      type: [[Number]],
      required: true,
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length >= 2 &&
            value.every(
              (point) =>
                Array.isArray(point) &&
                point.length === 2 &&
                point.every((coordinate) => Number.isFinite(coordinate)),
            )
          );
        },
        message:
          "Route geometry must be a LineString with at least two [lng, lat] points",
      },
    },
  },
  { _id: false },
);

const RouteStopSchema = new Schema(
  {
    location: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    allowPickup: {
      type: Boolean,
      default: true,
    },
    allowDropoff: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false },
);

RouteStopSchema.pre("validate", function validateStopDirectionality(next) {
  if (this.allowPickup === false && this.allowDropoff === false) {
    this.invalidate(
      "allowDropoff",
      "A route stop must allow pickup, dropoff, or both",
    );
  }
  next();
});

const RouteSchema = new Schema(
  {
    routeId: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ["microbus", "bus", "tram", "train", "university_shuttle"],
      required: true,
    },
    localName: {
      type: String,
      default: "مشروع",
    },
    nameAr: {
      type: String,
      required: true,
    },
    nameEn: {
      type: String,
      required: true,
    },
    origin: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    destination: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    stops: {
      type: [RouteStopSchema],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length >= 2;
        },
        message: "A route must contain at least two ordered stops",
      },
    },
    geometry: {
      type: GeometrySchema,
      required: true,
    },
    fare: {
      type: FareSchema,
      required: true,
    },
    operatingHours: {
      type: OperatingHoursSchema,
      default: null,
    },
    frequency: {
      type: String,
      default: null,
      trim: true,
    },
    peakHours: {
      type: [String],
      default: [],
    },
    tips: {
      type: [String],
      default: [],
    },
    isBidirectional: {
      type: Boolean,
      default: false,
      index: true,
    },
    verified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

RouteSchema.index(
  {
    routeId: "text",
    nameAr: "text",
    nameEn: "text",
  },
  { name: "route_text_search" },
);

RouteSchema.index({ routeId: 1 });
RouteSchema.index({ origin: 1, destination: 1, isActive: 1 });
RouteSchema.index({ "stops.location": 1, isActive: 1 });

RouteSchema.statics.getAccuracyStats = async function getAccuracyStats(routeId) {
  const route = await this.findOne({ routeId });
  if (!route) throw new Error("الخط غير موجود");

  const Rating = require("./Rating.model");

  const total = await Rating.countDocuments({ route: route._id });
  const accurate = await Rating.countDocuments({
    route: route._id,
    isAccurate: true,
  });

  if (total < 3) {
    return { total, accurate, percentage: null, label: "غير مقيّم بعد" };
  }

  const percentage = Math.round((accurate / total) * 100);

  let label;
  if (percentage >= 80) {
    label = "دقيق جداً";
  } else if (percentage >= 60) {
    label = "دقيق نسبياً";
  } else {
    label = "غير موثوق";
  }

  return { total, accurate, percentage, label };
};

module.exports = mongoose.model("Route", RouteSchema);
