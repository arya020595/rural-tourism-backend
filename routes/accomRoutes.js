const express = require("express");
const router = express.Router();
const accomController = require("../controllers/accomController");

// Helper for async error handling
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * 1. Get all accommodations
 * Supports booking-aware date filtering via query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get("/", asyncHandler(accomController.getAllAccommodations));

/**
 * 2. Get all accommodations for a specific user
 */
router.get(
  "/user/:user_id",
  asyncHandler(accomController.getAccommodationsByUser),
);

/**
 * 3. Get a single accommodation by ID
 */
router.get("/:id", asyncHandler(accomController.getAccommodationById));

/**
 * 4. Create a new accommodation
 */
router.post("/", asyncHandler(accomController.createAccommodation));

/**
 * 5. Update an accommodation by ID
 */
router.put("/:id", asyncHandler(accomController.updateAccommodation));

/**
 * 6. Delete an accommodation by ID
 */
router.delete("/:id", asyncHandler(accomController.deleteAccommodation));

module.exports = router;
