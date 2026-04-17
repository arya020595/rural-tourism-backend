const express = require('express');
const router = express.Router();
const operatorBookingsController = require('../controllers/operatorBookingsController');
const { authenticate } = require('../middleware/auth');
const { authorize, authorizeOwnership } = require('../middleware/authorize');

// Get all bookings for this operator
router.get(
	'/user/:operator_user_id',
	authenticate,
	authorize('booking:read'),
	authorizeOwnership('operator_user_id'),
	operatorBookingsController.getAllBookingsForOperator,
);

// Mark bookings as paid
router.post('/activity/:id/paid', authenticate, authorize('booking:update'), operatorBookingsController.markActivityPaid);
router.post('/accommodation/:id/paid', authenticate, authorize('booking:update'), operatorBookingsController.markAccommodationPaid);

module.exports = router;
