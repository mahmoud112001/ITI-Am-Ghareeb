const { MongoMemoryServer } = require('mongodb-memory-server')
const mongoose = require('mongoose')
const { User, Route, Rating, SearchHistory } = require('../models/index')
const {
  buildRoutePayloadFromLegacyRoute,
  extractRouteFields,
  syncRouteLocations,
} = require('../utils/routeNetwork')

let mongod

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRouteData(overrides = {}) {
  return {
    routeId: `TEST-ROUTE-${Date.now()}-${Math.random()}`,
    type: 'microbus',
    nameAr: 'خط تجريبي',
    nameEn: 'Test Route',
    verified: true,
    isActive: true,
    ...overrides,
  }
}

async function makeUser(overrides = {}) {
  const u = new User({
    name: 'Test User',
    email: `test_${Date.now()}_${Math.random()}@example.com`,
    passwordHash: 'Secret123!',
    ...overrides,
  })
  return u.save()
}

async function makeRoute(overrides = {}) {
  const payload = buildRoutePayloadFromLegacyRoute({
    ...makeRouteData(),
    direction: 'one_way',
    origin: { nameAr: 'نقطة البداية', nameEn: 'Origin', coords: { lat: 31.2, lng: 30 } },
    destination: { nameAr: 'نقطة النهاية', nameEn: 'Destination', coords: { lat: 31.1, lng: 29.9 } },
    stations: [
      { order: 1, nameAr: 'نقطة البداية', nameEn: 'Origin', coords: { lat: 31.2, lng: 30 } },
      { order: 2, nameAr: 'نقطة النهاية', nameEn: 'Destination', coords: { lat: 31.1, lng: 29.9 } },
    ],
    fare: { min: 8, max: 10 },
    ...overrides,
  })
  const route = new Route(extractRouteFields(payload))
  await syncRouteLocations(route, payload)
  return route
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }
})

// ─── User Tests ───────────────────────────────────────────────────────────────

describe('User model', () => {
  test('creates user with valid data', async () => {
    const user = await makeUser()
    expect(user._id).toBeDefined()
    expect(user.email).toContain('@example.com')
    expect(user.role).toBe('user')
  })

  test('hashes password on save', async () => {
    const user = await makeUser({ passwordHash: 'plaintext123' })
    expect(user.passwordHash).not.toBe('plaintext123')
    expect(user.passwordHash.startsWith('$2')).toBe(true)
  })

  test('comparePassword returns true for correct password', async () => {
    const plain = 'MySecret999'
    const user = await makeUser({ passwordHash: plain })
    const match = await user.comparePassword(plain)
    expect(match).toBe(true)
  })

  test('comparePassword returns false for wrong password', async () => {
    const user = await makeUser({ passwordHash: 'CorrectPass1' })
    const match = await user.comparePassword('WrongPass999')
    expect(match).toBe(false)
  })

  test('findByEmail finds by lowercase email', async () => {
    const user = await makeUser({ email: 'unique@example.com' })
    const found = await User.findByEmail('UNIQUE@EXAMPLE.COM')
    expect(found).not.toBeNull()
    expect(found._id.toString()).toBe(user._id.toString())
  })

  test('duplicate email throws 11000 error', async () => {
    const email = 'dup@example.com'
    await makeUser({ email })
    await expect(makeUser({ email })).rejects.toMatchObject({ code: 11000 })
  })

  test('googleId user has null passwordHash', async () => {
    const user = new User({
      name: 'Google User',
      email: `google_${Date.now()}@example.com`,
      googleId: 'google-oauth-id-123',
    })
    await user.save()
    expect(user.passwordHash).toBeNull()
  })
})

// ─── Route Tests ─────────────────────────────────────────────────────────────

