const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");
const { asyncHandler } = require("../utils/helpers");

router.post(
  "/",
  authenticate,
  authorize("booking:create"),
  asyncHandler(bookingController.createBooking),
);

router.get(
  "/",
  authenticate,
  authorize("booking:read"),
  asyncHandler(bookingController.getBookings),
);

router.get(
  "/packages",
  authenticate,
  authorize("booking:read"),
  asyncHandler(bookingController.getPackageBookings),
);

router.get(
  "/:id/pdf",
  authenticate,
  authorize("booking:read"),
  asyncHandler(bookingController.generateBookingPdf),
);

router.get(
  "/:id",
  authenticate,
  authorize("booking:read"),
  asyncHandler(bookingController.getBookingById),
);

router.put(
  "/:id",
  authenticate,
  authorize("booking:update"),
  asyncHandler(bookingController.updateBooking),
);

router.patch(
  "/:id/status",
  authenticate,
  authorize("booking:update"),
  asyncHandler(bookingController.updateBookingStatus),
);

router.delete(
  "/:id",
  authenticate,
  authorize("booking:delete"),
  asyncHandler(bookingController.deleteBooking),
);

module.exports = router;
