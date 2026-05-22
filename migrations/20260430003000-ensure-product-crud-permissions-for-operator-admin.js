"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const permissions = [
      {
        name: "Create Product",
        code: "product:create",
        resource: "product",
        section: "Product Management",
      },
      {
        name: "View Products",
        code: "product:read",
        resource: "product",
        section: "Product Management",
      },
      {
        name: "Update Product",
        code: "product:update",
        resource: "product",
        section: "Product Management",
      },
      {
        name: "Delete Product",
        code: "product:delete",
        resource: "product",
        section: "Product Management",
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

    await queryInterface.sequelize.query(
      `
        INSERT IGNORE INTO roles_permissions
          (role_id, permission_id, created_at, updated_at)
        SELECT r.id, p.id, NOW(), NOW()
        FROM roles r
        INNER JOIN permissions p
        WHERE r.name = 'operator_admin'
          AND p.code IN ('product:create', 'product:read', 'product:update', 'product:delete')
      `,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `
        DELETE rp
        FROM roles_permissions rp
        INNER JOIN roles r ON r.id = rp.role_id
        INNER JOIN permissions p ON p.id = rp.permission_id
        WHERE r.name = 'operator_admin'
          AND p.code IN ('product:create', 'product:read', 'product:update', 'product:delete')
      `,
    );

    await queryInterface.sequelize.query(
      `
        DELETE FROM permissions
        WHERE code IN ('product:create', 'product:read', 'product:update', 'product:delete')
          AND NOT EXISTS (
            SELECT 1
            FROM roles_permissions rp
            WHERE rp.permission_id = permissions.id
          )
      `,
    );
  },
};
