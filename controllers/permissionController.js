const permissionService = require("../services/permissionService");

exports.getAllPermissions = async (req, res) => {
  try {
    const { resource } = req.query;

    const permissions = resource
      ? await permissionService.getPermissionsByResource(resource)
      : await permissionService.getAllPermissions();

    return res.status(200).json({
      success: true,
      message: "Permissions fetched successfully",
      data: permissions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch permissions",
    });
  }
};
