const Role = require("../models/roleModel");
const Permission = require("../models/permissionModel");
const RolePermission = require("../models/rolePermissionModel");
require("../models/associations");

class RoleService {
  normalizePermissionIds(permissionIds = []) {
    const normalizedIds = Array.from(
      new Set(
        permissionIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    );

    return normalizedIds;
  }

  async getAllRoles() {
    return Role.findAll({
      include: [
        {
          model: Permission,
          as: "permissions",
          through: { attributes: [] },
        },
      ],
      order: [["id", "ASC"]],
    });
  }

  async getRoleById(id) {
    return Role.findByPk(id);
  }

  async getRoleWithPermissions(id) {
    return Role.findByPk(id, {
      include: [
        {
          model: Permission,
          as: "permissions",
          through: { attributes: [] },
        },
      ],
    });
  }

  async assignPermissionsToRole(roleId, permissionIds = []) {
    const role = await Role.findByPk(roleId);
    if (!role) {
      throw new Error("Role not found");
    }

    await RolePermission.destroy({ where: { role_id: roleId } });

    if (permissionIds.length > 0) {
      await RolePermission.bulkCreate(
        permissionIds.map((permissionId) => ({
          role_id: roleId,
          permission_id: permissionId,
        })),
      );
    }

    return this.getRoleWithPermissions(roleId);
  }

  async createRoleWithPermissions({ name, permissionIds = [] } = {}) {
    const roleName = String(name || "").trim();
    if (!roleName) {
      const error = new Error("Role name is required");
      error.statusCode = 400;
      throw error;
    }

    const existingRole = await Role.findOne({ where: { name: roleName } });
    if (existingRole) {
      const error = new Error("Role already exists");
      error.statusCode = 409;
      throw error;
    }

    const normalizedPermissionIds = this.normalizePermissionIds(permissionIds);

    if (normalizedPermissionIds.length > 0) {
      const existingPermissions = await Permission.findAll({
        where: { id: normalizedPermissionIds },
        attributes: ["id"],
      });

      const existingIds = new Set(
        existingPermissions.map((permission) => permission.id),
      );
      const invalidIds = normalizedPermissionIds.filter(
        (id) => !existingIds.has(id),
      );

      if (invalidIds.length > 0) {
        const error = new Error(
          `Invalid permission IDs: ${invalidIds.join(", ")}`,
        );
        error.statusCode = 400;
        throw error;
      }
    }

    const transaction = await Role.sequelize.transaction();

    try {
      const role = await Role.create(
        {
          name: roleName,
        },
        { transaction },
      );

      if (normalizedPermissionIds.length > 0) {
        await RolePermission.bulkCreate(
          normalizedPermissionIds.map((permissionId) => ({
            role_id: role.id,
            permission_id: permissionId,
          })),
          { transaction },
        );
      }

      await transaction.commit();
      return this.getRoleWithPermissions(role.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new RoleService();
