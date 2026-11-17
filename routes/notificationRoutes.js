const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const { authorize, authorizeOwnership } = require('../middleware/authorize');

// Reading your own notifications (the bell). Operators get booking
// notifications (booking:read); association users get "new registration
// awaiting approval" ones (registration:approve) but have no booking:read.
// Either is enough; the owner check still limits it to your own notifications.
const NOTIFICATION_READERS = ['booking:read', 'registration:approve'];

// Create a new notification
router.post(
	'/',
	authenticate,
	authorize('booking:update'),
	notificationController.createNotification,
);

// Get notifications for an operator
router.get(
	'/operator/:operator_id',
	authenticate,
	authorize(NOTIFICATION_READERS),
	authorizeOwnership('operator_id'),
	notificationController.getNotificationsByOperator,
);

// PATCH: mark all notifications as read for an operator
router.patch(
	'/operator/:operator_id/read-all',
	authenticate,
	authorize(NOTIFICATION_READERS),
	authorizeOwnership('operator_id'),
	notificationController.markAllAsRead,
);

// PATCH: mark a single notification as read
router.patch(
	'/:id/read',
	authenticate,
	authorize(NOTIFICATION_READERS),
	notificationController.markAsRead,
);

// Get unread notifications count
router.get(
	'/operator/:operator_id/unread-count',
	authenticate,
	authorize(NOTIFICATION_READERS),
	authorizeOwnership('operator_id'),
	notificationController.getUnreadCount,
);

module.exports = router;
