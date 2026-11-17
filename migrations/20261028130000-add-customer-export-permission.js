"use strict";

/**
 * customer:export — "Export Customer List (Excel)": the dashboard's Download
 * Excel button (receipts, customers with phone/email/total spent, monthly
 * summary). Separate from booking:export (the account statement) because the
 * file carries customer contact details and spending.
 *
 * Self-contained (CLAUDE.md): creates the permission and gives it to
 * operator_admin; superadmin has *:*. Other roles can be given it from Roles
 * & Permissions.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO permissions (name, code, resource, section, created_at, updated_at)
      VALUES ('Export Customer List (Excel)', 'customer:export', 'customer', 'Dashboard', NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        name = 'Export Customer List (Excel)',
        resource = 'customer',
        section = 'Dashboard',
        updated_at = NOW()
    `);

    await queryInterface.sequelize.query(`
      INSERT IGNORE INTO roles_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r, permissions p
      WHERE r.name = 'operator_admin'
        AND p.code = 'customer:export'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE rp FROM roles_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.code = 'customer:export'
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM permissions WHERE code = 'customer:export'
    `);
  },
};
