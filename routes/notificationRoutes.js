const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Create a new notification
router.post('/', notificationController.createNotification);

// Get notifications for an operator
router.get('/operator/:operator_id', notificationController.getNotificationsByOperator);

// PATCH: mark all notifications as read for an operator
router.patch('/operator/:operator_id/read-all', notificationController.markAllAsRead);

// PATCH: mark a single notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Get unread notifications count
router.get('/operator/:operator_id/unread-count', notificationController.getUnreadCount);

module.exports = router;
