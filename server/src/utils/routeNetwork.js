const { Location, Route } = require("../models/index.js");

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildLocationKey(nameAr, nameEn) {
  const ar = normalizeSearchText(nameAr);
  const en = normalizeSearchText(nameEn);
  return `${ar}__${en}`;
}

function hasMeaningfulCoords(coords) {
  return (
    coords &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng) &&
    !(coords.lat === 0 && coords.lng === 0)
  );
}

function coordsToLocation(coords) {
  if (!hasMeaningfulCoords(coords)) return null;
  return {
    type: "Point",
    coordinates: [coords.lng, coords.lat],
  };
}

function locationToCoords(location) {
  if (!location?.coordinates || location.coordinates.length !== 2) {
    return { lat: 0, lng: 0 };
  }

  return {
    lat: location.coordinates[1],
    lng: location.coordinates[0],
  };
}

function normalizeGeometryPoint(point) {
  if (Array.isArray(point) && point.length === 2) {
    const [lng, lat] = point;
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return [Number(lng), Number(lat)];
    }
  }

  if (point && Number.isFinite(point.lng) && Number.isFinite(point.lat)) {
    return [Number(point.lng), Number(point.lat)];
  }

  return null;
}

function buildGeometryFromStops(stops = []) {
  const coordinates = stops
    .map((stop) => normalizeGeometryPoint(stop.coords))
    .filter(Boolean);

  if (coordinates.length < 2) {
    return null;
  }

  return {
    type: "LineString",
    coordinates,
  };
}

function normalizeRouteGeometry(geometryInput, fallbackStops = []) {
  const rawCoordinates = Array.isArray(geometryInput)
    ? geometryInput
    : geometryInput?.coordinates;
  const coordinates = Array.isArray(rawCoordinates)
    ? rawCoordinates.map(normalizeGeometryPoint).filter(Boolean)
    : [];

  if (coordinates.length >= 2) {
    return {
      type: "LineString",
      coordinates,
    };
  }

  const fallbackGeometry = buildGeometryFromStops(fallbackStops);
  if (fallbackGeometry) {
    return fallbackGeometry;
  }

  throw new Error("Route geometry must contain at least two valid points");
}

function reverseGeometry(geometry) {
  const normalized = normalizeRouteGeometry(geometry);
  return {
    type: "LineString",
    coordinates: [...normalized.coordinates].reverse(),
  };
}

function geometryToPointSummaries(geometry) {
  if (!geometry?.coordinates?.length) return [];

  return geometry.coordinates.map(([lng, lat], index) => ({
    order: index + 1,
    coords: { lat, lng },
  }));
}

function formatRouteName(originName, destinationName, delimiter) {
  return `${originName} ${delimiter} ${destinationName}`;
}

function buildRouteNames(originStop, destinationStop) {
  return {
    nameAr: formatRouteName(
      originStop?.nameAr || "",
      destinationStop?.nameAr || "",
      "←",
    ),
    nameEn: formatRouteName(
      originStop?.nameEn || "",
      destinationStop?.nameEn || "",
      "→",
    ),
  };
}

function extractStopNameParts(stop) {
  return {
    nameAr: stop?.nameAr || stop?.location?.nameAr || "",
    nameEn: stop?.nameEn || stop?.location?.nameEn || "",
  };
}

function normalizeRouteInputStops(stops = []) {
  const orderedStops = [...stops].sort((a, b) => (a.order || 0) - (b.order || 0));

  return orderedStops.map((stop, index) => ({
    order: index + 1,
    nameAr: stop.nameAr,
    nameEn: stop.nameEn,
    coords: stop.coords || { lat: 0, lng: 0 },
    allowPickup: stop.allowPickup !== false,
    allowDropoff: stop.allowDropoff !== false,
    aliases: stop.aliases || { ar: [], en: [] },
    district: stop.district || null,
  }));
}

function buildRouteNamesFromInput(input) {
  if (Array.isArray(input?.stops) && input.stops.length >= 2) {
    const orderedStops = [...input.stops].sort((a, b) => (a.order || 0) - (b.order || 0));
    const firstStop = extractStopNameParts(orderedStops[0]);
    const lastStop = extractStopNameParts(orderedStops[orderedStops.length - 1]);

    if (firstStop.nameAr && lastStop.nameAr && firstStop.nameEn && lastStop.nameEn) {
      return buildRouteNames(firstStop, lastStop);
    }
  }

  if (input?.origin && input?.destination) {
    return buildRouteNames(input.origin, input.destination);
  }

  return {
    nameAr: input?.nameAr || "",
    nameEn: input?.nameEn || "",
  };
}

