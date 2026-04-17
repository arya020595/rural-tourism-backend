const express = require("express");
const router = express.Router();
const accommodationBookingController = require("../controllers/bookingAccommodationController");
const AccommodationBooking = require("../models/bookingAccommodationModel");
const { authenticate } = require("../middleware/auth");
const { authorize, authorizeOwnership } = require("../middleware/authorize");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Create a new accommodation booking
router.post(
  "/",
  authenticate,
  authorize(["booking:create", "booking:update"]),
  asyncHandler(accommodationBookingController.createAccommodationBooking),
);

// Get booked dates for a specific accommodation (must be before /:id to prevent conflict)
router.get(
  "/booked-dates/:accommodation_id",
  authenticate,
  authorize("booking:read"),
  asyncHandler(accommodationBookingController.getBookedDatesByAccommodation),
);

// Get accommodation booking by ID
router.get(
  "/:id",
  authenticate,
  authorize("booking:read"),
  asyncHandler(accommodationBookingController.getAccommodationBookingById),
);

// Get all accommodation bookings for a specific tourist
router.get(
  "/user/:tourist_user_id",
  authenticate,
  authorize("booking:read"),
  authorizeOwnership("tourist_user_id"),
  asyncHandler(accommodationBookingController.getAccommodationBookingsByUser),
);

// PATCH /api/accommodation-booking/mark-paid/:id
router.patch("/mark-paid/:id", authenticate, authorize("booking:update"), async (req, res) => {
  try {
    const booking = await AccommodationBooking.findByPk(req.params.id);
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    booking.status = "paid";
    await booking.save();
    return res.json({ success: true, booking });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
