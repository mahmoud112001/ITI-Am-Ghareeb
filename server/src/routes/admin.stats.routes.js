const express = require("express");
const adminService = require("../services/admin.service");
const { protect, requireAdmin } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(protect, requireAdmin);

router.get("/", async (req, res, next) => {
  try {
    const stats = await adminService.getStats();
    res.status(200).json({ success: true, stats });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
