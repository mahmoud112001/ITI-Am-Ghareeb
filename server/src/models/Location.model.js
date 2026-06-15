const mongoose = require("mongoose");

const { Schema } = mongoose;

const GeoPointSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      validate: {
        validator(value) {
          return !value || value.length === 2;
        },
        message: "GeoJSON coordinates must be [lng, lat]",
      },
    },
  },
  { _id: false },
);

const LocationSchema = new Schema(
  {
    canonicalKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    nameAr: {
      type: String,
      required: true,
      trim: true,
    },
    nameEn: {
      type: String,
      required: true,
      trim: true,
    },
    aliases: {
      ar: {
        type: [String],
        default: [],
      },
      en: {
        type: [String],
        default: [],
      },
    },
    location: {
      type: GeoPointSchema,
      default: undefined,
    },
    district: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true },
);

LocationSchema.index({ location: "2dsphere" });
LocationSchema.index(
  {
    nameAr: "text",
    nameEn: "text",
    "aliases.ar": "text",
    "aliases.en": "text",
  },
  { name: "location_text_search" },
);

module.exports = mongoose.model("Location", LocationSchema);
