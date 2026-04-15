const express = require("express");
const router = express.Router();
const activityController = require("../controllers/activityController");
const { authenticate } = require("../middleware/auth");
const { authorize, authorizeOwnership } = require("../middleware/authorize");

// Helper for async error handling
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * 1. Get all activities (returns operator activities with activity names)
 * Supports slot-based booking-aware date filtering via query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get(
  "/",
  authenticate,
  authorize("activity:read"),
  asyncHandler(activityController.getAllActivities),
);

/**
 * 2. Get all activities for a specific user
 */
router.get(
  "/user/:user_id",
  authenticate,
  authorize("activity:read"),
  authorizeOwnership("user_id"),
  asyncHandler(activityController.getActivitiesByUser),
);

/**
 * 3. Get a single activity by ID
 */
router.get(
  "/:id",
  authenticate,
  authorize("activity:read"),
  asyncHandler(activityController.getActivityById),
);

/**
 * 4. Create a new activity
 */
router.post(
  "/",
  authenticate,
  authorize("activity:create"),
  asyncHandler(activityController.createActivity),
);

/**
 * 5. Update an activity by ID
 */
router.put(
  "/:id",
  authenticate,
  authorize("activity:update"),
  asyncHandler(activityController.updateActivity),
);

/**
 * 6. Delete an activity by ID
 */
router.delete(
  "/:id",
  authenticate,
  authorize("activity:delete"),
  asyncHandler(activityController.deleteActivity),
);

module.exports = router;
