const { MongoMemoryServer } = require('mongodb-memory-server')
const mongoose = require('mongoose')
const request = require('supertest')
const app = require('../../app')
const { User } = require('../models/index.js')

let mongod

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await User.deleteMany({})
})

// ── Helpers ──────────────────────────────────────────────────────────────────

const validUser = {
  name: 'أحمد علي',
  email: 'ahmed@example.com',
  password: 'Secret123',
}

async function registerUser(overrides = {}) {
  return request(app)
    .post('/api/auth/register')
    .send({ ...validUser, ...overrides })
}

async function loginUser(email = validUser.email, password = validUser.password) {
  return request(app).post('/api/auth/login').send({ email, password })
}

// ── Register ─────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  test('valid data → 201 with tokens and user object', async () => {
    const res = await registerUser()
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.accessToken).toBeDefined()
    expect(res.body.refreshToken).toBeDefined()
    expect(res.body.user.email).toBe(validUser.email)
    expect(res.body.user.passwordHash).toBeUndefined()
  })

  test('duplicate email → 409', async () => {
    await registerUser()
    const res = await registerUser()
    expect(res.status).toBe(409)
  })

  test('weak password (no uppercase) → 400', async () => {
    const res = await registerUser({ password: 'weakpass1' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  test('missing name → 400', async () => {
    const res = await registerUser({ name: undefined })
    expect(res.status).toBe(400)
  })

  test('invalid email → 400', async () => {
    const res = await registerUser({ email: 'not-an-email' })
    expect(res.status).toBe(400)
  })
})

// ── Login ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await registerUser()
  })

  test('correct credentials → 200 with tokens', async () => {
    const res = await loginUser()
    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeDefined()
    expect(res.body.refreshToken).toBeDefined()
  })

  test('wrong password → 401', async () => {
    const res = await loginUser(validUser.email, 'WrongPass999')
    expect(res.status).toBe(401)
  })

  test('unknown email → 401', async () => {
    const res = await loginUser('nobody@example.com', 'Secret123')
    expect(res.status).toBe(401)
  })
})

// ── Refresh ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  test('valid refreshToken → 200 with new accessToken', async () => {
    const reg = await registerUser()
    const { refreshToken } = reg.body

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken })
    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeDefined()
    expect(res.body.refreshToken).toBeDefined()
  })

  test('invalid token → 401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'garbage.token.here' })
    expect(res.status).toBe(401)
  })
})

// ── Me ────────────────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  test('valid Bearer token → 200 user without passwordHash', async () => {
    const reg = await registerUser()
    const { accessToken } = reg.body

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(validUser.email)
    expect(res.body.user.passwordHash).toBeUndefined()
    expect(res.body.user.refreshToken).toBeUndefined()
  })

  test('no token → 401', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})

// ── Logout ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  test('valid token → 200, refreshToken nulled in DB', async () => {
    const reg = await registerUser()
    const { accessToken, user } = reg.body

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const dbUser = await User.findById(user._id)
    expect(dbUser.refreshToken).toBeNull()
  })
})
