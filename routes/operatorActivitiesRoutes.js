const express = require("express");
const router = express.Router();
const operatorActivitiesController = require("../controllers/operatorActivitiesController");

// Helper for async error handling
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Get all operator activities
 * @route GET /api/operator-activities
 */
router.get(
  "/",
  asyncHandler(operatorActivitiesController.getAllOperatorActivities),
);

/**
 * Get all operator activities for a specific activity master ID
 * @route GET /api/operator-activities/activity/:activityId
 */
router.get(
  "/activity/:activityId",
  asyncHandler(operatorActivitiesController.getOperatorsByActivityId),
);

/**
 * Get single operator activity by ID
 * @route GET /api/operator-activities/:id
 * @query {boolean} includeUser - Whether to include user data
 */
router.get(
  "/:id",
  asyncHandler(operatorActivitiesController.getOperatorActivityById),
);

/**
 * Create a new operator activity
 * @route POST /api/operator-activities
 */
router.post(
  "/",
  asyncHandler(operatorActivitiesController.createOperatorActivity),
);

module.exports = router;
