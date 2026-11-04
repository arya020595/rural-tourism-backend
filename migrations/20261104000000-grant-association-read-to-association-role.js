"use strict";

/**
 * Gives the association role `association:read` again, so association users
 * can open the Association Statistics page (menu item + GET
 * /api/dashboard/my-association-stats and /my-association-members/:companyId).
 *
 * Seeder 20260423000003-update-association-role-permissions.js had reduced the
 * association role to bi_dashboard:read only, so on staging/production the
 * statistics page was missing from the association menu. association:read only
 * unlocks those two endpoints, and both are limited to the user's own
 * association (and approved member companies; see associationMemberPolicy).
 *
 * Self-contained (CLAUDE.md): creates the permission if it does not exist.
 */

const PERMISSION = {
  name: "View Association",
  code: "association:read",
  resource: "association",
  section: "Association Management",
};

module.exports = {
  async up(queryInterface) {
    // INSERT IGNORE: keep the existing row (from the RBAC seeder) untouched.
    await queryInterface.sequelize.query(
      `INSERT IGNORE INTO permissions (name, code, resource, section, created_at, updated_at)
       VALUES (:name, :code, :resource, :section, NOW(), NOW())`,
      { replacements: PERMISSION },
    );
    await queryInterface.sequelize.query(
      `INSERT IGNORE INTO roles_permissions (role_id, permission_id)
       SELECT r.id, p.id
       FROM roles r, permissions p
       WHERE r.name = 'association' AND p.code = :code`,
      { replacements: { code: PERMISSION.code } },
    );
  },

  async down(queryInterface) {
    // Only take it away from the association role; the permission itself and
    // other roles' grants predate this migration.
    await queryInterface.sequelize.query(
      `DELETE rp FROM roles_permissions rp
       JOIN roles r ON r.id = rp.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE r.name = 'association' AND p.code = :code`,
      { replacements: { code: PERMISSION.code } },
    );
  },
};