describe('Route model', () => {
  test('creates route with all required fields', async () => {
    const route = await makeRoute()
    expect(route._id).toBeDefined()
    expect(route.routeId).toBeDefined()
    expect(route.type).toBe('microbus')
    expect(route.localName).toBe('مشروع')
  })

  test('getAccuracyStats returns غير مقيّم بعد when less than 3 ratings', async () => {
    const route = await makeRoute()
    const user1 = await makeUser()
    const user2 = await makeUser()

    await Rating.create({ user: user1._id, route: route._id, isAccurate: true })
    await Rating.create({ user: user2._id, route: route._id, isAccurate: false })

    const stats = await Route.getAccuracyStats(route.routeId)
    expect(stats.total).toBe(2)
    expect(stats.percentage).toBeNull()
    expect(stats.label).toBe('غير مقيّم بعد')
  })

  test('getAccuracyStats calculates percentage correctly at 3+ ratings', async () => {
    const route = await makeRoute()
    const users = await Promise.all([makeUser(), makeUser(), makeUser(), makeUser()])

    await Rating.create({ user: users[0]._id, route: route._id, isAccurate: true })
    await Rating.create({ user: users[1]._id, route: route._id, isAccurate: true })
    await Rating.create({ user: users[2]._id, route: route._id, isAccurate: true })
    await Rating.create({ user: users[3]._id, route: route._id, isAccurate: false })

    const stats = await Route.getAccuracyStats(route.routeId)
    expect(stats.total).toBe(4)
    expect(stats.accurate).toBe(3)
    expect(stats.percentage).toBe(75)
  })

  test('getAccuracyStats label: 80%+ → دقيق جداً', async () => {
    const route = await makeRoute()
    const users = await Promise.all([makeUser(), makeUser(), makeUser(), makeUser(), makeUser()])

    for (let i = 0; i < 4; i++) {
      await Rating.create({ user: users[i]._id, route: route._id, isAccurate: true })
    }
    await Rating.create({ user: users[4]._id, route: route._id, isAccurate: false })

    const stats = await Route.getAccuracyStats(route.routeId)
    expect(stats.percentage).toBe(80)
    expect(stats.label).toBe('دقيق جداً')
  })

  test('getAccuracyStats label: 60–79% → دقيق نسبياً', async () => {
    const route = await makeRoute()
    const users = await Promise.all([makeUser(), makeUser(), makeUser(), makeUser(), makeUser()])

    for (let i = 0; i < 3; i++) {
      await Rating.create({ user: users[i]._id, route: route._id, isAccurate: true })
    }
    for (let i = 3; i < 5; i++) {
      await Rating.create({ user: users[i]._id, route: route._id, isAccurate: false })
    }

    const stats = await Route.getAccuracyStats(route.routeId)
    expect(stats.percentage).toBe(60)
    expect(stats.label).toBe('دقيق نسبياً')
  })

  test('getAccuracyStats label: below 60 → غير موثوق', async () => {
    const route = await makeRoute()
    const users = await Promise.all([makeUser(), makeUser(), makeUser(), makeUser(), makeUser()])

    await Rating.create({ user: users[0]._id, route: route._id, isAccurate: true })
    for (let i = 1; i < 5; i++) {
      await Rating.create({ user: users[i]._id, route: route._id, isAccurate: false })
    }

    const stats = await Route.getAccuracyStats(route.routeId)
    expect(stats.percentage).toBe(20)
    expect(stats.label).toBe('غير موثوق')
  })

  test('text search index finds route by Arabic line name', async () => {
    await makeRoute({
      routeId: 'SEARCH-TEST-01',
      origin: { nameAr: 'سيدي جابر', nameEn: 'Sidi Gaber', coords: { lat: 31.2, lng: 30 } },
      destination: { nameAr: 'محطة مصر', nameEn: 'Mahattat Masr', coords: { lat: 31.1, lng: 29.9 } },
      stations: [
        { order: 1, nameAr: 'سيدي جابر', nameEn: 'Sidi Gaber', coords: { lat: 31.2, lng: 30 } },
        { order: 2, nameAr: 'محطة مصر', nameEn: 'Mahattat Masr', coords: { lat: 31.1, lng: 29.9 } },
      ],
    })

    const results = await Route.find({ $text: { $search: 'سيدي جابر' } })
    expect(results.length).toBeGreaterThanOrEqual(1)
    const names = results.map((r) => r.nameAr)
    expect(names).toContain('سيدي جابر ← محطة مصر')
  })
})

// ─── Rating Tests ─────────────────────────────────────────────────────────────

describe('Rating model', () => {
  test('creates rating with isAccurate true', async () => {
    const user = await makeUser()
    const route = await makeRoute()

    const rating = await Rating.create({ user: user._id, route: route._id, isAccurate: true })
    expect(rating._id).toBeDefined()
    expect(rating.isAccurate).toBe(true)
  })

  test('prevents duplicate rating for same user+route (compound unique index)', async () => {
    const user = await makeUser()
    const route = await makeRoute()

    await Rating.create({ user: user._id, route: route._id, isAccurate: true })
    await expect(
      Rating.create({ user: user._id, route: route._id, isAccurate: false })
    ).rejects.toMatchObject({ code: 11000 })
  })

  test('comment is optional', async () => {
    const user = await makeUser()
    const route = await makeRoute()

    const rating = await Rating.create({ user: user._id, route: route._id, isAccurate: true })
    expect(rating.comment).toBeNull()
  })
})

// ─── SearchHistory Tests ──────────────────────────────────────────────────────

describe('SearchHistory model', () => {
  test('creates record with user + origin + destination', async () => {
    const user = await makeUser()
    const record = await SearchHistory.create({
      user: user._id,
      originQuery: 'سيدي بشر',
      destinationQuery: 'محطة مصر',
    })

    expect(record._id).toBeDefined()
    expect(record.originQuery).toBe('سيدي بشر')
    expect(record.destinationQuery).toBe('محطة مصر')
    expect(record.user.toString()).toBe(user._id.toString())
  })

  test('routesFound defaults to 0', async () => {
    const user = await makeUser()
    const record = await SearchHistory.create({
      user: user._id,
      originQuery: 'المنتزه',
      destinationQuery: 'باب شرقي',
    })

    expect(record.routesFound).toBe(0)
  })
})
