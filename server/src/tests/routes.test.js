const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../../app");
const {
  Route,
  SavedTravelPlan,
  User,
  SearchHistory,
} = require("../models/index.js");
const {
  buildRoutePayloadFromLegacyRoute,
  extractRouteFields,
  syncRouteLocations,
} = require("../utils/routeNetwork.js");

let mongod;
let accessToken;
let userId;

// ── Route fixtures ────────────────────────────────────────────────────────────

const route1Data = {
  routeId: "TEST-MICRO-01",
  type: "microbus",
  nameAr: "خط المندرة - محطة مصر",
  nameEn: "Mandara - Mahattat Masr",
  origin: {
    nameAr: "المندرة",
    nameEn: "Mandara",
    coords: { lat: 31.29, lng: 30.02 },
  },
  destination: {
    nameAr: "محطة مصر",
    nameEn: "Mahattat Masr",
    coords: { lat: 31.19, lng: 29.9 },
  },
  stations: [
    {
      order: 1,
      nameAr: "المندرة",
      nameEn: "Mandara",
      coords: { lat: 31.29, lng: 30.02 },
    },
    {
      order: 2,
      nameAr: "سيدي بشر",
      nameEn: "Sidi Bishr",
      coords: { lat: 0, lng: 0 },
    },
    {
      order: 3,
      nameAr: "محطة مصر",
      nameEn: "Mahattat Masr",
      coords: { lat: 31.19, lng: 29.9 },
    },
  ],
  fare: { min: 5, max: 8 },
  peakHours: ["8:00–10:00", "16:00–19:00"],
  tips: ["تجنب أوقات الذروة"],
  verified: true,
  isActive: true,
};

const route2Data = {
  routeId: "TEST-MICRO-02",
  type: "microbus",
  nameAr: "خط أبو قير - الرمل",
  nameEn: "Abu Qir - Raml",
  origin: {
    nameAr: "أبو قير",
    nameEn: "Abu Qir",
    coords: { lat: 31.32, lng: 30.06 },
  },
  destination: {
    nameAr: "الرمل",
    nameEn: "Raml",
    coords: { lat: 31.2, lng: 29.91 },
  },
  stations: [
    {
      order: 1,
      nameAr: "أبو قير",
      nameEn: "Abu Qir",
      coords: { lat: 31.32, lng: 30.06 },
    },
    {
      order: 2,
      nameAr: "المندرة",
      nameEn: "Mandara",
      coords: { lat: 0, lng: 0 },
    },
    {
      order: 3,
      nameAr: "الرمل",
      nameEn: "Raml",
      coords: { lat: 31.2, lng: 29.91 },
    },
  ],
  fare: { min: 6, max: 10 },
  peakHours: ["7:00–9:00"],
  tips: [],
  verified: false,
  isActive: true,
};

async function seedLegacyRoute(routeLike) {
  const payload = buildRoutePayloadFromLegacyRoute(routeLike);
  const route = new Route(extractRouteFields(payload));
  await syncRouteLocations(route, payload);
  return route;
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const routePayloads = [route1Data, route2Data].map((route) =>
    buildRoutePayloadFromLegacyRoute(route),
  );
  const seededRoutes = [];
  for (const payload of routePayloads) {
    const route = new Route(extractRouteFields(payload));
    await syncRouteLocations(route, payload);
    seededRoutes.push(route);
  }

  const regRes = await request(app).post("/api/auth/register").send({
    name: "مستخدم تجريبي",
    email: "test@example.com",
    password: "Secret123",
  });
  accessToken = regRes.body.accessToken;
  userId = regRes.body.user._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await SearchHistory.deleteMany({});
  await SavedTravelPlan.deleteMany({});
  await User.findByIdAndUpdate(userId, { savedRoutes: [] });
});

// ── Search ────────────────────────────────────────────────────────────────────

