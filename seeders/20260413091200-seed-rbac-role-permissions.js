"use strict";

const ROLE_PERMISSION_MAP = {
  superadmin: ["*:*"],
  operator_admin: [
    "profile:read",
    "profile:update",
    "user:create",
    "user:read",
    "user:update",
    "user:delete",
    "accommodation:create",
    "accommodation:read",
    "accommodation:update",
    "accommodation:delete",
    "activity:create",
    "activity:read",
    "activity:update",
    "activity:delete",
    "booking:read",
    "booking:update",
    "receipt:create",
    "receipt:read",
    "product:create",
    "product:read",
    "product:update",
    "product:delete",
  ],
  operator_staff: [
    "profile:read",
    "profile:update",
    "accommodation:read",
    "activity:read",
    "booking:read",
    "receipt:read",
    "product:read",
  ],
  tourist: [
    "profile:read",
    "profile:update",
    "accommodation:read",
    "activity:read",
    "booking:create",
    "booking:read",
    "receipt:read",
  ],
  association: [
    "profile:read",
    "profile:update",
    "association:read",
    "association:update",
    "association:manage_users",
    "accommodation:read",
    "activity:read",
    "booking:read",
  ],
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      "SELECT id, name FROM roles",
    );
    const [permissions] = await queryInterface.sequelize.query(
      "SELECT id, code FROM permissions",
    );

    const roleByName = new Map(roles.map((role) => [role.name, role.id]));
    const permissionByCode = new Map(
      permissions.map((permission) => [permission.code, permission.id]),
    );

    const now = new Date();

    for (const [roleName, permissionCodes] of Object.entries(
      ROLE_PERMISSION_MAP,
    )) {
      const roleId = roleByName.get(roleName);
      if (!roleId) continue;

      for (const code of permissionCodes) {
        const permissionId = permissionByCode.get(code);
        if (!permissionId) continue;

        await queryInterface.sequelize.query(
          `
            INSERT IGNORE INTO roles_permissions
              (role_id, permission_id, created_at, updated_at)
            VALUES
              (:roleId, :permissionId, :createdAt, :updatedAt)
          `,
          {
            replacements: {
              roleId,
              permissionId,
              createdAt: now,
              updatedAt: now,
            },
          },
        );
      }
    }

    const operatorRoleId = roleByName.get("operator_admin") || null;
    const touristRoleId = roleByName.get("tourist") || null;
    const associationRoleId = roleByName.get("association") || null;

    if (operatorRoleId) {
      await queryInterface.sequelize.query(
        "UPDATE rt_users SET role_id = :roleId WHERE role_id IS NULL",
        { replacements: { roleId: operatorRoleId } },
      );
    }

    if (touristRoleId) {
      await queryInterface.sequelize.query(
        "UPDATE tourist_users SET role_id = :roleId WHERE role_id IS NULL",
        { replacements: { roleId: touristRoleId } },
      );
    }

    if (associationRoleId) {
      await queryInterface.sequelize.query(
        "UPDATE association_users SET role_id = :roleId WHERE role_id IS NULL",
        { replacements: { roleId: associationRoleId } },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `
        DELETE rp
        FROM roles_permissions rp
        INNER JOIN roles r ON r.id = rp.role_id
        WHERE r.name IN ('superadmin', 'operator_admin', 'operator_staff', 'tourist', 'association')
      `,
    );

    await queryInterface.sequelize.query("UPDATE rt_users SET role_id = NULL");
    await queryInterface.sequelize.query(
      "UPDATE tourist_users SET role_id = NULL",
    );
    await queryInterface.sequelize.query(
      "UPDATE association_users SET role_id = NULL",
    );
  },
};
