const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../../app");
const { Route, User, SearchHistory } = require("../models/index.js");
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

  test("returns one-transfer itinerary when no direct route exists", async () => {
    const firstLegPayload = buildRoutePayloadFromLegacyRoute({
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
    const secondLegPayload = buildRoutePayloadFromLegacyRoute({
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

    const firstLegRoute = new Route(extractRouteFields(firstLegPayload));
    const secondLegRoute = new Route(extractRouteFields(secondLegPayload));
    await syncRouteLocations(firstLegRoute, firstLegPayload);
    await syncRouteLocations(secondLegRoute, secondLegPayload);

    const res = await request(app)
      .get("/api/routes/search")
      .query({ origin: "بحري", destination: "المعمورة" });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].itineraryType).toBe("transfer");
    expect(res.body.results[0].transferCount).toBe(1);
    expect(res.body.results[0].transferPlace.nameAr).toBe("سيدي جابر");
    expect(res.body.results[0].totalFare.min).toBe(11);
    expect(res.body.results[0].legs).toHaveLength(2);
    expect(res.body.results[0].legs[0].route.routeId).toBe("TEST-TRANSFER-01");
    expect(res.body.results[0].legs[1].route.routeId).toBe("TEST-TRANSFER-02");
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

  test("excludes non-searchable inner path points from autocomplete", async () => {
    const hiddenPointPayload = buildRoutePayloadFromLegacyRoute({
      routeId: "TEST-HIDDEN-INNER-01",
      type: "microbus",
      direction: "one_way",
      nameAr: "خط نقطة داخلية",
      nameEn: "Inner Point Route",
      origin: {
        nameAr: "نقطة بداية",
        nameEn: "Start Point",
        coords: { lat: 31.24, lng: 29.95 },
      },
      destination: {
        nameAr: "نقطة نهاية",
        nameEn: "End Point",
        coords: { lat: 31.26, lng: 29.99 },
      },
      stations: [
        {
          order: 1,
          nameAr: "نقطة بداية",
          nameEn: "Start Point",
          coords: { lat: 31.24, lng: 29.95 },
        },
        {
          order: 2,
          nameAr: "نقطة داخلية مخفية",
          nameEn: "Hidden Inner Point",
          coords: { lat: 31.25, lng: 29.97 },
          isSearchable: false,
        },
        {
          order: 3,
          nameAr: "نقطة نهاية",
          nameEn: "End Point",
          coords: { lat: 31.26, lng: 29.99 },
        },
      ],
      fare: { min: 4, max: 6 },
      verified: true,
      isActive: true,
    });
    const hiddenPointRoute = new Route(extractRouteFields(hiddenPointPayload));
    await syncRouteLocations(hiddenPointRoute, hiddenPointPayload);

    const stationsRes = await request(app).get("/api/routes/stations");
    expect(stationsRes.status).toBe(200);
    expect(stationsRes.body.stations).not.toContain("نقطة داخلية مخفية");

    const routeRes = await request(app).get("/api/routes/TEST-HIDDEN-INNER-01");
    expect(routeRes.status).toBe(200);
    expect(routeRes.body.route.mapPoints.map((point) => point.nameAr)).toContain(
      "نقطة داخلية مخفية",
    );
  });

  test("defaults only first and last stops to searchable when flag is omitted", async () => {
    const defaultSearchablePayload = buildRoutePayloadFromLegacyRoute({
      routeId: "TEST-DEFAULT-SEARCHABLE-01",
      type: "microbus",
      direction: "one_way",
      nameAr: "خط افتراضي",
      nameEn: "Default Searchable Route",
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
    const defaultRoute = new Route(extractRouteFields(defaultSearchablePayload));
    await syncRouteLocations(defaultRoute, defaultSearchablePayload);

    const stationsRes = await request(app).get("/api/routes/stations");
    expect(stationsRes.status).toBe(200);
    expect(stationsRes.body.stations).toContain("بداية افتراضية");
    expect(stationsRes.body.stations).toContain("نهاية افتراضية");
    expect(stationsRes.body.stations).not.toContain("نقطة وسط افتراضية");

    const routeRes = await request(app).get("/api/routes/TEST-DEFAULT-SEARCHABLE-01");
    expect(routeRes.status).toBe(200);
    expect(
      routeRes.body.route.mapPoints.find((point) => point.nameAr === "نقطة وسط افتراضية")
        ?.isSearchable,
    ).toBe(false);
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
    expect(res.body.routes.length).toBe(1);
    expect(res.body.routes[0].routeId).toBe("TEST-MICRO-01");
    expect(res.body.routes[0]).toHaveProperty("accuracyStats");
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
