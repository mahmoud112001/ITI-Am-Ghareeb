const { MongoMemoryServer } = require('mongodb-memory-server')
const mongoose = require('mongoose')
const request = require('supertest')
const app = require('../../app')
const { Route, User, SearchHistory } = require('../models/index.js')

let mongod
let accessToken
let userId

// ── Route fixtures ────────────────────────────────────────────────────────────

const route1Data = {
  routeId: 'TEST-MICRO-01',
  type: 'microbus',
  nameAr: 'خط المندرة - محطة مصر',
  nameEn: 'Mandara - Mahattat Masr',
  origin: { nameAr: 'المندرة', nameEn: 'Mandara', coords: { lat: 31.29, lng: 30.02 } },
  destination: { nameAr: 'محطة مصر', nameEn: 'Mahattat Masr', coords: { lat: 31.19, lng: 29.9 } },
  stations: [
    { order: 1, nameAr: 'المندرة', nameEn: 'Mandara', coords: { lat: 31.29, lng: 30.02 } },
    { order: 2, nameAr: 'سيدي بشر', nameEn: 'Sidi Bishr', coords: { lat: 0, lng: 0 } },
    { order: 3, nameAr: 'محطة مصر', nameEn: 'Mahattat Masr', coords: { lat: 31.19, lng: 29.9 } },
  ],
  fare: { min: 5, max: 8 },
  peakHours: ['8:00–10:00', '16:00–19:00'],
  tips: ['تجنب أوقات الذروة'],
  verified: true,
  isActive: true,
}

const route2Data = {
  routeId: 'TEST-MICRO-02',
  type: 'microbus',
  nameAr: 'خط أبو قير - الرمل',
  nameEn: 'Abu Qir - Raml',
  origin: { nameAr: 'أبو قير', nameEn: 'Abu Qir', coords: { lat: 31.32, lng: 30.06 } },
  destination: { nameAr: 'الرمل', nameEn: 'Raml', coords: { lat: 31.2, lng: 29.91 } },
  stations: [
    { order: 1, nameAr: 'أبو قير', nameEn: 'Abu Qir', coords: { lat: 31.32, lng: 30.06 } },
    { order: 2, nameAr: 'المندرة', nameEn: 'Mandara', coords: { lat: 0, lng: 0 } },
    { order: 3, nameAr: 'الرمل', nameEn: 'Raml', coords: { lat: 31.2, lng: 29.91 } },
  ],
  fare: { min: 6, max: 10 },
  peakHours: ['7:00–9:00'],
  tips: [],
  verified: false,
  isActive: true,
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())

  await Route.create([route1Data, route2Data])

  const regRes = await request(app).post('/api/auth/register').send({
    name: 'مستخدم تجريبي',
    email: 'test@example.com',
    password: 'Secret123',
  })
  accessToken = regRes.body.accessToken
  userId = regRes.body.user._id
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  await SearchHistory.deleteMany({})
  await User.findByIdAndUpdate(userId, { savedRoutes: [] })
})

// ── Search ────────────────────────────────────────────────────────────────────

describe('GET /api/routes/search', () => {
  test('valid origin + destination → 200 with results array including accuracyStats', async () => {
    const res = await request(app)
      .get('/api/routes/search')
      .query({ origin: 'المندرة', destination: 'محطة مصر' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.results)).toBe(true)
    expect(res.body.results.length).toBeGreaterThanOrEqual(1)
    expect(res.body.results[0]).toHaveProperty('accuracyStats')
    expect(res.body.results[0]).toHaveProperty('route')
  })

  test('authenticated user → saves SearchHistory record', async () => {
    await request(app)
      .get('/api/routes/search')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ origin: 'المندرة', destination: 'محطة مصر' })

    const history = await SearchHistory.findOne({ user: userId })
    expect(history).not.toBeNull()
    expect(history.originQuery).toBe('المندرة')
  })

  test('unauthenticated user → does NOT save SearchHistory', async () => {
    await request(app)
      .get('/api/routes/search')
      .query({ origin: 'المندرة', destination: 'محطة مصر' })

    const count = await SearchHistory.countDocuments()
    expect(count).toBe(0)
  })

  test('missing origin → 400', async () => {
    const res = await request(app)
      .get('/api/routes/search')
      .query({ destination: 'محطة مصر' })
    expect(res.status).toBe(400)
  })
})

