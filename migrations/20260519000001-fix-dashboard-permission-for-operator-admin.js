"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `INSERT IGNORE INTO permissions
        (name, code, resource, section, created_at, updated_at)
      VALUES
        ('View Dashboard', 'dashboard:read', 'dashboard', 'Dashboard', NOW(), NOW())`
    );

    await queryInterface.sequelize.query(
      `INSERT IGNORE INTO roles_permissions
        (role_id, permission_id, created_at, updated_at)
      SELECT r.id, p.id, NOW(), NOW()
      FROM
        (SELECT id FROM roles WHERE name = 'operator_admin' LIMIT 1) AS r,
        (SELECT id FROM permissions WHERE code = 'dashboard:read' LIMIT 1) AS p`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE rp
      FROM roles_permissions rp
      INNER JOIN roles r ON r.id = rp.role_id
      INNER JOIN permissions p ON p.id = rp.permission_id
      WHERE r.name = 'operator_admin'
        AND p.code = 'dashboard:read'`
    );
  },
};
