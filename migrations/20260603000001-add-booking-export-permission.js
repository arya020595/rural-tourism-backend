"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Insert booking:export permission with all required fields
    await queryInterface.sequelize.query(`
      INSERT INTO permissions (name, code, resource, section, created_at, updated_at)
      VALUES ('Export Booking Report', 'booking:export', 'booking', 'Booking Management', NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        name = 'Export Booking Report',
        resource = 'booking',
        section = 'Booking Management',
        updated_at = NOW()
    `);

    // Assign to operator_admin only
    await queryInterface.sequelize.query(`
      INSERT IGNORE INTO roles_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r, permissions p
      WHERE r.name = 'operator_admin'
        AND p.code = 'booking:export'
    `);
  },

  async down(queryInterface) {
    // Remove role assignments
    await queryInterface.sequelize.query(`
      DELETE rp FROM roles_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.code = 'booking:export'
    `);

    // Remove the permission itself
    await queryInterface.sequelize.query(`
      DELETE FROM permissions WHERE code = 'booking:export'
    `);
  },
};
