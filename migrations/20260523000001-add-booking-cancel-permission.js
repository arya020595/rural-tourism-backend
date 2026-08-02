"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // 1. Rename booking:delete permission name to reflect its true purpose
    await queryInterface.sequelize.query(
      `UPDATE permissions SET name = 'Delete Booking', updated_at = NOW() WHERE code = 'booking:delete'`,
    );

    // 2. Add booking:cancel permission
    await queryInterface.sequelize.query(
      `
        INSERT IGNORE INTO permissions
          (name, code, resource, section, created_at, updated_at)
        VALUES
          ('Cancel Booking', 'booking:cancel', 'booking', 'Booking Management', NOW(), NOW())
      `,
    );

    // 2. Assign booking:cancel to operator_admin
    await queryInterface.sequelize.query(
      `
        INSERT IGNORE INTO roles_permissions
          (role_id, permission_id, created_at, updated_at)
        SELECT r.id, p.id, NOW(), NOW()
        FROM roles r
        INNER JOIN permissions p
        WHERE r.name = 'operator_admin'
          AND p.code = 'booking:cancel'
      `,
    );

    // 3. Remove booking:delete from operator_admin (it implies hard delete, superadmin only)
    await queryInterface.sequelize.query(
      `
        DELETE rp
        FROM roles_permissions rp
        INNER JOIN roles r ON r.id = rp.role_id
        INNER JOIN permissions p ON p.id = rp.permission_id
        WHERE r.name = 'operator_admin'
          AND p.code = 'booking:delete'
      `,
    );
  },

  async down(queryInterface) {
    // Revert booking:delete name back to original
    await queryInterface.sequelize.query(
      `UPDATE permissions SET name = 'Cancel Booking', updated_at = NOW() WHERE code = 'booking:delete'`,
    );

    // Re-assign booking:delete to operator_admin
    await queryInterface.sequelize.query(
      `
        INSERT IGNORE INTO roles_permissions
          (role_id, permission_id, created_at, updated_at)
        SELECT r.id, p.id, NOW(), NOW()
        FROM roles r
        INNER JOIN permissions p
        WHERE r.name = 'operator_admin'
          AND p.code = 'booking:delete'
      `,
    );

    // Remove booking:cancel from operator_admin
    await queryInterface.sequelize.query(
      `
        DELETE rp
        FROM roles_permissions rp
        INNER JOIN roles r ON r.id = rp.role_id
        INNER JOIN permissions p ON p.id = rp.permission_id
        WHERE r.name = 'operator_admin'
          AND p.code = 'booking:cancel'
      `,
    );

    // Remove booking:cancel permission entirely
    await queryInterface.sequelize.query(
      `
        DELETE FROM permissions
        WHERE code = 'booking:cancel'
          AND NOT EXISTS (
            SELECT 1 FROM roles_permissions rp
            WHERE rp.permission_id = permissions.id
          )
      `,
    );
  },
};
