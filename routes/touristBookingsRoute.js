const express = require("express");
const router = express.Router();
const touristBookingsController = require("../controllers/touristBookingsController");
const { authenticate } = require("../middleware/auth");
const { authorize, authorizeOwnership } = require("../middleware/authorize");

// GET all bookings for a tourist
router.get(
	"/user/:tourist_user_id",
	authenticate,
	authorize("booking:read"),
	authorizeOwnership("tourist_user_id"),
	touristBookingsController.getAllBookingsForTourist,
);

// Cancel activity booking
router.delete(
	"/activity-booking/:id",
	authenticate,
	authorize("booking:delete"),
	touristBookingsController.cancelActivityBooking,
);

// Cancel accommodation booking
router.delete(
	"/accommodation-booking/:id",
	authenticate,
	authorize("booking:delete"),
	touristBookingsController.cancelAccommodationBooking,
);


module.exports = router;
