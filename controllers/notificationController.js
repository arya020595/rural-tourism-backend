const Notification = require('../models/notificationModel'); // import the notification model
const { Op } = require('sequelize');

// 1. Create a new notification
exports.createNotification = async (req, res) => {
  const { operator_id, tourist_user_id, booking_id, message } = req.body;

  if (!operator_id || !tourist_user_id || !booking_id || !message) {
    return res.status(400).json({ error: 'operator_id, tourist_user_id, booking_id, and message are required.' });
  }

  try {
    const newNotification = await Notification.create({
      operator_id,
      tourist_user_id,
      booking_id,
      message,
      read_status: 0, // default unread
    });

    res.status(201).json(newNotification);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error while creating notification.' });
  }
};

// 2. Get all notifications for a specific operator
exports.getNotificationsByOperator = async (req, res) => {
  const { operator_id } = req.params;

  try {
    const notifications = await Notification.findAll({
      where: { operator_id },
      order: [['createdAt', 'DESC']],
    });

    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error while fetching notifications.' });
  }
};

// 3. Mark a notification as read
// Mark all unread notifications as read for an operator
// notificationController.js
exports.markAllAsRead = async (req, res) => {
  const { operator_id } = req.params;

  try {
    const updated = await Notification.update(
      { read_status: 1 },
      { where: { operator_id, read_status: 0 } } // only unread
    );

    res.json({ message: 'All notifications marked as read.', updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error while updating notifications.' });
  }
};


// Mark a single notification as read
// Mark a single notification as read
exports.markAsRead = async (req, res) => {
  const { id } = req.params;

  try {
    const [updated] = await Notification.update(
      { read_status: 1 },
      { where: { id, read_status: 0 } } // only update if unread
    );

    if (updated === 0) {
      return res.status(404).json({ message: 'Notification not found or already read.' });
    }

    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error while updating notification.' });
  }
};




// 4. Get unread notifications count for an operator
exports.getUnreadCount = async (req, res) => {
  const { operator_id } = req.params;

  try {
    const count = await Notification.count({
      where: { operator_id, read_status: 0 },
    });

    res.json({ unread_count: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error while counting notifications.' });
  }
};
