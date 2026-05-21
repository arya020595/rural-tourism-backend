const { Op } = require("sequelize");
const Role = require("../models/roleModel");
const Permission = require("../models/permissionModel");
const RolePermission = require("../models/rolePermissionModel");
require("../models/associations");
const {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} = require("./errors/AppError");

// Roles that may never be deleted or modified via the API.
// OCP: extend this array to protect additional built-in roles without
// touching any business-logic method.
const PROTECTED_ROLES = ["superadmin"];

class RoleService {
  // ── Private helpers ────────────────────────────────────────────────────────

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

  /**
   * Asserts that every ID in `normalizedIds` corresponds to a real permission row.
   * Throws BadRequestError listing any that don't.
   * SRP: single place to validate permission IDs — used by create, update, assign.
   */
  async _assertPermissionsExist(normalizedIds) {
    if (!normalizedIds.length) return;
    const found = await Permission.findAll({
      where: { id: normalizedIds },
      attributes: ["id"],
    });
    const foundSet = new Set(found.map((p) => p.id));
    const invalid = normalizedIds.filter((id) => !foundSet.has(id));
    if (invalid.length) {
      throw new BadRequestError(
        `Invalid permission IDs: ${invalid.join(", ")}`,
      );
    }
  }

  // ── Public read methods ──────────────────────────────────────────────────

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
    if (!role) throw new NotFoundError("Role not found");

    const normalizedPermissionIds = this.normalizePermissionIds(permissionIds);
    if (permissionIds.length > 0 && normalizedPermissionIds.length === 0) {
      throw new BadRequestError("Invalid permission IDs provided");
    }

    await this._assertPermissionsExist(normalizedPermissionIds);

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
    if (!role) throw new NotFoundError("Role not found");

    if (PROTECTED_ROLES.includes(role.name)) {
      throw new ForbiddenError(`The ${role.name} role cannot be deleted`);
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
    const role = await Role.findByPk(id);
    if (!role) throw new NotFoundError("Role not found");

    if (PROTECTED_ROLES.includes(role.name)) {
      throw new ForbiddenError(`The ${role.name} role cannot be modified`);
    }

    if (name !== undefined) {
      const roleName = String(name || "").trim();
      if (!roleName) throw new BadRequestError("Role name is required");

      const existing = await Role.findOne({ where: { name: roleName } });
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
      await this._assertPermissionsExist(normalizedPermissionIds);
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
    if (!roleName) throw new BadRequestError("Role name is required");

    const existingRole = await Role.findOne({ where: { name: roleName } });
    if (existingRole) throw new ConflictError("Role already exists");

    const normalizedPermissionIds = this.normalizePermissionIds(permissionIds);
    await this._assertPermissionsExist(normalizedPermissionIds);

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

  // ── Section-grouped permissions ──────────────────────────────────────────

  async getRolePermissionsBySection(roleId) {
    const role = await this.getRoleWithPermissions(roleId);
    if (!role) throw new NotFoundError("Role not found");

    const grouped = {};
    for (const permission of role.permissions) {
      if (!grouped[permission.section]) grouped[permission.section] = [];
      grouped[permission.section].push({
        id: permission.id,
        name: permission.name,
        code: permission.code,
        resource: permission.resource,
      });
    }

    return { role, permissionsBySection: grouped };
  }
}

module.exports = new RoleService();