describe("GET /api/routes/search", () => {
  test("valid origin + destination → 200 with results array including accuracyStats", async () => {
    const res = await request(app)
      .get("/api/routes/search")
      .query({ origin: "المندرة", destination: "محطة مصر" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBeGreaterThanOrEqual(1);
    expect(res.body.results[0]).toHaveProperty("accuracyStats");
    expect(res.body.results[0]).toHaveProperty("route");
  });

  test("authenticated user → saves SearchHistory record", async () => {
    await request(app)
      .get("/api/routes/search")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ origin: "المندرة", destination: "محطة مصر" });

    const history = await SearchHistory.findOne({ user: userId });
    expect(history).not.toBeNull();
    expect(history.originQuery).toBe("المندرة");
  });

  test("unauthenticated user → does NOT save SearchHistory", async () => {
    await request(app)
      .get("/api/routes/search")
      .query({ origin: "المندرة", destination: "محطة مصر" });

    const count = await SearchHistory.countDocuments();
    expect(count).toBe(0);
  });

  test("missing origin → 400", async () => {
    const res = await request(app)
      .get("/api/routes/search")
      .query({ destination: "محطة مصر" });
    expect(res.status).toBe(400);
  });

  test("regex metacharacters in search input do not crash the endpoint", async () => {
    const res = await request(app)
      .get("/api/routes/search")
      .query({ origin: "[", destination: "محطة مصر" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  test("current-location search with destination → returns nearest routes with distanceMeters", async () => {
    const res = await request(app)
      .get("/api/routes/search")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ originLat: 31.19, originLng: 29.9, destination: "محطة مصر" });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBeGreaterThanOrEqual(1);
    expect(res.body.results[0]).toHaveProperty("route");
    expect(res.body.results[0].route).toHaveProperty("distanceMeters");
    expect(res.body.results[0].route.distanceMeters).toBeGreaterThanOrEqual(0);
    expect(await SearchHistory.countDocuments({ user: userId })).toBe(1);
  });

  test("direction-aware search excludes one-way reverse-only lines", async () => {
    const reverseOnlyPayload = buildRoutePayloadFromLegacyRoute({
      routeId: "TEST-MICRO-REV-01",
      type: "microbus",
      direction: "one_way",
      nameAr: "خط عكسي فقط",
      nameEn: "Reverse Only Line",
      origin: {
        nameAr: "محطة مصر",
        nameEn: "Mahattat Masr",
        coords: { lat: 31.19, lng: 29.9 },
      },
      destination: {
        nameAr: "المندرة",
        nameEn: "Mandara",
        coords: { lat: 31.29, lng: 30.02 },
      },
      stations: [
        {
          order: 1,
          nameAr: "محطة مصر",
          nameEn: "Mahattat Masr",
          coords: { lat: 31.19, lng: 29.9 },
        },
        {
          order: 2,
          nameAr: "سيدي بشر",
          nameEn: "Sidi Bishr",
          coords: { lat: 0, lng: 0 },
        },
        {
          order: 3,
          nameAr: "المندرة",
          nameEn: "Mandara",
          coords: { lat: 31.29, lng: 30.02 },
        },
      ],
      fare: { min: 5, max: 8 },
      verified: true,
      isActive: true,
    });
    const reverseOnlyRoute = new Route(extractRouteFields(reverseOnlyPayload));
    await syncRouteLocations(reverseOnlyRoute, reverseOnlyPayload);

    const res = await request(app)
      .get("/api/routes/search")
      .query({ origin: "المندرة", destination: "محطة مصر" });

    expect(res.status).toBe(200);
    const routeIds = res.body.results.map((item) => item.route.routeId);
    expect(routeIds).toContain("TEST-MICRO-01");
    expect(routeIds).not.toContain("TEST-MICRO-REV-01");
  });

  test("direct search keeps the full route and marks the matched origin/destination points", async () => {
    const res = await request(app)
      .get("/api/routes/search")
      .query({ origin: "المندرة", destination: "محطة مصر" });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);

    const matchedRoute = res.body.results[0].route;
    expect(matchedRoute.stops.map((point) => point.nameAr)).toEqual([
      "المندرة",
      "سيدي بشر",
      "محطة مصر",
    ]);
    expect(matchedRoute.geometry.type).toBe("LineString");
    expect(Array.isArray(matchedRoute.mapPoints)).toBe(true);
    expect(matchedRoute.matchedSegment).toMatchObject({
      originIndex: 0,
      destinationIndex: 2,
      originStopId: expect.any(String),
      destinationStopId: expect.any(String),
    });
  });

  test("returns one-transfer travelPlan when no direct route exists", async () => {
    await seedLegacyRoute({
      routeId: "TEST-TRANSFER-01",
      type: "microbus",
      direction: "one_way",
      nameAr: "خط بحري - سيدي جابر",
      nameEn: "Bahary - Sidi Gaber",
      origin: {
        nameAr: "بحري",
        nameEn: "Bahary",
        coords: { lat: 31.21, lng: 29.88 },
      },
      destination: {
        nameAr: "سيدي جابر",
        nameEn: "Sidi Gaber",
        coords: { lat: 31.22, lng: 29.94 },
      },
      stations: [
        {
          order: 1,
          nameAr: "بحري",
          nameEn: "Bahary",
          coords: { lat: 31.21, lng: 29.88 },
        },
        {
          order: 2,
          nameAr: "سيدي جابر",
          nameEn: "Sidi Gaber",
          coords: { lat: 31.22, lng: 29.94 },
        },
      ],
      fare: { min: 4, max: 6 },
      verified: true,
      isActive: true,
    });
    await seedLegacyRoute({
      routeId: "TEST-TRANSFER-02",
      type: "train",
      direction: "one_way",
      nameAr: "خط سيدي جابر - المعمورة",
      nameEn: "Sidi Gaber - Maamoura",
      origin: {
        nameAr: "سيدي جابر",
        nameEn: "Sidi Gaber",
        coords: { lat: 31.22, lng: 29.94 },
      },
      destination: {
        nameAr: "المعمورة",
        nameEn: "Maamoura",
        coords: { lat: 31.29, lng: 30.03 },
      },
      stations: [
        {
          order: 1,
          nameAr: "سيدي جابر",
          nameEn: "Sidi Gaber",
          coords: { lat: 31.22, lng: 29.94 },
          allowDropoff: false,
        },
        {
          order: 2,
          nameAr: "المعمورة",
          nameEn: "Maamoura",
          coords: { lat: 31.29, lng: 30.03 },
        },
      ],
      fare: { min: 7, max: 10 },
      verified: true,
      isActive: true,
    });

    const res = await request(app)
      .get("/api/routes/search")
      .query({ origin: "بحري", destination: "المعمورة" });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].travelPlanType).toBe("transfer");
    expect(res.body.results[0].transferCount).toBe(1);
    expect(res.body.results[0].transferPlace.nameAr).toBe("سيدي جابر");
    expect(res.body.results[0].totalFare.min).toBe(11);
    expect(res.body.results[0].travelSegments).toHaveLength(2);
    expect(res.body.results[0].travelSegments[0].route.routeId).toBe("TEST-TRANSFER-01");
    expect(res.body.results[0].travelSegments[1].route.routeId).toBe("TEST-TRANSFER-02");
  });

  test("returns direct routes only when direct and one-transfer options both exist", async () => {
    await seedLegacyRoute({
      routeId: "TEST-BOTH-TRANSFER-01",
      type: "microbus",
      direction: "one_way",
      nameAr: "خط محطة مصر - سيدي جابر",
      nameEn: "Mahattat Masr - Sidi Gaber",
      stations: [
        {
          order: 1,
          nameAr: "محطة مصر",
          nameEn: "Mahattat Masr",
          coords: { lat: 31.2, lng: 29.9 },
        },
        {
          order: 2,
          nameAr: "سيدي جابر",
          nameEn: "Sidi Gaber",
          coords: { lat: 31.22, lng: 29.94 },
        },
      ],
      fare: { min: 4, max: 6 },
      verified: true,
      isActive: true,
    });
    await seedLegacyRoute({
      routeId: "TEST-BOTH-TRANSFER-02",
      type: "bus",
      direction: "one_way",
      nameAr: "خط سيدي جابر - محطة فيكتوريا",
      nameEn: "Sidi Gaber - Victoria",
      stations: [
        {
          order: 1,
          nameAr: "سيدي جابر",
          nameEn: "Sidi Gaber",
          coords: { lat: 31.22, lng: 29.94 },
        },
        {
          order: 2,
          nameAr: "محطة فيكتوريا",
          nameEn: "Victoria",
          coords: { lat: 31.24, lng: 29.97 },
        },
      ],
      fare: { min: 6, max: 9 },
      verified: true,
      isActive: true,
    });
    await seedLegacyRoute({
      routeId: "TEST-BOTH-DIRECT-01",
      type: "tram",
      direction: "one_way",
      nameAr: "خط محطة مصر - محطة فيكتوريا",
      nameEn: "Mahattat Masr - Victoria",
      stations: [
        {
          order: 1,
          nameAr: "محطة مصر",
          nameEn: "Mahattat Masr",
          coords: { lat: 31.2, lng: 29.9 },
        },
        {
          order: 2,
          nameAr: "محطة فيكتوريا",
          nameEn: "Victoria",
          coords: { lat: 31.24, lng: 29.97 },
        },
      ],
      fare: { min: 7, max: 11 },
      verified: true,
      isActive: true,
    });

    const res = await request(app)
      .get("/api/routes/search")
      .query({ origin: "محطة مصر", destination: "محطة فيكتوريا" });

    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThanOrEqual(1);
    expect(
      res.body.results.every((result) => result.travelPlanType === "direct"),
    ).toBe(true);
  });

  test("returns only the single best one-transfer travelPlan when no direct route exists", async () => {
    await seedLegacyRoute({
      routeId: "TEST-LIMIT-FIRST-01",
      type: "microbus",
      direction: "one_way",
      nameAr: "خط البداية - ألف",
      nameEn: "Start - Alef",
      stations: [
        {
          order: 1,
          nameAr: "بداية مشتركة",
          nameEn: "Shared Start",
          coords: { lat: 31.11, lng: 29.81 },
        },
        {
          order: 2,
          nameAr: "محطة ألف",
          nameEn: "Alef",
          coords: { lat: 31.12, lng: 29.82 },
        },
      ],
      fare: { min: 3, max: 4 },
      verified: true,
      isActive: true,
    });
    await seedLegacyRoute({
      routeId: "TEST-LIMIT-FIRST-02",
      type: "microbus",
      direction: "one_way",
      nameAr: "خط البداية - باء",
      nameEn: "Start - Baa",
      stations: [
        {
          order: 1,
          nameAr: "بداية مشتركة",
          nameEn: "Shared Start",
          coords: { lat: 31.11, lng: 29.81 },
        },
        {
          order: 2,
          nameAr: "محطة باء",
          nameEn: "Baa",
          coords: { lat: 31.115, lng: 29.825 },
        },
      ],
      fare: { min: 3, max: 4 },
      verified: true,
      isActive: true,
    });
    await seedLegacyRoute({
      routeId: "TEST-LIMIT-FIRST-03",
      type: "microbus",
      direction: "one_way",
      nameAr: "خط البداية - جيم",
      nameEn: "Start - Jeem",
      stations: [
        {
          order: 1,
          nameAr: "بداية مشتركة",
          nameEn: "Shared Start",
          coords: { lat: 31.11, lng: 29.81 },
        },
        {
          order: 2,
          nameAr: "محطة جيم",
          nameEn: "Jeem",
          coords: { lat: 31.13, lng: 29.84 },
        },
      ],
      fare: { min: 3, max: 4 },
      verified: true,
      isActive: true,
    });
    await seedLegacyRoute({
      routeId: "TEST-LIMIT-SECOND-01",
      type: "bus",
      direction: "one_way",
      nameAr: "خط ألف - الوجهة",
      nameEn: "Alef - End",
      stations: [
        {
          order: 1,
          nameAr: "محطة ألف",
          nameEn: "Alef",
          coords: { lat: 31.12, lng: 29.82 },
        },
        {
          order: 2,
          nameAr: "وجهة مشتركة نهائية",
          nameEn: "Shared End",
          coords: { lat: 31.15, lng: 29.87 },
        },
      ],
      fare: { min: 4, max: 5 },
      verified: true,
      isActive: true,
    });
    await seedLegacyRoute({
      routeId: "TEST-LIMIT-SECOND-02",
      type: "bus",
      direction: "one_way",
      nameAr: "خط باء - الوجهة",
      nameEn: "Baa - End",
      stations: [
        {
          order: 1,
          nameAr: "محطة باء",
          nameEn: "Baa",
          coords: { lat: 31.115, lng: 29.825 },
        },
        {
          order: 2,
          nameAr: "وجهة مشتركة نهائية",
          nameEn: "Shared End",
          coords: { lat: 31.15, lng: 29.87 },
        },
      ],
      fare: { min: 4, max: 5 },
      verified: true,
      isActive: true,
    });
    await seedLegacyRoute({
      routeId: "TEST-LIMIT-SECOND-03",
      type: "bus",
      direction: "one_way",
      nameAr: "خط جيم - الوجهة",
      nameEn: "Jeem - End",
      stations: [
        {
          order: 1,
          nameAr: "محطة جيم",
          nameEn: "Jeem",
          coords: { lat: 31.13, lng: 29.84 },
        },
        {
          order: 2,
          nameAr: "وجهة مشتركة نهائية",
          nameEn: "Shared End",
          coords: { lat: 31.15, lng: 29.87 },
        },
      ],
      fare: { min: 4, max: 5 },
      verified: true,
      isActive: true,
    });

    const res = await request(app)
      .get("/api/routes/search")
      .query({ origin: "بداية مشتركة", destination: "وجهة مشتركة نهائية" });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(
      res.body.results.every(
        (result) => result.travelPlanType === "transfer" && result.transferCount === 1,
      ),
    ).toBe(true);
  });

  test("falls back to deeper multi-travelSegment travelPlans only when direct and one-transfer options do not exist", async () => {
    await seedLegacyRoute({
      routeId: "TEST-CHAIN-01",
      type: "microbus",
      direction: "one_way",
      nameAr: "خط البداية - ألف",
      nameEn: "Start - Alef",
      stations: [
        {
          order: 1,
          nameAr: "نقطة البداية",
          nameEn: "Start",
          coords: { lat: 31.12, lng: 29.8 },
        },
        {
          order: 2,
          nameAr: "محطة ألف",
          nameEn: "Alef",
          coords: { lat: 31.14, lng: 29.84 },
        },
      ],
      fare: { min: 3, max: 4 },
      verified: true,
      isActive: true,
    });
    await seedLegacyRoute({
      routeId: "TEST-CHAIN-02",
      type: "bus",
      direction: "one_way",
      nameAr: "خط ألف - باء",
      nameEn: "Alef - Baa",
      stations: [
        {
          order: 1,
          nameAr: "محطة ألف",
          nameEn: "Alef",
          coords: { lat: 31.14, lng: 29.84 },
        },
        {
          order: 2,
          nameAr: "محطة باء",
          nameEn: "Baa",
          coords: { lat: 31.16, lng: 29.88 },
        },
      ],
      fare: { min: 4, max: 6 },
      verified: true,
      isActive: true,
    });
    await seedLegacyRoute({
      routeId: "TEST-CHAIN-03",
      type: "tram",
      direction: "one_way",
      nameAr: "خط باء - الوجهة",
      nameEn: "Baa - End",
      stations: [
        {
          order: 1,
          nameAr: "محطة باء",
          nameEn: "Baa",
          coords: { lat: 31.16, lng: 29.88 },
        },
        {
          order: 2,
          nameAr: "نقطة النهاية",
          nameEn: "End",
          coords: { lat: 31.18, lng: 29.92 },
        },
      ],
      fare: { min: 5, max: 7 },
      verified: true,
      isActive: true,
    });
    await seedLegacyRoute({
      routeId: "TEST-CHAIN-04",
      type: "train",
      direction: "one_way",
      nameAr: "خط باء - جيم",
      nameEn: "Baa - Jeem",
      stations: [
        {
          order: 1,
          nameAr: "محطة باء",
          nameEn: "Baa",
          coords: { lat: 31.16, lng: 29.88 },
        },
        {
          order: 2,
          nameAr: "محطة جيم",
          nameEn: "Jeem",
          coords: { lat: 31.17, lng: 29.89 },
        },
      ],
      fare: { min: 5, max: 6 },
      verified: true,
      isActive: true,
    });
    await seedLegacyRoute({
      routeId: "TEST-CHAIN-05",
      type: "microbus",
      direction: "one_way",
      nameAr: "خط جيم - الوجهة",
      nameEn: "Jeem - End",
      stations: [
        {
          order: 1,
          nameAr: "محطة جيم",
          nameEn: "Jeem",
          coords: { lat: 31.17, lng: 29.89 },
        },
        {
          order: 2,
          nameAr: "نقطة النهاية",
          nameEn: "End",
          coords: { lat: 31.18, lng: 29.92 },
        },
      ],
      fare: { min: 4, max: 5 },
      verified: true,
      isActive: true,
    });

    const res = await request(app)
      .get("/api/routes/search")
      .query({ origin: "نقطة البداية", destination: "نقطة النهاية" });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(
      res.body.results.every(
        (result) =>
          result.travelPlanType === "transfer" &&
          result.transferCount === 2 &&
          result.travelSegments?.length === 3,
      ),
    ).toBe(true);
    expect(
      res.body.results.every((result) => result.transferWalks?.length === 2),
    ).toBe(true);
    expect(
      res.body.results.every((result) =>
        result.travelSegments.every((travelSegment) => travelSegment.route?.routeId),
      ),
    ).toBe(true);
  });

  test("same shared location can allow pickup on one route and block it on another", async () => {
    const blockedPickupPayload = buildRoutePayloadFromLegacyRoute({
      routeId: "TEST-PICKUP-BLOCKED-01",
      type: "microbus",
      direction: "one_way",
      nameAr: "خط ممنوع ركوب",
      nameEn: "Blocked Pickup Route",
      stations: [
        {
          order: 1,
          nameAr: "محطة مشتركة",
          nameEn: "Shared Stop",
          coords: { lat: 31.23, lng: 29.96 },
          allowPickup: false,
        },
        {
          order: 2,
          nameAr: "وجهة مشتركة",
          nameEn: "Shared Destination",
          coords: { lat: 31.27, lng: 29.98 },
        },
      ],
      fare: { min: 4, max: 6 },
      verified: true,
      isActive: true,
    });

    const allowedPickupPayload = buildRoutePayloadFromLegacyRoute({
      routeId: "TEST-PICKUP-ALLOWED-01",
      type: "microbus",
      direction: "one_way",
      nameAr: "خط مسموح ركوب",
      nameEn: "Allowed Pickup Route",
      stations: [
        {
          order: 1,
          nameAr: "محطة مشتركة",
          nameEn: "Shared Stop",
          coords: { lat: 31.23, lng: 29.96 },
          allowPickup: true,
        },
        {
          order: 2,
          nameAr: "وجهة مشتركة",
          nameEn: "Shared Destination",
          coords: { lat: 31.27, lng: 29.98 },
        },
      ],
      fare: { min: 5, max: 7 },
      verified: true,
      isActive: true,
    });

    const blockedRoute = new Route(extractRouteFields(blockedPickupPayload));
    const allowedRoute = new Route(extractRouteFields(allowedPickupPayload));
    await syncRouteLocations(blockedRoute, blockedPickupPayload);
    await syncRouteLocations(allowedRoute, allowedPickupPayload);

    const res = await request(app)
      .get("/api/routes/search")
      .query({ origin: "محطة مشتركة", destination: "وجهة مشتركة" });

    expect(res.status).toBe(200);
    const routeIds = res.body.results.map((item) => item.route.routeId);
    expect(routeIds).toContain("TEST-PICKUP-ALLOWED-01");
    expect(routeIds).not.toContain("TEST-PICKUP-BLOCKED-01");
  });
});

