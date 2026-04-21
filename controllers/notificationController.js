const Notification = require("../models/notificationModel");

const resolveRoleName = (user) => {
  if (!user?.role) return null;
  if (typeof user.role === "string") return user.role;
  return user.role.name || null;
};

const hasAdminBypass = (user) => {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return resolveRoleName(user) === "superadmin" || permissions.includes("*:*");
};

const resolveRequesterOwnerId = (user) => {
  if (!user) return null;

  const isOperator = user.user_type === "operator";
  const rawId = isOperator
    ? (user.unified_user_id ?? user.id)
    : (user.legacy_user_id ?? user.id);

  if (rawId === undefined || rawId === null) {
    return null;
  }

  return String(rawId);
};

// 1. Create a new notification
exports.createNotification = async (req, res) => {
  const { user_id, title, message, type, related_id } = req.body;

  if (!user_id || !title || !related_id) {
    return res
      .status(400)
      .json({ error: "user_id, title, and related_id are required." });
  }

  const targetUserId = Number(user_id);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res
      .status(400)
      .json({ error: "user_id must be a positive integer." });
  }

  const requesterOwnerId = resolveRequesterOwnerId(req.user);
  const isAdminBypass = hasAdminBypass(req.user);

  if (!isAdminBypass && String(targetUserId) !== requesterOwnerId) {
    return res.status(403).json({
      success: false,
      message:
        "Forbidden. You can only create notifications for your own account.",
    });
  }

  try {
    const newNotification = await Notification.create({
      user_id: targetUserId,
      title,
      message,
      type,
      related_id,
      is_read: 0,
    });

    res.status(201).json(newNotification);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Database error while creating notification." });
  }
};

// 2. Get all notifications for a specific user (operator or tourist)
exports.getNotificationsByOperator = async (req, res) => {
  const { operator_id } = req.params;

  try {
    const notifications = await Notification.findAll({
      where: { user_id: operator_id },
      order: [["created_at", "DESC"]],
    });

    res.json(notifications);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Database error while fetching notifications." });
  }
};

// 3. Mark all unread notifications as read for a user
exports.markAllAsRead = async (req, res) => {
  const { operator_id } = req.params;

  try {
    const updated = await Notification.update(
      { is_read: 1 },
      { where: { user_id: operator_id, is_read: 0 } },
    );

    res.json({ message: "All notifications marked as read.", updated });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Database error while updating notifications." });
  }
};

// 4. Mark a single notification as read
exports.markAsRead = async (req, res) => {
  const { id } = req.params;

  try {
    const notification = await Notification.findByPk(id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    const requesterOwnerId = resolveRequesterOwnerId(req.user);
    const isAdminBypass = hasAdminBypass(req.user);

    if (!isAdminBypass && String(notification.user_id) !== requesterOwnerId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden. You can only modify your own notifications.",
      });
    }

    if (notification.is_read) {
      return res
        .status(404)
        .json({ message: "Notification not found or already read." });
    }

    await notification.update({ is_read: 1 });

    res.json({ message: "Notification marked as read." });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Database error while updating notification." });
  }
};

// 5. Get unread notifications count for a user
exports.getUnreadCount = async (req, res) => {
  const { operator_id } = req.params;

  try {
    const count = await Notification.count({
      where: { user_id: operator_id, is_read: 0 },
    });

    res.json({ unreadCount: count });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Database error while counting notifications." });
  }
};
