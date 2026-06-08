const { MongoMemoryServer } = require('mongodb-memory-server')
const mongoose = require('mongoose')
const request = require('supertest')
const app = require('../../app')
const { Route, User } = require('../models/index.js')

let mongod
let adminToken
let userToken
let seededRouteId

const adminCreds = {
  name: 'مدير النظام',
  email: 'admin@example.com',
  password: 'Admin123',
}

const userCreds = {
  name: 'مستخدم عادي',
  email: 'user@example.com',
  password: 'User1234',
}

const newRouteData = {
  routeId: 'ADMIN-TEST-NEW',
  type: 'microbus',
  nameAr: 'خط إداري جديد',
  nameEn: 'Admin New Route',
  origin: { nameAr: 'نقطة أ', nameEn: 'Point A' },
  destination: { nameAr: 'نقطة ب', nameEn: 'Point B' },
  stations: [
    { order: 1, nameAr: 'نقطة أ', nameEn: 'Point A' },
    { order: 2, nameAr: 'نقطة ب', nameEn: 'Point B' },
  ],
  fare: { min: 5, max: 10 },
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())

  // Create admin user (register then elevate role directly in DB)
  await request(app).post('/api/auth/register').send(adminCreds)
  await User.findOneAndUpdate({ email: adminCreds.email }, { role: 'admin' })
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: adminCreds.email, password: adminCreds.password })
  adminToken = adminLogin.body.accessToken

  // Create regular user
  const userReg = await request(app).post('/api/auth/register').send(userCreds)
  userToken = userReg.body.accessToken

  // Seed one route
  const route = await Route.create({
    routeId: 'ADMIN-SEED-01',
    type: 'microbus',
    nameAr: 'خط مبدئي',
    nameEn: 'Seed Route',
    origin: { nameAr: 'أ', nameEn: 'A' },
    destination: { nameAr: 'ب', nameEn: 'B' },
    stations: [
      { order: 1, nameAr: 'أ', nameEn: 'A' },
      { order: 2, nameAr: 'ب', nameEn: 'B' },
    ],
    fare: { min: 3, max: 6 },
  })
  seededRouteId = route._id.toString()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

// ── List routes ───────────────────────────────────────────────────────────────

describe('GET /api/admin/routes', () => {
  test('as admin → 200 with routes array', async () => {
    const res = await request(app)
      .get('/api/admin/routes')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.routes)).toBe(true)
    expect(res.body).toHaveProperty('total')
    expect(res.body).toHaveProperty('pages')
  })

  test('as regular user → 403', async () => {
    const res = await request(app)
      .get('/api/admin/routes')
      .set('Authorization', `Bearer ${userToken}`)
    expect(res.status).toBe(403)
  })

  test('no auth → 401', async () => {
    const res = await request(app).get('/api/admin/routes')
    expect(res.status).toBe(401)
  })
})

// ── Create route ──────────────────────────────────────────────────────────────

describe('POST /api/admin/routes', () => {
  afterEach(async () => {
    await Route.deleteOne({ routeId: 'ADMIN-TEST-NEW' })
  })

  test('as admin with valid data → 201', async () => {
    const res = await request(app)
      .post('/api/admin/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newRouteData)

    expect(res.status).toBe(201)
    expect(res.body.route.routeId).toBe('ADMIN-TEST-NEW')
  })

  test('as admin with invalid data (missing nameAr) → 400', async () => {
    const res = await request(app)
      .post('/api/admin/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...newRouteData, nameAr: undefined })

    expect(res.status).toBe(400)
  })
})

// ── Update route ──────────────────────────────────────────────────────────────

describe('PUT /api/admin/routes/:id', () => {
  test('as admin → 200 with updated route', async () => {
    const res = await request(app)
      .put(`/api/admin/routes/${seededRouteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nameEn: 'Updated Seed Route' })

    expect(res.status).toBe(200)
    expect(res.body.route.nameEn).toBe('Updated Seed Route')
  })

  test('invalid id → 404 or 500', async () => {
    const res = await request(app)
      .put('/api/admin/routes/000000000000000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nameEn: 'Ghost Route' })

    expect([404, 500]).toContain(res.status)
  })
})

// ── Delete route (soft) ───────────────────────────────────────────────────────

describe('DELETE /api/admin/routes/:id', () => {
  test('as admin → 200, isActive becomes false', async () => {
    const route = await Route.create({
      routeId: `DELETE-TEST-${Date.now()}`,
      type: 'microbus',
      nameAr: 'خط للحذف',
      nameEn: 'Route To Delete',
      origin: { nameAr: 'أ', nameEn: 'A' },
      destination: { nameAr: 'ب', nameEn: 'B' },
      stations: [
        { order: 1, nameAr: 'أ', nameEn: 'A' },
        { order: 2, nameAr: 'ب', nameEn: 'B' },
      ],
      fare: { min: 3, max: 5 },
    })

    const res = await request(app)
      .delete(`/api/admin/routes/${route._id}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)

    const updated = await Route.findById(route._id)
    expect(updated.isActive).toBe(false)
  })
})

// ── Stats ─────────────────────────────────────────────────────────────────────

describe('GET /api/admin/stats', () => {
  test('as admin → 200 with required stat fields', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.stats).toHaveProperty('totalRoutes')
    expect(res.body.stats).toHaveProperty('totalUsers')
    expect(res.body.stats).toHaveProperty('totalRatings')
    expect(res.body.stats).toHaveProperty('topSearched')
    expect(Array.isArray(res.body.stats.topSearched)).toBe(true)
  })
})
