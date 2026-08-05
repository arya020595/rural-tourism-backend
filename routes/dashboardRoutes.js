const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");
const { asyncHandler } = require("../utils/helpers");

router.get(
  "/today",
  authenticate,
  authorize("booking:read"),
  asyncHandler(dashboardController.getTodayDashboard),
);

router.get(
  "/trend",
  authenticate,
  authorize("booking:read"),
  asyncHandler(dashboardController.getTrendDashboard),
);

// Superadmin-only per-association totals (the controller enforces superadmin).
router.get(
  "/association-stats",
  authenticate,
  asyncHandler(dashboardController.getAssociationStats),
);

module.exports = router;
