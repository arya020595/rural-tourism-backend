const express = require('express');
const router = express.Router();
const accommodationBookingController = require('../controllers/bookingAccommodationController');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Create a new accommodation booking
router.post('/', asyncHandler(accommodationBookingController.createAccommodationBooking));

// Get accommodation booking by ID
router.get('/:id', asyncHandler(accommodationBookingController.getAccommodationBookingById));

// Get all accommodation bookings for a specific tourist
router.get('/user/:tourist_user_id', asyncHandler(accommodationBookingController.getAccommodationBookingsByUser));

module.exports = router;