function extractRouteFields(input) {
  const routeNames = buildRouteNamesFromInput(input);
  return {
    routeId: input.routeId,
    type: input.type,
    localName: input.localName,
    nameAr: routeNames.nameAr,
    nameEn: routeNames.nameEn,
    fare: input.fare,
    operatingHours: input.operatingHours || null,
    frequency: input.frequency || null,
    peakHours: input.peakHours || [],
    tips: input.tips || [],
    isBidirectional: input.isBidirectional === true,
    verified: input.verified,
    isActive: input.isActive,
    geometry: normalizeRouteGeometry(input.geometry, input.stops || []),
  };
}

function buildRoutePayloadFromLegacyRoute(legacyRoute) {
  const normalizedStops = normalizeRouteInputStops(legacyRoute.stations || []);

  return {
    ...extractRouteFields({
      ...legacyRoute,
      isBidirectional: legacyRoute.direction !== "one_way",
      stops: normalizedStops,
      geometry: legacyRoute.geometry,
    }),
    stops: normalizedStops.map((stop) => ({
      ...stop,
      allowPickup: stop.allowPickup !== false,
      allowDropoff: stop.allowDropoff !== false,
    })),
  };
}

async function findOrCreateLocation(stop) {
  const canonicalKey = buildLocationKey(stop.nameAr, stop.nameEn);
  const nextLocation = coordsToLocation(stop.coords);

  let location = await Location.findOne({ canonicalKey });
  if (!location) {
    return Location.create({
      canonicalKey,
      nameAr: stop.nameAr,
      nameEn: stop.nameEn,
      aliases: stop.aliases || { ar: [], en: [] },
      location: nextLocation,
      district: stop.district || null,
    });
  }

  let changed = false;

  if (!location.location && nextLocation) {
    location.location = nextLocation;
    changed = true;
  }

  if (!location.nameAr && stop.nameAr) {
    location.nameAr = stop.nameAr;
    changed = true;
  }

  if (!location.nameEn && stop.nameEn) {
    location.nameEn = stop.nameEn;
    changed = true;
  }

  if (!location.district && stop.district) {
    location.district = stop.district;
    changed = true;
  }

  if (changed) {
    await location.save();
  }

  return location;
}

async function syncRouteLocations(routeDoc, routeInput) {
  const normalizedStops = normalizeRouteInputStops(routeInput?.stops || []);
  if (normalizedStops.length < 2) {
    throw new Error("Route must contain at least two ordered stops");
  }

  const locations = [];
  for (const stop of normalizedStops) {
    locations.push(await findOrCreateLocation(stop));
  }

  routeDoc.origin = locations[0]._id;
  routeDoc.destination = locations[locations.length - 1]._id;
  const routeNames = buildRouteNames(
    normalizedStops[0],
    normalizedStops[normalizedStops.length - 1],
  );
  routeDoc.nameAr = routeNames.nameAr;
  routeDoc.nameEn = routeNames.nameEn;
  routeDoc.stops = normalizedStops.map((stop, index) => ({
    location: locations[index]._id,
    allowPickup: stop.allowPickup !== false,
    allowDropoff: stop.allowDropoff !== false,
  }));
  routeDoc.geometry = normalizeRouteGeometry(
    routeInput?.geometry || routeDoc.geometry,
    normalizedStops,
  );
  await routeDoc.save();

  return locations;
}

function toPlainObject(value) {
  return typeof value?.toObject === "function" ? value.toObject() : value;
}

function summarizeLocation(locationDoc) {
  if (!locationDoc) return null;

  const locationCandidate = toPlainObject(locationDoc);
  const location =
    locationCandidate?.nameAr || locationCandidate?.nameEn
      ? locationCandidate
      : toPlainObject(locationCandidate?.location);

  if (!location) return null;

  return {
    _id: location._id,
    nameAr: location.nameAr,
    nameEn: location.nameEn,
    coords: location.location
      ? locationToCoords(location.location)
      : { lat: 0, lng: 0 },
    district: location.district || null,
  };
}

