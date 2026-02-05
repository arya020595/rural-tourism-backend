const express = require("express");
const router = express.Router();
const activityController = require("../controllers/activityController");

// Helper for async error handling
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Get all operator activities for a specific activity master ID
 * @route GET /api/operator-activities/activity/:activityId
 */
router.get(
  "/activity/:activityId",
  asyncHandler(activityController.getOperatorActivitiesByActivityId),
);

/**
 * Get single operator activity by ID
 * @route GET /api/operator-activities/:id
 * @query {boolean} includeUser - Whether to include user data
 */
router.get("/:id", asyncHandler(activityController.getOperatorActivityById));

module.exports = router;
