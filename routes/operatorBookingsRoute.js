const express = require('express');
const router = express.Router();
const operatorBookingsController = require('../controllers/operatorBookingsController');

// Get all bookings for this operator
router.get('/user/:operator_user_id', operatorBookingsController.getAllBookingsForOperator);

// Mark bookings as paid
router.post('/activity/:id/paid', operatorBookingsController.markActivityPaid);
router.post('/accommodation/:id/paid', operatorBookingsController.markAccommodationPaid);

module.exports = router;
