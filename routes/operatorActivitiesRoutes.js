const express = require("express");
const router = express.Router();
const operatorActivitiesController = require("../controllers/operatorActivitiesController");
const { authenticate } = require("../middleware/auth");
const { authorize, authorizeOwnership } = require("../middleware/authorize");

// Helper for async error handling
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Get all operator activities
 * @route GET /api/operator-activities
 */
router.get(
  "/",
  authenticate,
  authorize("activity:read"),
  asyncHandler(operatorActivitiesController.getAllOperatorActivities),
);

/**
 * Get all operator activities for a specific activity master ID
 * @route GET /api/operator-activities/activity/:activityId
 */
router.get(
  "/activity/:activityId",
  authenticate,
  authorize("activity:read"),
  asyncHandler(operatorActivitiesController.getOperatorsByActivityId),
);

/**
 * Get all operator activities for a specific user
 * @route GET /api/operator-activities/user/:user_id
 */
router.get(
  "/user/:user_id",
  authenticate,
  authorize("activity:read"),
  authorizeOwnership("user_id"),
  asyncHandler(operatorActivitiesController.getAllOperatorActivitiesByUser),
);

/**
 * Get single operator activity by ID
 * @route GET /api/operator-activities/:id
 * @query {boolean} includeUser - Whether to include user data
 */
router.get(
  "/:id",
  authenticate,
  authorize("activity:read"),
  asyncHandler(operatorActivitiesController.getOperatorActivityById),
);

/**
 * Create a new operator activity
 * @route POST /api/operator-activities
 */
router.post(
  "/",
  authenticate,
  authorize("activity:create"),
  asyncHandler(operatorActivitiesController.createOperatorActivity),
);

module.exports = router;
