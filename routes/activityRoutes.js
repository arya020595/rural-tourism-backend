const express = require("express");
const router = express.Router();
const activityController = require("../controllers/activityController");

// Helper for async error handling
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * 1. Get all activities (returns operator activities with activity names)
 * Supports slot-based booking-aware date filtering via query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get("/", asyncHandler(activityController.getAllActivities));

/**
 * 2. Get all activities for a specific user
 */
router.get(
  "/user/:user_id",
  asyncHandler(activityController.getActivitiesByUser),
);

/**
 * 3. Get a single activity by ID
 */
router.get("/:id", asyncHandler(activityController.getActivityById));

/**
 * 4. Create a new activity
 */
router.post("/", asyncHandler(activityController.createActivity));

/**
 * 5. Update an activity by ID
 */
router.put("/:id", asyncHandler(activityController.updateActivity));

/**
 * 6. Delete an activity by ID
 */
router.delete("/:id", asyncHandler(activityController.deleteActivity));

module.exports = router;
