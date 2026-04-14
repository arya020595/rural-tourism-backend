const express = require('express');
const router = express.Router();
const ActivityBooking = require('../models/bookingActivityModel');
const activityBookingController = require('../controllers/bookingActivityController.js');
const { authenticate } = require('../middleware/auth');
const { authorize, authorizeOwnership } = require('../middleware/authorize');

const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ===============================
// CREATE A NEW BOOKING
// ===============================
router.post(
  '/',
  authenticate,
  authorize(['booking:create', 'booking:update']),
  asyncHandler(activityBookingController.createBooking),
);

// ===============================
// BOOKED SLOTS (MOST SPECIFIC FIRST)
// ===============================
router.get(
  '/booked-dates/operator/:operator_activity_id',
  authenticate,
  authorize('booking:read'),
  asyncHandler(activityBookingController.getBookedDatesByOperatorActivity)
);

// (Optional – keep only if needed elsewhere)
router.get(
  '/booked-dates/:activity_id',
  authenticate,
  authorize('booking:read'),
  asyncHandler(activityBookingController.getBookedDatesByActivity)
);

// ===============================
// USER BOOKINGS
// ===============================
router.get(
  '/user/:tourist_user_id',
  authenticate,
  authorize('booking:read'),
  authorizeOwnership('tourist_user_id'),
  asyncHandler(activityBookingController.getBookingsByUser)
);

// ===============================
// SINGLE BOOKING (LEAST SPECIFIC LAST)
// ===============================
router.get(
  '/:id',
  authenticate,
  authorize('booking:read'),
  asyncHandler(activityBookingController.getBookingById)
);

// ===============================
// MARK PAID
// ===============================
router.patch('/mark-paid/:id', authenticate, authorize('booking:update'), async (req, res) => {
  try {
    const booking = await ActivityBooking.findByPk(req.params.id);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.status = 'Paid';
    await booking.save();
    return res.json({ success: true, booking });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
