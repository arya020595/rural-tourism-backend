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

    const normalizedPermissionIds = this.normalizePermissionIds(permissionIds);

    if (permissionIds.length > 0 && normalizedPermissionIds.length === 0) {
      const error = new Error("Invalid permission IDs provided");
      error.statusCode = 400;
      throw error;
    }

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
      await RolePermission.destroy({
        where: { role_id: roleId },
        transaction,
      });

      if (normalizedPermissionIds.length > 0) {
        await RolePermission.bulkCreate(
          normalizedPermissionIds.map((permissionId) => ({
            role_id: roleId,
            permission_id: permissionId,
          })),
          { transaction },
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    return this.getRoleWithPermissions(roleId);
  }

  async getRolesPaginated({ page = 1, perPage = 10, search } = {}) {
    const { Op } = require("sequelize");
    const where = search ? { name: { [Op.like]: `%${search}%` } } : {};

    const { count, rows } = await Role.findAndCountAll({
      where,
      include: [
        {
          model: Permission,
          as: "permissions",
          through: { attributes: [] },
          attributes: ["id"],
        },
      ],
      order: [["id", "ASC"]],
      limit: perPage,
      offset: (page - 1) * perPage,
      distinct: true,
    });

    return {
      docs: rows,
      total: count,
      pages: Math.ceil(count / perPage),
    };
  }

  async deleteRole(id) {
    const role = await Role.findByPk(id);
    if (!role) {
      const { NotFoundError } = require("./errors/AppError");
      throw new NotFoundError("Role not found");
    }

    // Prevent deletion of the built-in superadmin role
    if (role.name === "superadmin") {
      const { ForbiddenError } = require("./errors/AppError");
      throw new ForbiddenError("The superadmin role cannot be deleted");
    }

    const transaction = await Role.sequelize.transaction();
    try {
      await RolePermission.destroy({ where: { role_id: id }, transaction });
      await role.destroy({ transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateRoleWithPermissions(id, { name, permissionIds } = {}) {
    const {
      NotFoundError,
      BadRequestError,
      ConflictError,
    } = require("./errors/AppError");

    const role = await Role.findByPk(id);
    if (!role) throw new NotFoundError("Role not found");

    if (role.name === "superadmin") {
      const { ForbiddenError } = require("./errors/AppError");
      throw new ForbiddenError("The superadmin role cannot be modified");
    }

    if (name !== undefined) {
      const roleName = String(name || "").trim();
      if (!roleName) throw new BadRequestError("Role name is required");

      const existing = await Role.findOne({
        where: { name: roleName },
      });
      if (existing && existing.id !== role.id) {
        throw new ConflictError("Role name already in use");
      }
      role.name = roleName;
    }

    const updates = { role };

    if (permissionIds !== undefined) {
      const normalizedPermissionIds =
        this.normalizePermissionIds(permissionIds);

      if (permissionIds.length > 0 && normalizedPermissionIds.length === 0) {
        throw new BadRequestError("Invalid permission IDs provided");
      }

      if (normalizedPermissionIds.length > 0) {
        const existingPermissions = await Permission.findAll({
          where: { id: normalizedPermissionIds },
          attributes: ["id"],
        });
        const existingIds = new Set(existingPermissions.map((p) => p.id));
        const invalidIds = normalizedPermissionIds.filter(
          (id) => !existingIds.has(id),
        );
        if (invalidIds.length > 0) {
          throw new BadRequestError(
            `Invalid permission IDs: ${invalidIds.join(", ")}`,
          );
        }
      }

      updates.permissionIds = normalizedPermissionIds;
    }

    const transaction = await Role.sequelize.transaction();
    try {
      await role.save({ transaction });

      if (updates.permissionIds !== undefined) {
        await RolePermission.destroy({ where: { role_id: id }, transaction });
        if (updates.permissionIds.length > 0) {
          await RolePermission.bulkCreate(
            updates.permissionIds.map((permissionId) => ({
              role_id: id,
              permission_id: permissionId,
            })),
            { transaction },
          );
        }
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    return this.getRoleWithPermissions(id);
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

// Add method to get role permissions grouped by section
RoleService.prototype.getRolePermissionsBySection = async function (roleId) {
  const role = await this.getRoleWithPermissions(roleId);
  if (!role) {
    throw new Error("Role not found");
  }

  const grouped = {};
  role.permissions.forEach((permission) => {
    if (!grouped[permission.section]) {
      grouped[permission.section] = [];
    }
    grouped[permission.section].push({
      id: permission.id,
      name: permission.name,
      code: permission.code,
      resource: permission.resource,
    });
  });

  return {
    role,
    permissionsBySection: grouped,
  };
};
