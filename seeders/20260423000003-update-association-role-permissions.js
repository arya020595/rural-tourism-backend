"use strict";

/**
 * Replaces the association role's permission set with only bi_dashboard:read.
 * Association users should only be able to access the BI Dashboard.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const [[associationRole]] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'association' LIMIT 1",
    );

    if (!associationRole) {
      return;
    }

    const roleId = associationRole.id;

    const [[biDashboardPermission]] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE code = 'bi_dashboard:read' LIMIT 1",
    );

    if (!biDashboardPermission) {
      throw new Error(
        "Permission bi_dashboard:read not found. Ensure the BI dashboard permission seeder has run first.",
      );
    }

    await queryInterface.sequelize.transaction(async (transaction) => {
      // Remove all existing permissions for the association role
      await queryInterface.sequelize.query(
        "DELETE FROM roles_permissions WHERE role_id = :roleId",
        { replacements: { roleId }, transaction },
      );

      await queryInterface.sequelize.query(
        `
          INSERT IGNORE INTO roles_permissions (role_id, permission_id, created_at, updated_at)
          VALUES (:roleId, :permissionId, :createdAt, :updatedAt)
        `,
        {
          replacements: {
            roleId,
            permissionId: biDashboardPermission.id,
            createdAt: now,
            updatedAt: now,
          },
          transaction,
        },
      );
    });
  },

  async down(queryInterface) {
    const now = new Date();

    const [[associationRole]] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'association' LIMIT 1",
    );

    if (!associationRole) {
      return;
    }

    const roleId = associationRole.id;

    // Remove bi_dashboard:read from the association role
    await queryInterface.sequelize.query(
      `
        DELETE rp FROM roles_permissions rp
        INNER JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = :roleId AND p.code = 'bi_dashboard:read'
      `,
      { replacements: { roleId } },
    );

    // Restore the original association permission set
    const originalCodes = [
      "profile:read",
      "profile:update",
      "association:read",
      "association:update",
      "association:manage_users",
      "accommodation:read",
      "activity:read",
      "booking:read",
    ];

    for (const code of originalCodes) {
      const [[perm]] = await queryInterface.sequelize.query(
        "SELECT id FROM permissions WHERE code = :code LIMIT 1",
        { replacements: { code } },
      );

      if (!perm) continue;

      await queryInterface.sequelize.query(
        `
          INSERT IGNORE INTO roles_permissions (role_id, permission_id, created_at, updated_at)
          VALUES (:roleId, :permissionId, :createdAt, :updatedAt)
        `,
        {
          replacements: {
            roleId,
            permissionId: perm.id,
            createdAt: now,
            updatedAt: now,
          },
        },
      );
    }
  },
};
