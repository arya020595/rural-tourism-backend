const roleService = require("../services/roleService");

exports.createRole = async (req, res) => {
  try {
    const { name, permissionIds } = req.body;

    const role = await roleService.createRoleWithPermissions({
      name,
      permissionIds: Array.isArray(permissionIds) ? permissionIds : [],
    });

    return res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: role,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to create role",
    });
  }
};

exports.getAllRoles = async (req, res) => {
  try {
    const roles = await roleService.getAllRoles();

    return res.status(200).json({
      success: true,
      message: "Roles fetched successfully",
      data: roles,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch roles",
    });
  }
};

exports.getRoleById = async (req, res) => {
  try {
    const role = await roleService.getRoleWithPermissions(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Role fetched successfully",
      data: role,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch role",
    });
  }
};

exports.updateRolePermissions = async (req, res) => {
  try {
    const { permissionIds } = req.body;
    const role = await roleService.assignPermissionsToRole(
      req.params.id,
      Array.isArray(permissionIds) ? permissionIds : [],
    );

    return res.status(200).json({
      success: true,
      message: "Role permissions updated successfully",
      data: role,
    });
  } catch (error) {
    const statusCode = error.message === "Role not found" ? 404 : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update role permissions",
    });
  }
};
