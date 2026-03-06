const Notification = require('../models/notificationModel');

// 1. Create a new notification
exports.createNotification = async (req, res) => {
  const { user_id, title, message, type, related_id } = req.body;

  if (!user_id || !title || !related_id) {
    return res.status(400).json({ error: 'user_id, title, and related_id are required.' });
  }

  try {
    const newNotification = await Notification.create({
      user_id,
      title,
      message,
      type,
      related_id,
      is_read: 0
    });

    res.status(201).json(newNotification);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error while creating notification.' });
  }
};

// 2. Get all notifications for a specific user (operator or tourist)
exports.getNotificationsByOperator = async (req, res) => {
  const { operator_id } = req.params;

  try {
    const notifications = await Notification.findAll({
      where: { user_id: operator_id },
      order: [['created_at', 'DESC']],
    });

    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error while fetching notifications.' });
  }
};

// 3. Mark all unread notifications as read for a user
exports.markAllAsRead = async (req, res) => {
  const { operator_id } = req.params;

  try {
    const updated = await Notification.update(
      { is_read: 1 },
      { where: { user_id: operator_id, is_read: 0 } }
    );

    res.json({ message: 'All notifications marked as read.', updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error while updating notifications.' });
  }
};

// 4. Mark a single notification as read
exports.markAsRead = async (req, res) => {
  const { id } = req.params;

  try {
    const [updated] = await Notification.update(
      { is_read: 1 },
      { where: { id, is_read: 0 } }
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

// 5. Get unread notifications count for a user
exports.getUnreadCount = async (req, res) => {
  const { operator_id } = req.params;

  try {
    const count = await Notification.count({
      where: { user_id: operator_id, is_read: 0 }
    });

    res.json({ unreadCount: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error while counting notifications.' });
  }
};
