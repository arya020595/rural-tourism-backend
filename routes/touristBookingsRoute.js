const express = require("express");
const router = express.Router();
const touristBookingsController = require("../controllers/touristBookingsController");

// GET all bookings for a tourist
router.get("/user/:tourist_user_id", touristBookingsController.getAllBookingsForTourist);

// Cancel activity booking
router.delete("/activity-booking/:id", touristBookingsController.cancelActivityBooking);

// Cancel accommodation booking
router.delete("/accommodation-booking/:id", touristBookingsController.cancelAccommodationBooking);


module.exports = router;
