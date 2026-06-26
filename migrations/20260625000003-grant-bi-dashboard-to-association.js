"use strict";

/**
 * Grants `bi_dashboard:read` to the `association` role (in addition to whatever
 * permissions it already has). Association accounts need this to access the BI
 * dashboard page. Idempotent via INSERT IGNORE.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const [[role]] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'association' LIMIT 1",
    );
    if (!role) {
      return;
    }

    const [[permission]] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE code = 'bi_dashboard:read' LIMIT 1",
    );
    if (!permission) {
      throw new Error(
        "Permission bi_dashboard:read not found. Run the BI dashboard permission seeder first.",
      );
    }

    await queryInterface.sequelize.query(
      `
        INSERT IGNORE INTO roles_permissions (role_id, permission_id, created_at, updated_at)
        VALUES (:roleId, :permissionId, :createdAt, :updatedAt)
      `,
      {
        replacements: {
          roleId: role.id,
          permissionId: permission.id,
          createdAt: now,
          updatedAt: now,
        },
      },
    );
  },

  async down(queryInterface) {
    const [[role]] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'association' LIMIT 1",
    );
    if (!role) {
      return;
    }

    await queryInterface.sequelize.query(
      `
        DELETE rp FROM roles_permissions rp
        INNER JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = :roleId AND p.code = 'bi_dashboard:read'
      `,
      { replacements: { roleId: role.id } },
    );
  },
};