// ── Stations ──────────────────────────────────────────────────────────────────

describe('GET /api/routes/stations', () => {
  test('returns 200 with array of Arabic strings', async () => {
    const res = await request(app).get('/api/routes/stations')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.stations)).toBe(true)
    res.body.stations.forEach((s) => expect(typeof s).toBe('string'))
  })

  test('includes stations from both test routes', async () => {
    const res = await request(app).get('/api/routes/stations')
    expect(res.body.stations).toContain('المندرة')
    expect(res.body.stations).toContain('أبو قير')
    expect(res.body.stations).toContain('الرمل')
  })
})

// ── History (new endpoint) ────────────────────────────────────────────────────

describe('GET /api/routes/history', () => {
  test('authenticated → 200 with history array', async () => {
    await request(app)
      .get('/api/routes/search')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ origin: 'المندرة', destination: 'محطة مصر' })

    const res = await request(app)
      .get('/api/routes/history')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.history)).toBe(true)
    expect(res.body.history.length).toBeGreaterThanOrEqual(1)
    expect(res.body.history[0].originQuery).toBe('المندرة')
  })

  test('no auth → 401', async () => {
    const res = await request(app).get('/api/routes/history')
    expect(res.status).toBe(401)
  })
})

// ── Saved Routes (new endpoint) ───────────────────────────────────────────────

describe('GET /api/routes/saved', () => {
  test('authenticated with saved routes → 200 with routes and accuracyStats', async () => {
    await request(app)
      .post('/api/routes/save/TEST-MICRO-01')
      .set('Authorization', `Bearer ${accessToken}`)

    const res = await request(app)
      .get('/api/routes/saved')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.routes)).toBe(true)
    expect(res.body.routes.length).toBe(1)
    expect(res.body.routes[0].routeId).toBe('TEST-MICRO-01')
    expect(res.body.routes[0]).toHaveProperty('accuracyStats')
  })

  test('no auth → 401', async () => {
    const res = await request(app).get('/api/routes/saved')
    expect(res.status).toBe(401)
  })
})

// ── Get route by ID ───────────────────────────────────────────────────────────

describe('GET /api/routes/:routeId', () => {
  test('valid routeId → 200 with route and accuracyStats', async () => {
    const res = await request(app).get('/api/routes/TEST-MICRO-01')
    expect(res.status).toBe(200)
    expect(res.body.route.routeId).toBe('TEST-MICRO-01')
    expect(res.body).toHaveProperty('accuracyStats')
  })

  test('invalid routeId → 404', async () => {
    const res = await request(app).get('/api/routes/DOES-NOT-EXIST')
    expect(res.status).toBe(404)
  })
})

// ── Save / Unsave ─────────────────────────────────────────────────────────────

describe('POST /api/routes/save/:routeId', () => {
  test('with auth → 200, route appears in user savedRoutes', async () => {
    const res = await request(app)
      .post('/api/routes/save/TEST-MICRO-01')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)

    const user = await User.findById(userId).populate('savedRoutes')
    const routeIds = user.savedRoutes.map((r) => r.routeId)
    expect(routeIds).toContain('TEST-MICRO-01')
  })

  test('no auth → 401', async () => {
    const res = await request(app).post('/api/routes/save/TEST-MICRO-01')
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/routes/save/:routeId', () => {
  test('with auth → 200, route removed from savedRoutes', async () => {
    await request(app)
      .post('/api/routes/save/TEST-MICRO-01')
      .set('Authorization', `Bearer ${accessToken}`)

    const res = await request(app)
      .delete('/api/routes/save/TEST-MICRO-01')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)

    const user = await User.findById(userId)
    expect(user.savedRoutes.length).toBe(0)
  })
})
