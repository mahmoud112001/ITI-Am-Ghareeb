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

function resolveStopSearchable(stop, index, totalStops) {
  if (typeof stop?.isSearchable === "boolean") {
    return stop.isSearchable;
  }

  return index === 0 || index === totalStops - 1;
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
      isSearchable: resolveStopSearchable(stop, index, orderedStops.length),
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
  };
}

function buildRoutePayloadFromLegacyRoute(legacyRoute) {
  return {
    ...extractRouteFields({
      ...legacyRoute,
      isBidirectional: legacyRoute.direction !== "one_way",
    }),
    stops: normalizeRouteInputStops(legacyRoute.stations || []).map((stop) => ({
      ...stop,
      isSearchable: stop.isSearchable !== false,
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
      isSearchable: stop.isSearchable !== false,
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

  if (location.isSearchable === false && stop.isSearchable !== false) {
    location.isSearchable = true;
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
    isSearchable: location.isSearchable !== false,
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
  const startIndex = options.startIndex ?? 0;
  const orderedStops = getOrderedRouteStops(route, selectedDirection);
  const endIndex = options.endIndex ?? orderedStops.length - 1;
  const segmentStops = orderedStops.slice(startIndex, endIndex + 1);
  const mapPoints = segmentStops.map((stop) => summarizeRouteStop(stop));
  const stations = mapPoints.filter((stop) => stop?.isSearchable !== false);
  const endpoints = buildRouteEndpoints(mapPoints);
  const routeNames = buildRouteNames(endpoints.origin, endpoints.destination);

  return {
    ...route,
    nameAr: routeNames.nameAr,
    nameEn: routeNames.nameEn,
    origin: endpoints.origin,
    destination: endpoints.destination,
    stops: mapPoints,
    stations,
    mapPoints,
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

  return {
    ...route,
    origin: summarizeLocation(route.origin),
    destination: summarizeLocation(route.destination),
    stops,
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
  buildLocationKey,
  buildRouteEndpoints,
  buildRoutePayloadFromLegacyRoute,
  coordsToLocation,
  extractRouteFields,
  hasMeaningfulCoords,
  loadRouteGraphById,
  locationToCoords,
  normalizeRouteInputStops,
  normalizeSearchText,
  populateRouteGraph,
  summarizeLocation,
  summarizeRouteStop,
  syncRouteLocations,
  toAdminRoute,
  toPublicRoute,
};
