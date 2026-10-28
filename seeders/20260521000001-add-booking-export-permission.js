"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // 1. Insert booking:export permission
    await queryInterface.sequelize.query(
      `
        INSERT INTO permissions (name, code, resource, section, created_at, updated_at)
        VALUES (:name, :code, :resource, :section, :createdAt, :updatedAt)
        ON DUPLICATE KEY UPDATE
          name     = VALUES(name),
          resource = VALUES(resource),
          section  = VALUES(section),
          updated_at = VALUES(updated_at)
      `,
      {
        replacements: {
          name: "Export Booking Statement",
          code: "booking:export",
          resource: "booking",
          section: "Booking Management",
          createdAt: now,
          updatedAt: now,
        },
      },
    );

    // 2. Assign booking:export to operator_admin only (account statement).
    // It used to go to every role; migration
    // 20261028140000-restrict-booking-export-to-operator-admin removes the
    // extra assignments on databases where this already ran. Superadmin has
    // access through *:*.
    const rolesToAssign = ["operator_admin"];

    const [roles] = await queryInterface.sequelize.query(
      `SELECT id, name FROM roles WHERE name IN (:names)`,
      { replacements: { names: rolesToAssign } },
    );

    const [[permission]] = await queryInterface.sequelize.query(
      `SELECT id FROM permissions WHERE code = 'booking:export' LIMIT 1`,
    );

    if (!permission) return;

    for (const role of roles) {
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
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `
        DELETE rp
        FROM roles_permissions rp
        INNER JOIN permissions p ON p.id = rp.permission_id
        WHERE p.code = 'booking:export'
      `,
    );

    await queryInterface.bulkDelete(
      "permissions",
      { code: "booking:export" },
      {},
    );
  },
};
