const hasRequiredPermission = (user, requiredPermissions) => {
  if (!user) {
    return false;
  }

  const userRole = user.role || null;
  const userPermissions = Array.isArray(user.permissions)
    ? user.permissions
    : [];
  const required = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  if (userRole === "admin" || userPermissions.includes("*:*")) {
    return true;
  }

  return required.some((permission) => userPermissions.includes(permission));
};

const authorize = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login first.",
      });
    }

    if (hasRequiredPermission(req.user, requiredPermissions)) {
      return next();
    }

    const required = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

    return res.status(403).json({
      success: false,
      message: "Forbidden. You do not have permission to perform this action.",
      data: {
        required,
        your_role: req.user.role || null,
      },
    });
  };
};

const authorizeOwnership = (ownerParamKey, bypassPermissions = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login first.",
      });
    }

    if (req.user.role === "admin") {
      return next();
    }

    if (
      bypassPermissions &&
      hasRequiredPermission(req.user, bypassPermissions)
    ) {
      return next();
    }

    const ownerIdFromParams = String(req.params[ownerParamKey] || "");
    const requesterOwnerId = String(
      req.user.user_type === "operator"
        ? (req.user.unified_user_id ?? req.user.id ?? "")
        : (req.user.legacy_user_id ?? req.user.id ?? ""),
    );

    if (ownerIdFromParams && ownerIdFromParams === requesterOwnerId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "Forbidden. You can only access your own resources.",
    });
  };
};

module.exports = {
  authorize,
  authorizeOwnership,
};
