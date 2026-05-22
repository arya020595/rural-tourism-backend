const roleService = require("../services/roleService");
const { policy } = require("../policies");
const { serialize, serializeMany } = require("../serializers/roleSerializer");
const {
  successResponse,
  paginatedResponse,
  errorResponse,
} = require("../utils/helpers");
const {
  ForbiddenError,
  NotFoundError,
} = require("../services/errors/AppError");

// GET /api/roles — paginated list (superadmin only)
exports.getAllRoles = async (req, res) => {
  try {
    if (!policy("role", req.user).index()) {
      throw new ForbiddenError("Access denied");
    }

    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page || req.query.limit) || 10;
    const search = req.query.search || undefined;

    const result = await roleService.getRolesPaginated({
      page,
      perPage,
      search,
    });

    return paginatedResponse(
      res,
      serializeMany(result.docs),
      "Roles fetched successfully",
      { total: result.total, page, perPage, pages: result.pages },
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};

// GET /api/roles/:id — single role with permissions
exports.getRoleById = async (req, res) => {
  try {
    if (!policy("role", req.user).show()) {
      throw new ForbiddenError("Access denied");
    }

    const role = await roleService.getRoleWithPermissions(req.params.id);
    if (!role) throw new NotFoundError("Role not found");
    return successResponse(res, serialize(role), "Role fetched successfully");
  } catch (err) {
    return errorResponse(res, err);
  }
};

// GET /api/roles/:id/permissions-by-section
exports.getRoleWithPermissionsBySection = async (req, res) => {
  try {
    if (!policy("role", req.user).show()) {
      throw new ForbiddenError("Access denied");
    }

    const roleData = await roleService.getRolePermissionsBySection(
      req.params.id,
    );
    return successResponse(
      res,
      roleData,
      "Role with permissions grouped by section fetched successfully",
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};

// POST /api/roles — create role with optional permissions
exports.createRole = async (req, res) => {
  try {
    if (!policy("role", req.user).create()) {
      throw new ForbiddenError("Access denied");
    }

    const { name, permissionIds } = req.body;
    const role = await roleService.createRoleWithPermissions({
      name,
      permissionIds: Array.isArray(permissionIds) ? permissionIds : [],
    });

    return successResponse(
      res,
      serialize(role),
      "Role created successfully",
      201,
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};

// PUT /api/roles/:id — update name and/or permissions
exports.updateRole = async (req, res) => {
  try {
    if (!policy("role", req.user).update()) {
      throw new ForbiddenError("Access denied");
    }

    const { name, permissionIds } = req.body;
    const role = await roleService.updateRoleWithPermissions(req.params.id, {
      name,
      permissionIds:
        permissionIds !== undefined
          ? Array.isArray(permissionIds)
            ? permissionIds
            : []
          : undefined,
    });

    return successResponse(res, serialize(role), "Role updated successfully");
  } catch (err) {
    return errorResponse(res, err);
  }
};

// DELETE /api/roles/:id
exports.deleteRole = async (req, res) => {
  try {
    if (!policy("role", req.user).destroy()) {
      throw new ForbiddenError("Access denied");
    }

    await roleService.deleteRole(req.params.id);
    return successResponse(res, null, "Role deleted successfully");
  } catch (err) {
    return errorResponse(res, err);
  }
};

// Legacy: kept for backward compat — redirects to updateRole
exports.updateRolePermissions = async (req, res) => {
  try {
    if (!policy("role", req.user).update()) {
      throw new ForbiddenError("Access denied");
    }

    const { permissionIds } = req.body;
    const role = await roleService.assignPermissionsToRole(
      req.params.id,
      Array.isArray(permissionIds) ? permissionIds : [],
    );

    return successResponse(
      res,
      serialize(role),
      "Role permissions updated successfully",
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};