// ── Stations ──────────────────────────────────────────────────────────────────

describe("GET /api/routes/near-me", () => {
  test("uses the nearest station even when it is a middle station", async () => {
    await seedLegacyRoute({
      routeId: "TEST-NEAREST-MIDDLE-01",
      type: "microbus",
      direction: "one_way",
      nameAr: "Nearest Middle Route",
      nameEn: "Nearest Middle Route",
      origin: {
        nameAr: "Far Start",
        nameEn: "Far Start",
        coords: { lat: 31.0, lng: 29.7 },
      },
      destination: {
        nameAr: "Far End",
        nameEn: "Far End",
        coords: { lat: 31.5, lng: 30.2 },
      },
      stations: [
        {
          order: 1,
          nameAr: "Far Start",
          nameEn: "Far Start",
          coords: { lat: 31.0, lng: 29.7 },
        },
        {
          order: 2,
          nameAr: "Middle Nearest Station",
          nameEn: "Middle Nearest Station",
          coords: { lat: 31.234, lng: 29.934 },
        },
        {
          order: 3,
          nameAr: "Far End",
          nameEn: "Far End",
          coords: { lat: 31.5, lng: 30.2 },
        },
      ],
      fare: { min: 5, max: 10 },
      verified: true,
      isActive: true,
    });

    const res = await request(app)
      .get("/api/routes/near-me")
      .query({ lat: 31.2341, lng: 29.9341 });

    expect(res.status).toBe(200);
    const match = res.body.results.find((result) => result.route.routeId === "TEST-NEAREST-MIDDLE-01");
    expect(match).toBeDefined();
    expect(match.route.nearestStation.nameEn).toBe("Middle Nearest Station");
    expect(match.route.distanceMeters).toBeLessThan(30);
    expect(match.travelSegments[0].boardAt.nameEn).toBe("Middle Nearest Station");
  });
});

