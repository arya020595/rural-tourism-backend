const express = require('express');
const router = express.Router();
const activityBookingController = require('../controllers/bookingActivityController.js');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Create a new booking
router.post('/', asyncHandler(activityBookingController.createBooking));

// Get booking by ID
router.get('/:id', asyncHandler(activityBookingController.getBookingById));

// Get all bookings for a specific tourist
router.get('/user/:tourist_user_id', asyncHandler(activityBookingController.getBookingsByUser));

module.exports = router;
