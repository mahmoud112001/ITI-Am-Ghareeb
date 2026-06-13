const express = require("express");
const routesController = require("../controllers/routes.controller");
const { apiLimiter } = require("../middleware/rateLimit.middleware");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

// Apply general rate limit to all route endpoints
router.use(apiLimiter);

/**
 * optionalProtect — tries to authenticate the request but does NOT block
 * unauthenticated users. Used on search so we can log history for logged-in
 * users without breaking public access.
 */
const optionalProtect = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return next();

  const jwt = require("jsonwebtoken");
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId: decoded.userId, role: decoded.role };
  } catch {
    // Invalid/expired token — treat as anonymous, don't block
  }
  next();
};

// ⚠️ ORDERING IS CRITICAL — all specific paths must precede /:routeId

// Public — search routes by origin + destination
router.get("/search", optionalProtect, routesController.search);

// Public — all station names for autocomplete
router.get("/stations", routesController.getStations);

// Protected — search history for authenticated user
router.get("/history", protect, routesController.getHistory);

// Protected — saved routes for authenticated user
router.get("/saved", protect, routesController.getSavedRoutes);

// Protected — save a route to the user's saved list
router.post("/save/:routeId", protect, routesController.saveRoute);

// Protected — remove a route from the user's saved list
router.delete("/save/:routeId", protect, routesController.unsaveRoute);

// Protected — remove all saved routes for the authenticated user
router.delete("/saved/clear", protect, routesController.clearSavedRoutes);

// Public (optional auth) — find 5 nearest routes from user's current location.
// Anonymous users can use "nearby lines"; if logged in, the search is saved to history.
router.get("/near-me", optionalProtect, routesController.getNearestRoutes);

// Public — get a single route by routeId string (MUST be last GET)
router.get("/:routeId", routesController.getRouteById);

module.exports = router;