describe("GET /api/routes/stations", () => {
  test("returns 200 with array of Arabic strings", async () => {
    const res = await request(app).get("/api/routes/stations");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.stations)).toBe(true);
    res.body.stations.forEach((s) => expect(typeof s).toBe("string"));
  });

  test("includes stations from both test routes", async () => {
    const res = await request(app).get("/api/routes/stations");
    expect(res.body.stations).toContain("المندرة");
    expect(res.body.stations).toContain("أبو قير");
    expect(res.body.stations).toContain("الرمل");
  });

  test("stations autocomplete includes every saved stop location", async () => {
    const middlePointPayload = buildRoutePayloadFromLegacyRoute({
      routeId: "TEST-STOPS-ALL-01",
      type: "microbus",
      direction: "one_way",
      nameAr: "خط كل المحطات",
      nameEn: "All Stops Route",
      stations: [
        {
          order: 1,
          nameAr: "بداية افتراضية",
          nameEn: "Default Start",
          coords: { lat: 31.2, lng: 29.91 },
        },
        {
          order: 2,
          nameAr: "نقطة وسط افتراضية",
          nameEn: "Default Mid",
          coords: { lat: 31.21, lng: 29.92 },
        },
        {
          order: 3,
          nameAr: "نهاية افتراضية",
          nameEn: "Default End",
          coords: { lat: 31.22, lng: 29.93 },
        },
      ],
      fare: { min: 3, max: 5 },
      verified: true,
      isActive: true,
    });
    const middlePointRoute = new Route(extractRouteFields(middlePointPayload));
    await syncRouteLocations(middlePointRoute, middlePointPayload);

    const stationsRes = await request(app).get("/api/routes/stations");
    expect(stationsRes.status).toBe(200);
    expect(stationsRes.body.stations).toContain("بداية افتراضية");
    expect(stationsRes.body.stations).toContain("نقطة وسط افتراضية");
    expect(stationsRes.body.stations).toContain("نهاية افتراضية");
  });

  test("stations autocomplete excludes stops that belong only to inactive routes", async () => {
    const inactivePayload = buildRoutePayloadFromLegacyRoute({
      routeId: "TEST-INACTIVE-STATION-01",
      type: "microbus",
      direction: "one_way",
      stations: [
        {
          order: 1,
          nameAr: "محطة مخفية",
          nameEn: "Hidden Stop",
          coords: { lat: 31.23, lng: 29.94 },
        },
        {
          order: 2,
          nameAr: "نهاية مخفية",
          nameEn: "Hidden End",
          coords: { lat: 31.24, lng: 29.95 },
        },
      ],
      fare: { min: 4, max: 6 },
      verified: true,
      isActive: false,
    });
    const inactiveRoute = new Route(extractRouteFields(inactivePayload));
    await syncRouteLocations(inactiveRoute, inactivePayload);

    const stationsRes = await request(app).get("/api/routes/stations");
    expect(stationsRes.status).toBe(200);
    expect(stationsRes.body.stations).not.toContain("محطة مخفية");
    expect(stationsRes.body.stations).not.toContain("نهاية مخفية");
  });

  test("route response returns geometry separately and reverses it with reverse direction", async () => {
    const geometryPayload = buildRoutePayloadFromLegacyRoute({
      routeId: "TEST-GEOMETRY-REV-01",
      type: "microbus",
      direction: "bidirectional",
      nameAr: "خط هندسي",
      nameEn: "Geometry Route",
      stations: [
        {
          order: 1,
          nameAr: "أول",
          nameEn: "First",
          coords: { lat: 31.2, lng: 29.91 },
        },
        {
          order: 2,
          nameAr: "ثاني",
          nameEn: "Second",
          coords: { lat: 31.21, lng: 29.92 },
        },
      ],
      geometry: {
        type: "LineString",
        coordinates: [
          [29.91, 31.2],
          [29.915, 31.205],
          [29.92, 31.21],
        ],
      },
      fare: { min: 3, max: 5 },
      verified: true,
      isActive: true,
    });
    const geometryRoute = new Route(extractRouteFields(geometryPayload));
    await syncRouteLocations(geometryRoute, geometryPayload);

    const forwardRes = await request(app).get("/api/routes/TEST-GEOMETRY-REV-01");
    const reverseRes = await request(app)
      .get("/api/routes/TEST-GEOMETRY-REV-01")
      .query({ direction: "reverse" });

    expect(forwardRes.status).toBe(200);
    expect(reverseRes.status).toBe(200);
    expect(forwardRes.body.route.mapPoints.map((point) => point.coords.lng)).toEqual([
      29.91,
      29.915,
      29.92,
    ]);
    expect(reverseRes.body.route.mapPoints.map((point) => point.coords.lng)).toEqual([
      29.92,
      29.915,
      29.91,
    ]);
  });
});

