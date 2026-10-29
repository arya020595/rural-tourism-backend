"use strict";

/**
 * booking:export (account statement: My Transactions → Generate / Download
 * Report) is for operator_admin only.
 *
 * Seeder 20260521000001-add-booking-export-permission gave it to every role
 * (operator_staff, association, tourist too). Migration 20260603000001 then
 * meant to limit it to operator_admin but only ADDED it there — it never
 * removed the other roles. This removes it from everyone except
 * operator_admin (superadmin keeps access through *:*).
 */
const OTHER_ROLES = ["superadmin", "operator_staff", "association", "tourist"];

module.exports = {
  async up(queryInterface) {
    // Make sure operator_admin has it (self-contained).
    await queryInterface.sequelize.query(`
      INSERT IGNORE INTO roles_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r, permissions p
      WHERE r.name = 'operator_admin'
        AND p.code = 'booking:export'
    `);

    await queryInterface.sequelize.query(`
      DELETE rp FROM roles_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      JOIN roles r ON r.id = rp.role_id
      WHERE p.code = 'booking:export'
        AND r.name <> 'operator_admin'
    `);
  },

  // Puts back the assignments the old seeder made.
  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `
        INSERT IGNORE INTO roles_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.name IN (:roles)
          AND p.code = 'booking:export'
      `,
      { replacements: { roles: OTHER_ROLES } },
    );
  },
};
