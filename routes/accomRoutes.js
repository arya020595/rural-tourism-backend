const express = require("express");
const router = express.Router();
const accomController = require("../controllers/accomController");
const { authenticate } = require("../middleware/auth");
const { authorize, authorizeOwnership } = require("../middleware/authorize");

// Helper for async error handling
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * 1. Get all accommodations
 * Supports booking-aware date filtering via query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get(
  "/",
  authenticate,
  authorize("accommodation:read"),
  asyncHandler(accomController.getAllAccommodations),
);

/**
 * 2. Get all accommodations for a specific user
 */
router.get(
  "/user/:user_id",
  authenticate,
  authorize("accommodation:read"),
  authorizeOwnership("user_id"),
  asyncHandler(accomController.getAccommodationsByUser),
);

/**
 * 3. Get a single accommodation by ID
 */
router.get(
  "/:id",
  authenticate,
  authorize("accommodation:read"),
  asyncHandler(accomController.getAccommodationById),
);

/**
 * 4. Create a new accommodation
 */
router.post(
  "/",
  authenticate,
  authorize("accommodation:create"),
  asyncHandler(accomController.createAccommodation),
);

/**
 * 5. Update an accommodation by ID
 */
router.put(
  "/:id",
  authenticate,
  authorize("accommodation:update"),
  asyncHandler(accomController.updateAccommodation),
);

/**
 * 6. Delete an accommodation by ID
 */
router.delete(
  "/:id",
  authenticate,
  authorize("accommodation:delete"),
  asyncHandler(accomController.deleteAccommodation),
);

module.exports = router;
