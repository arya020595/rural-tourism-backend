"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const permissions = [
      {
        name: "View Roles",
        code: "role:read",
        resource: "role",
        section: "Role Management",
      },
      {
        name: "Create Role",
        code: "role:create",
        resource: "role",
        section: "Role Management",
      },
      {
        name: "Update Role",
        code: "role:update",
        resource: "role",
        section: "Role Management",
      },
      {
        name: "Delete Role",
        code: "role:delete",
        resource: "role",
        section: "Role Management",
      },
    ];

    for (const permission of permissions) {
      await queryInterface.sequelize.query(
        `
          INSERT IGNORE INTO permissions
            (name, code, resource, section, created_at, updated_at)
          VALUES
            (:name, :code, :resource, :section, NOW(), NOW())
        `,
        { replacements: permission },
      );
    }

    // Assign all role:* permissions to the superadmin role only
    await queryInterface.sequelize.query(
      `
        INSERT IGNORE INTO roles_permissions
          (role_id, permission_id, created_at, updated_at)
        SELECT r.id, p.id, NOW(), NOW()
        FROM roles r
        INNER JOIN permissions p
        WHERE r.name = 'superadmin'
          AND p.code IN ('role:read', 'role:create', 'role:update', 'role:delete')
      `,
    );
  },

  async down(queryInterface) {
    // Remove role:* permissions from superadmin role
    await queryInterface.sequelize.query(
      `
        DELETE rp
        FROM roles_permissions rp
        INNER JOIN roles r ON r.id = rp.role_id
        INNER JOIN permissions p ON p.id = rp.permission_id
        WHERE r.name = 'superadmin'
          AND p.code IN ('role:read', 'role:create', 'role:update', 'role:delete')
      `,
    );

    // Remove the permissions themselves (only if not assigned to any other role)
    await queryInterface.sequelize.query(
      `
        DELETE FROM permissions
        WHERE code IN ('role:read', 'role:create', 'role:update', 'role:delete')
          AND NOT EXISTS (
            SELECT 1
            FROM roles_permissions rp
            WHERE rp.permission_id = permissions.id
          )
      `,
    );
  },
};
