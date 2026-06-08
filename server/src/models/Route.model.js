const mongoose = require('mongoose')

const { Schema } = mongoose

const CoordsSchema = new Schema(
  {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 },
  },
  { _id: false }
)

const RouteSchema = new Schema(
  {
    routeId: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ['microbus', 'bus', 'tram', 'university_shuttle'],
      required: true,
    },
    localName: {
      type: String,
      default: 'مشروع',
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
      nameAr: { type: String, required: true },
      nameEn: { type: String, required: true },
      coords: { type: CoordsSchema, default: () => ({ lat: 0, lng: 0 }) },
    },
    destination: {
      nameAr: { type: String, required: true },
      nameEn: { type: String, required: true },
      coords: { type: CoordsSchema, default: () => ({ lat: 0, lng: 0 }) },
    },
    stations: [
      {
        order: { type: Number, required: true },
        nameAr: { type: String, required: true },
        nameEn: { type: String, required: true },
        coords: { type: CoordsSchema, default: () => ({ lat: 0, lng: 0 }) },
      },
    ],
    fare: {
      min: { type: Number, required: true },
      max: { type: Number, required: true },
      currency: { type: String, default: 'EGP' },
      lastVerified: { type: String },
    },
    operatingHours: {
      start: { type: String },
      end: { type: String },
    },
    peakHours: [String],
    frequency: { type: String },
    direction: {
      type: String,
      enum: ['bidirectional', 'one_way'],
      default: 'bidirectional',
    },
    tips: [String],
    verified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

// Text search index on Arabic/English station names and route name
RouteSchema.index(
  {
    'stations.nameAr': 'text',
    'stations.nameEn': 'text',
    nameAr: 'text',
  },
  { name: 'route_text_search' }
)

RouteSchema.index({ isActive: 1 })
RouteSchema.index({ routeId: 1 })

// Static method: get accuracy stats for a route
RouteSchema.statics.getAccuracyStats = async function (routeId) {
  const route = await this.findOne({ routeId })
  if (!route) throw new Error('الخط غير موجود')

  // Late require to avoid circular dependency between Route and Rating
  const Rating = require('./Rating.model')

  const total = await Rating.countDocuments({ route: route._id })
  const accurate = await Rating.countDocuments({ route: route._id, isAccurate: true })

  if (total < 3) {
    return { total, accurate, percentage: null, label: 'غير مقيّم بعد' }
  }

  const percentage = Math.round((accurate / total) * 100)

  let label
  if (percentage >= 80) {
    label = 'دقيق جداً'
  } else if (percentage >= 60) {
    label = 'دقيق نسبياً'
  } else {
    label = 'غير موثوق'
  }

  return { total, accurate, percentage, label }
}

module.exports = mongoose.model('Route', RouteSchema)
