"use strict";

/**
 * Role Management permissions (role:*) must only belong to the superadmin role.
 * This migration removes them from any other role they may have been assigned to.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `
        DELETE rp
        FROM roles_permissions rp
        INNER JOIN roles r ON r.id = rp.role_id
        INNER JOIN permissions p ON p.id = rp.permission_id
        WHERE r.name != 'superadmin'
          AND p.code IN ('role:read', 'role:create', 'role:update', 'role:delete')
      `,
    );
  },

  async down(queryInterface) {
    // Re-assign role:read/create/update to operator_admin, operator_staff, association
    // (matches the original ALL_ADMIN_PERMISSIONS seeder)
    await queryInterface.sequelize.query(
      `
        INSERT IGNORE INTO roles_permissions
          (role_id, permission_id, created_at, updated_at)
        SELECT r.id, p.id, NOW(), NOW()
        FROM roles r
        INNER JOIN permissions p
        WHERE r.name IN ('operator_admin', 'operator_staff', 'association')
          AND p.code IN ('role:read', 'role:create', 'role:update')
      `,
    );
  },
};
