const { MongoMemoryServer } = require('mongodb-memory-server')
const mongoose = require('mongoose')
const request = require('supertest')
const app = require('../../app')
const { TravelPlanRating, Route, Rating } = require('../models/index.js')
const {
  buildRoutePayloadFromLegacyRoute,
  extractRouteFields,
  syncRouteLocations,
} = require('../utils/routeNetwork')

let mongod
let accessToken
let userId
let testRoute

const routeData = {
  routeId: 'RATING-TEST-01',
  type: 'microbus',
  nameAr: 'خط تجريبي للتقييم',
  nameEn: 'Rating Test Route',
  origin: { nameAr: 'نقطة أ', nameEn: 'Point A', coords: { lat: 0, lng: 0 } },
  destination: { nameAr: 'نقطة ب', nameEn: 'Point B', coords: { lat: 0, lng: 0 } },
  stations: [
    { order: 1, nameAr: 'نقطة أ', nameEn: 'Point A', coords: { lat: 0, lng: 0 } },
    { order: 2, nameAr: 'نقطة ب', nameEn: 'Point B', coords: { lat: 0, lng: 0 } },
  ],
  fare: { min: 5, max: 10 },
  verified: true,
  isActive: true,
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const payload = buildRoutePayloadFromLegacyRoute({ ...routeData, direction: 'one_way' })
  testRoute = new Route(extractRouteFields(payload))
  await syncRouteLocations(testRoute, payload)

  const regRes = await request(app).post('/api/auth/register').send({
    name: 'مقيّم تجريبي',
    email: 'rater@example.com',
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
  await Rating.deleteMany({})
  await TravelPlanRating.deleteMany({})
})

// ── Submit rating ─────────────────────────────────────────────────────────────

describe('POST /api/ratings', () => {
  test('with auth and valid body → 200', async () => {
    const res = await request(app)
      .post('/api/ratings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ routeId: 'RATING-TEST-01', isAccurate: true })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.rating.isAccurate).toBe(true)
  })

  test('same user submits again (upsert) → 200, not duplicate error', async () => {
    await request(app)
      .post('/api/ratings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ routeId: 'RATING-TEST-01', isAccurate: true })

    const res = await request(app)
      .post('/api/ratings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ routeId: 'RATING-TEST-01', isAccurate: false })

    expect(res.status).toBe(200)
    const count = await Rating.countDocuments()
    expect(count).toBe(1)
    expect(res.body.rating.isAccurate).toBe(false)
  })

  test('without auth → 401', async () => {
    const res = await request(app)
      .post('/api/ratings')
      .send({ routeId: 'RATING-TEST-01', isAccurate: true })
    expect(res.status).toBe(401)
  })

  test('missing isAccurate → 400', async () => {
    const res = await request(app)
      .post('/api/ratings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ routeId: 'RATING-TEST-01' })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/ratings/travel-plan', () => {
  test('with auth and valid body → 200', async () => {
    const res = await request(app)
      .post('/api/ratings/travel-plan')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        travelPlanId: 'RATING-TEST-01:forward:0:1__RATING-TEST-02:forward:0:1',
        routeIds: ['RATING-TEST-01'],
        transferCount: 1,
        isAccurate: true,
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.rating.isAccurate).toBe(true)
    expect(res.body.rating.travelPlanId).toContain('RATING-TEST-01')
  })

  test('same user submits travelPlan rating again (upsert) → 200, not duplicate error', async () => {
    const body = {
      travelPlanId: 'RATING-TEST-01:forward:0:1__RATING-TEST-02:forward:0:1',
      routeIds: ['RATING-TEST-01'],
      transferCount: 1,
      isAccurate: true,
    }

    await request(app)
      .post('/api/ratings/travel-plan')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body)

    const res = await request(app)
      .post('/api/ratings/travel-plan')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...body, isAccurate: false })

    expect(res.status).toBe(200)
    const count = await TravelPlanRating.countDocuments()
    expect(count).toBe(1)
    expect(res.body.rating.isAccurate).toBe(false)
  })

  test('missing routeIds → 400', async () => {
    const res = await request(app)
      .post('/api/ratings/travel-plan')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        travelPlanId: 'RATING-TEST-01:forward:0:1',
        transferCount: 1,
        isAccurate: true,
      })

    expect(res.status).toBe(400)
  })
})

// ── Rating stats ──────────────────────────────────────────────────────────────

describe('GET /api/ratings/:routeId/stats', () => {
  test('0 ratings → percentage: null, label: غير مقيّم بعد', async () => {
    const res = await request(app).get('/api/ratings/RATING-TEST-01/stats')
    expect(res.status).toBe(200)
    expect(res.body.stats.percentage).toBeNull()
    expect(res.body.stats.label).toBe('غير مقيّم بعد')
  })

  test('2 ratings → still below threshold, percentage: null', async () => {
    for (let i = 0; i < 2; i++) {
      const reg = await request(app).post('/api/auth/register').send({
        name: `مستخدم ${i}`,
        email: `user${i}_stats@example.com`,
        password: 'Secret123',
      })
      await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ routeId: 'RATING-TEST-01', isAccurate: true })
    }

    const res = await request(app).get('/api/ratings/RATING-TEST-01/stats')
    expect(res.body.stats.percentage).toBeNull()
    expect(res.body.stats.label).toBe('غير مقيّم بعد')
  })

  test('3 accurate ratings → percentage: 100, label: دقيق جداً', async () => {
    for (let i = 0; i < 3; i++) {
      const reg = await request(app).post('/api/auth/register').send({
        name: `مستخدم دقيق ${i}`,
        email: `accurate${i}@example.com`,
        password: 'Secret123',
      })
      await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ routeId: 'RATING-TEST-01', isAccurate: true })
    }

    const res = await request(app).get('/api/ratings/RATING-TEST-01/stats')
    expect(res.body.stats.percentage).toBe(100)
    expect(res.body.stats.label).toBe('دقيق جداً')
  })

  test('mixed ratings → correct percentage calculation', async () => {
    // 3 accurate + 1 inaccurate = 75% → دقيق نسبياً
    for (let i = 0; i < 4; i++) {
      const reg = await request(app).post('/api/auth/register').send({
        name: `مستخدم مختلط ${i}`,
        email: `mixed${i}@example.com`,
        password: 'Secret123',
      })
      await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ routeId: 'RATING-TEST-01', isAccurate: i < 3 })
    }

    const res = await request(app).get('/api/ratings/RATING-TEST-01/stats')
    expect(res.body.stats.percentage).toBe(75)
    expect(res.body.stats.label).toBe('دقيق نسبياً')
  })
})