// ── History (new endpoint) ────────────────────────────────────────────────────

describe("GET /api/routes/history", () => {
  test("authenticated → 200 with history array", async () => {
    await request(app)
      .get("/api/routes/search")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ origin: "المندرة", destination: "محطة مصر" });

    const res = await request(app)
      .get("/api/routes/history")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.history)).toBe(true);
    expect(res.body.history.length).toBeGreaterThanOrEqual(1);
    expect(res.body.history[0].originQuery).toBe("المندرة");
  });

  test("no auth → 401", async () => {
    const res = await request(app).get("/api/routes/history");
    expect(res.status).toBe(401);
  });
});

// ── Saved Routes (new endpoint) ───────────────────────────────────────────────

describe("GET /api/routes/saved", () => {
  test("authenticated with saved routes → 200 with routes and accuracyStats", async () => {
    await request(app)
      .post("/api/routes/save/TEST-MICRO-01")
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await request(app)
      .get("/api/routes/saved")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.routes)).toBe(true);
    expect(Array.isArray(res.body.travelPlans)).toBe(true);
    expect(res.body.routes.length).toBe(1);
    expect(res.body.routes[0].routeId).toBe("TEST-MICRO-01");
    expect(res.body.routes[0]).toHaveProperty("accuracyStats");
  });

  test("authenticated with saved travelPlans → 200 with hydrated travelSegments", async () => {
    await seedLegacyRoute({
      routeId: "TEST-SAVED-TRANSFER-01",
      type: "microbus",
      direction: "one_way",
      nameAr: "خط البداية - سيدي جابر",
      nameEn: "Start - Sidi Gaber",
      stations: [
        {
          order: 1,
          nameAr: "بداية الحفظ",
          nameEn: "Saved Start",
          coords: { lat: 31.2, lng: 29.87 },
        },
        {
          order: 2,
          nameAr: "سيدي جابر",
          nameEn: "Sidi Gaber",
          coords: { lat: 31.22, lng: 29.94 },
        },
      ],
      fare: { min: 4, max: 6 },
      verified: true,
      isActive: true,
    });
    await seedLegacyRoute({
      routeId: "TEST-SAVED-TRANSFER-02",
      type: "tram",
      direction: "one_way",
      nameAr: "خط سيدي جابر - نهاية الحفظ",
      nameEn: "Sidi Gaber - Saved End",
      stations: [
        {
          order: 1,
          nameAr: "سيدي جابر",
          nameEn: "Sidi Gaber",
          coords: { lat: 31.22, lng: 29.94 },
        },
        {
          order: 2,
          nameAr: "نهاية الحفظ",
          nameEn: "Saved End",
          coords: { lat: 31.24, lng: 29.98 },
        },
      ],
      fare: { min: 5, max: 7 },
      verified: true,
      isActive: true,
    });

    const searchRes = await request(app)
      .get("/api/routes/search")
      .query({ origin: "بداية الحفظ", destination: "نهاية الحفظ" });

    const travelPlan = searchRes.body.results.find(
      (result) => result.travelPlanType === "transfer",
    );

    await request(app)
      .post("/api/routes/saved-travel-plans")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(travelPlan);

    const res = await request(app)
      .get("/api/routes/saved")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.travelPlans)).toBe(true);
    expect(res.body.travelPlans).toHaveLength(1);
    expect(res.body.travelPlans[0].travelPlanId).toBe(travelPlan.travelPlanId);
    expect(res.body.travelPlans[0].travelSegments).toHaveLength(2);
    expect(res.body.travelPlans[0].travelSegments[0].route.routeId).toBe(
      "TEST-SAVED-TRANSFER-01",
    );
    expect(res.body.travelPlans[0].travelSegments[1].route.routeId).toBe(
      "TEST-SAVED-TRANSFER-02",
    );
  });

  test("no auth → 401", async () => {
    const res = await request(app).get("/api/routes/saved");
    expect(res.status).toBe(401);
  });
});

