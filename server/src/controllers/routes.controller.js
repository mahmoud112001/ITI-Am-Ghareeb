const routesService = require("../services/routes.service");

/**
 * search — GET /api/routes/search?origin=...&destination=...
 * Optional auth: if req.user is set (via optionalProtect), saves search history.
 */
const search = async (req, res, next) => {
  try {
    const { origin, destination, originLat, originLng } = req.query;
    const userId = req.user?.userId || null;
    const originCoords =
      originLat && originLng
        ? {
            lat: Number(originLat),
            lng: Number(originLng),
          }
        : null;

    const results = await routesService.searchRoutes(
      origin,
      destination,
      userId,
      originCoords,
    );
    res.status(200).json({ success: true, results });
  } catch (err) {
    next(err);
  }
};

/**
 * getStations — GET /api/routes/stations
 * Returns a sorted list of all Arabic station names for autocomplete.
 */
const getStations = async (req, res, next) => {
  try {
    const stations = await routesService.getStations();
    res.status(200).json({ success: true, stations });
  } catch (err) {
    next(err);
  }
};

/**
 * getHistory — GET /api/routes/history (protected)
 * Returns the last 20 search history records for the authenticated user.
 */
const getHistory = async (req, res, next) => {
  try {
    const history = await routesService.getHistory(req.user.userId);
    res.status(200).json({ success: true, history });
  } catch (err) {
    next(err);
  }
};

/**
 * getSavedRoutes — GET /api/routes/saved (protected)
 * Returns all routes saved by the authenticated user with accuracy stats.
 */
const getSavedRoutes = async (req, res, next) => {
  try {
    const routes = await routesService.getSavedRoutes(req.user.userId);
    res.status(200).json({ success: true, routes });
  } catch (err) {
    next(err);
  }
};

/**
 * getRouteById — GET /api/routes/:routeId
 * Returns a single route with accuracy stats.
 */
const getRouteById = async (req, res, next) => {
  try {
    const { route, accuracyStats } = await routesService.getRouteById(
      req.params.routeId,
    );
    res.status(200).json({ success: true, route, accuracyStats });
  } catch (err) {
    next(err);
  }
};

/**
 * saveRoute — POST /api/routes/save/:routeId (protected)
 */
const saveRoute = async (req, res, next) => {
  try {
    const result = await routesService.saveRoute(
      req.user.userId,
      req.params.routeId,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * unsaveRoute — DELETE /api/routes/save/:routeId (protected)
 */
const unsaveRoute = async (req, res, next) => {
  try {
    const result = await routesService.unsaveRoute(
      req.user.userId,
      req.params.routeId,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const clearSavedRoutes = async (req, res, next) => {
  try {
    const result = await routesService.clearSavedRoutes(req.user.userId);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * getNearestRoutes — GET /api/routes/near-me (protected)
 * Finds the 5 nearest routes from user's current location.
 * Query params: lat, lng (user coordinates)
 */
const getNearestRoutes = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;
    let userCoords = null;
    if (lat !== undefined && lng !== undefined) {
      const latNum = Number(lat);
      const lngNum = Number(lng);
      const isValid =
        Number.isFinite(latNum) &&
        Number.isFinite(lngNum) &&
        latNum >= -90 &&
        latNum <= 90 &&
        lngNum >= -180 &&
        lngNum <= 180;
      if (!isValid) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid lat/lng coordinates" });
      }
      userCoords = { lat: latNum, lng: lngNum };
    }

    const results = await routesService.findNearestRoutes(
      userCoords,
      req.user?.userId || null,
    );
    res.status(200).json({ success: true, results });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  search,
  getStations,
  getHistory,
  getSavedRoutes,
  getRouteById,
  saveRoute,
  unsaveRoute,
  clearSavedRoutes,
  getNearestRoutes,
};