function summarizeRouteStop(routeStopDoc) {
  if (!routeStopDoc) return null;

  const routeStop = toPlainObject(routeStopDoc);
  const location = summarizeLocation(routeStop.location || routeStop);
  if (!location) return null;

  return {
    ...location,
    allowPickup: routeStop.allowPickup !== false,
    allowDropoff: routeStop.allowDropoff !== false,
  };
}

function getOrderedRouteStops(routeDoc, selectedDirection = "forward") {
  const route = toPlainObject(routeDoc);
  const stops = Array.isArray(route.stops) ? [...route.stops] : [];
  return selectedDirection === "reverse" ? stops.reverse() : stops;
}

function getOrderedRouteGeometry(routeDoc, selectedDirection = "forward") {
  const route = toPlainObject(routeDoc);
  if (!route?.geometry) {
    return null;
  }

  return selectedDirection === "reverse"
    ? reverseGeometry(route.geometry)
    : normalizeRouteGeometry(route.geometry);
}

function normalizeRoutePath(path = []) {
  return Array.isArray(path)
    ? path
        .map((point, index) => {
          const lat = Number(point?.lat);
          const lng = Number(point?.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return {
            lat,
            lng,
            order: Number.isFinite(Number(point?.order)) ? Number(point.order) : index + 1,
          };
        })
        .filter(Boolean)
    : [];
}

function getOrderedRoutePath(routeDoc, selectedDirection = "forward") {
  const route = toPlainObject(routeDoc);
  const path = normalizeRoutePath(route?.path);
  return selectedDirection === "reverse" ? [...path].reverse() : path;
}

function buildRouteEndpoints(stops = []) {
  const first = stops[0];
  const last = stops[stops.length - 1];
  return {
    origin: first || null,
    destination: last || null,
  };
}

function toPublicRoute(routeDoc, options = {}) {
  const route = toPlainObject(routeDoc) || {};
  const selectedDirection = options.selectedDirection || "forward";
  const orderedStops = getOrderedRouteStops(route, selectedDirection);
  const stopPoints = orderedStops.map((stop) => summarizeRouteStop(stop));
  const endpoints = buildRouteEndpoints(stopPoints);
  const routeNames = buildRouteNames(endpoints.origin, endpoints.destination);
  const geometry = getOrderedRouteGeometry(route, selectedDirection);
  const geometryPoints = geometryToPointSummaries(geometry);
  const path = getOrderedRoutePath(route, selectedDirection);

  return {
    ...route,
    nameAr: routeNames.nameAr,
    nameEn: routeNames.nameEn,
    origin: endpoints.origin,
    destination: endpoints.destination,
    stops: stopPoints,
    stations: stopPoints,
    geometry,
    geometryPoints,
    mapPoints: geometryPoints,
    path,
    fare: route.fare || null,
    operatingHours: route.operatingHours || null,
    peakHours: route.peakHours || [],
    frequency: route.frequency || null,
    tips: route.tips || [],
    selectedDirection,
    isBidirectional: route.isBidirectional === true,
  };
}

function toAdminRoute(routeDoc) {
  const route = toPlainObject(routeDoc);
  const stops = getOrderedRouteStops(route).map((stop, index) => ({
    order: index + 1,
    ...summarizeRouteStop(stop),
  }));
  const geometry = getOrderedRouteGeometry(route);

  return {
    ...route,
    origin: summarizeLocation(route.origin),
    destination: summarizeLocation(route.destination),
    stops,
    geometry,
    geometryPoints: geometryToPointSummaries(geometry),
  };
}

function populateRouteGraph(query) {
  return query
    .populate("origin")
    .populate("destination")
    .populate("stops.location");
}

async function loadRouteGraphById(routeId) {
  return populateRouteGraph(Route.findById(routeId));
}

module.exports = {
  buildGeometryFromStops,
  buildLocationKey,
  buildRouteEndpoints,
  buildRoutePayloadFromLegacyRoute,
  coordsToLocation,
  extractRouteFields,
  geometryToPointSummaries,
  hasMeaningfulCoords,
  loadRouteGraphById,
  locationToCoords,
  normalizeRouteGeometry,
  normalizeRouteInputStops,
  normalizeSearchText,
  populateRouteGraph,
  reverseGeometry,
  summarizeLocation,
  summarizeRouteStop,
  syncRouteLocations,
  toAdminRoute,
  toPublicRoute,
};