// ── Get route by ID ───────────────────────────────────────────────────────────

describe("GET /api/routes/:routeId", () => {
  test("valid routeId → 200 with route and accuracyStats", async () => {
    const res = await request(app).get("/api/routes/TEST-MICRO-01");
    expect(res.status).toBe(200);
    expect(res.body.route.routeId).toBe("TEST-MICRO-01");
    expect(res.body).toHaveProperty("accuracyStats");
  });

  test("reverse direction → returns reversed terminal-based route name", async () => {
    const res = await request(app)
      .get("/api/routes/TEST-MICRO-01")
      .query({ direction: "reverse" });

    expect(res.status).toBe(200);
    expect(res.body.route.nameAr).toBe("محطة مصر ← المندرة");
    expect(res.body.route.nameEn).toBe("Mahattat Masr → Mandara");
  });

  test("invalid routeId → 404", async () => {
    const res = await request(app).get("/api/routes/DOES-NOT-EXIST");
    expect(res.status).toBe(404);
  });
});

// ── Save / Unsave ─────────────────────────────────────────────────────────────

describe("POST /api/routes/save/:routeId", () => {
  test("with auth → 200, route appears in user savedRoutes", async () => {
    const res = await request(app)
      .post("/api/routes/save/TEST-MICRO-01")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);

    const user = await User.findById(userId).populate("savedRoutes");
    const routeIds = user.savedRoutes.map((r) => r.routeId);
    expect(routeIds).toContain("TEST-MICRO-01");
  });

  test("no auth → 401", async () => {
    const res = await request(app).post("/api/routes/save/TEST-MICRO-01");
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/routes/save/:routeId", () => {
  test("with auth → 200, route removed from savedRoutes", async () => {
    await request(app)
      .post("/api/routes/save/TEST-MICRO-01")
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await request(app)
      .delete("/api/routes/save/TEST-MICRO-01")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);

    const user = await User.findById(userId);
    expect(user.savedRoutes.length).toBe(0);
  });
});

