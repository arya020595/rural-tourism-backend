"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Assign dashboard:read and receipt:create to operator_staff
    await queryInterface.sequelize.query(`
      INSERT IGNORE INTO roles_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r, permissions p
      WHERE r.name = 'operator_staff'
        AND p.code IN ('dashboard:read', 'receipt:create')
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE rp FROM roles_permissions rp
      JOIN roles r ON r.id = rp.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE r.name = 'operator_staff'
        AND p.code IN ('dashboard:read', 'receipt:create')
    `);
  },
};
