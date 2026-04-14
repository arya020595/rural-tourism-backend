const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const { authorize, authorizeOwnership } = require('../middleware/authorize');

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
	authorize('booking:read'),
	authorizeOwnership('operator_id'),
	notificationController.getNotificationsByOperator,
);

// PATCH: mark all notifications as read for an operator
router.patch(
	'/operator/:operator_id/read-all',
	authenticate,
	authorize('booking:read'),
	authorizeOwnership('operator_id'),
	notificationController.markAllAsRead,
);

// PATCH: mark a single notification as read
router.patch(
	'/:id/read',
	authenticate,
	authorize('booking:read'),
	notificationController.markAsRead,
);

// Get unread notifications count
router.get(
	'/operator/:operator_id/unread-count',
	authenticate,
	authorize('booking:read'),
	authorizeOwnership('operator_id'),
	notificationController.getUnreadCount,
);

module.exports = router;