describe("POST /api/routes/saved-travel-plans", () => {
  test("with auth → 200, transfer travelPlan is stored as a first-class saved travelPlan", async () => {
    await seedLegacyRoute({
      routeId: "TEST-SAVE-FIRST-01",
      type: "microbus",
      direction: "one_way",
      nameAr: "خط بداية الحفظ - محطة وسيطة",
      nameEn: "Save Start - Mid",
      stations: [
        {
          order: 1,
          nameAr: "بداية حفظ أولى",
          nameEn: "First Save Start",
          coords: { lat: 31.18, lng: 29.85 },
        },
        {
          order: 2,
          nameAr: "محطة وسيطة حفظ",
          nameEn: "Saved Mid",
          coords: { lat: 31.2, lng: 29.89 },
        },
      ],
      fare: { min: 4, max: 5 },
      verified: true,
      isActive: true,
    });
    await seedLegacyRoute({
      routeId: "TEST-SAVE-FIRST-02",
      type: "bus",
      direction: "one_way",
      nameAr: "خط محطة وسيطة - نهاية حفظ",
      nameEn: "Mid - Save End",
      stations: [
        {
          order: 1,
          nameAr: "محطة وسيطة حفظ",
          nameEn: "Saved Mid",
          coords: { lat: 31.2, lng: 29.89 },
        },
        {
          order: 2,
          nameAr: "نهاية حفظ أولى",
          nameEn: "First Save End",
          coords: { lat: 31.22, lng: 29.93 },
        },
      ],
      fare: { min: 5, max: 7 },
      verified: true,
      isActive: true,
    });

    const searchRes = await request(app)
      .get("/api/routes/search")
      .query({ origin: "بداية حفظ أولى", destination: "نهاية حفظ أولى" });

    const travelPlan = searchRes.body.results.find(
      (result) => result.travelPlanType === "transfer",
    );

    const res = await request(app)
      .post("/api/routes/saved-travel-plans")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(travelPlan);

    expect(res.status).toBe(200);
    expect(res.body.travelPlanId).toBe(travelPlan.travelPlanId);

    const savedTravelPlans = await SavedTravelPlan.find({ user: userId }).lean();
    expect(savedTravelPlans).toHaveLength(1);
    expect(savedTravelPlans[0].routeIds).toEqual([
      "TEST-SAVE-FIRST-01",
      "TEST-SAVE-FIRST-02",
    ]);
    expect(savedTravelPlans[0].travelSegments).toHaveLength(2);
    expect(savedTravelPlans[0].transferCount).toBe(1);
  });
});

