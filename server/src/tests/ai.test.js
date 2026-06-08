const { MongoMemoryServer } = require('mongodb-memory-server')
const mongoose = require('mongoose')
const request = require('supertest')
const app = require('../../app')
const { Route } = require('../models/index.js')

// ── Mock OpenAI ───────────────────────────────────────────────────────────────

jest.mock('openai', () => {
  const mockStream = {
    [Symbol.asyncIterator]: async function* () {
      yield { choices: [{ delta: { content: 'يا فنان، ' } }] }
      yield { choices: [{ delta: { content: 'روح المندرة خد مشروع.' } }] }
    },
  }

  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue(mockStream),
      },
    },
  }))
})

let mongod
let accessToken

const testRoute = {
  routeId: 'AI-TEST-01',
  type: 'microbus',
  nameAr: 'خط المندرة - الرمل',
  nameEn: 'Mandara - Raml',
  origin: { nameAr: 'المندرة', nameEn: 'Mandara', coords: { lat: 0, lng: 0 } },
  destination: { nameAr: 'الرمل', nameEn: 'Raml', coords: { lat: 0, lng: 0 } },
  stations: [
    { order: 1, nameAr: 'المندرة', nameEn: 'Mandara', coords: { lat: 0, lng: 0 } },
    { order: 2, nameAr: 'الرمل', nameEn: 'Raml', coords: { lat: 0, lng: 0 } },
  ],
  fare: { min: 5, max: 8 },
  peakHours: ['8:00–10:00'],
  tips: ['خد بالك من الزحمة'],
  verified: true,
  isActive: true,
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await Route.create(testRoute)

  const regRes = await request(app).post('/api/auth/register').send({
    name: 'مستخدم AI',
    email: 'aiuser@example.com',
    password: 'Secret123',
  })
  accessToken = regRes.body.accessToken
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/ai/ask', () => {
  const validBody = {
    origin: 'المندرة',
    destination: 'الرمل',
    message: 'إزاي أوصل من المندرة للرمل؟',
  }

  test('without auth → 401 JSON response', async () => {
    const res = await request(app).post('/api/ai/ask').send(validBody)
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  test('missing origin → 400 JSON BEFORE SSE headers', async () => {
    const res = await request(app)
      .post('/api/ai/ask')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ destination: 'الرمل', message: 'كيف أوصل؟' })

    expect(res.status).toBe(400)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body.success).toBe(false)
  })

  test('missing destination → 400 JSON', async () => {
    const res = await request(app)
      .post('/api/ai/ask')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ origin: 'المندرة', message: 'كيف أوصل؟' })

    expect(res.status).toBe(400)
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  test('message over 500 chars → 400 JSON', async () => {
    const res = await request(app)
      .post('/api/ai/ask')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...validBody, message: 'أ'.repeat(501) })

    expect(res.status).toBe(400)
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  test('valid request → response has Content-Type: text/event-stream', async () => {
    const res = await request(app)
      .post('/api/ai/ask')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validBody)

    expect(res.headers['content-type']).toMatch(/text\/event-stream/)
  })

  test('valid request → DB query runs with correct filters', async () => {
    const routeFindSpy = jest.spyOn(Route, 'find')

    await request(app)
      .post('/api/ai/ask')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validBody)

    expect(routeFindSpy).toHaveBeenCalled()
    const callArgs = routeFindSpy.mock.calls[routeFindSpy.mock.calls.length - 1][0]
    expect(callArgs).toHaveProperty('isActive', true)
    expect(callArgs.$or).toBeDefined()

    routeFindSpy.mockRestore()
  })

  test('valid request → context injected into system prompt sent to OpenAI', async () => {
    const OpenAI = require('openai')
    const instance = new OpenAI()
    const createSpy = instance.chat.completions.create

    await request(app)
      .post('/api/ai/ask')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validBody)

    expect(createSpy).toHaveBeenCalled()
    const callArgs = createSpy.mock.calls[createSpy.mock.calls.length - 1][0]
    const systemMessage = callArgs.messages.find((m) => m.role === 'system')
    expect(systemMessage).toBeDefined()
    expect(systemMessage.content).toContain('خط:')
  })
})