describe("DELETE /api/routes/saved-travel-plans", () => {
  test("with auth → 200, saved travelPlan is removed without touching saved routes", async () => {
    await SavedTravelPlan.create({
      user: userId,
      travelPlanId: "manual-travelPlan-01",
      transferCount: 1,
      routeIds: ["TEST-MICRO-01", "TEST-MICRO-02"],
      travelSegments: [
        {
          routeId: "TEST-MICRO-01",
          selectedDirection: "forward",
          originStopId: "origin-1",
          destinationStopId: "mid-1",
        },
        {
          routeId: "TEST-MICRO-02",
          selectedDirection: "forward",
          originStopId: "mid-1",
          destinationStopId: "dest-1",
        },
      ],
    });
    await request(app)
      .post("/api/routes/save/TEST-MICRO-01")
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await request(app)
      .delete("/api/routes/saved-travel-plans")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ travelPlanId: "manual-travelPlan-01" });

    expect(res.status).toBe(200);
    expect(res.body.travelPlanId).toBe("manual-travelPlan-01");
    expect(await SavedTravelPlan.countDocuments({ user: userId })).toBe(0);

    const user = await User.findById(userId).populate("savedRoutes");
    expect(user.savedRoutes.map((route) => route.routeId)).toEqual([
      "TEST-MICRO-01",
    ]);
  });
});
