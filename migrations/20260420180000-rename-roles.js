"use strict";

/**
 * Rename roles:
 *   admin    → superadmin
 *   operator → operator_admin
 *
 * Add new role:
 *   operator_staff
 */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Rename existing roles
    await queryInterface.sequelize.query(
      `UPDATE roles SET name = 'superadmin', updated_at = :now WHERE name = 'admin'`,
      { replacements: { now } },
    );

    await queryInterface.sequelize.query(
      `UPDATE roles SET name = 'operator_admin', updated_at = :now WHERE name = 'operator'`,
      { replacements: { now } },
    );

    // Insert operator_staff
    await queryInterface.sequelize.query(
      `INSERT INTO roles (name, created_at, updated_at)
       VALUES ('operator_staff', :now, :now)
       ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)`,
      { replacements: { now } },
    );
  },

  async down(queryInterface) {
    const now = new Date();

    await queryInterface.sequelize.query(
      `UPDATE roles SET name = 'admin', updated_at = :now WHERE name = 'superadmin'`,
      { replacements: { now } },
    );

    await queryInterface.sequelize.query(
      `UPDATE roles SET name = 'operator', updated_at = :now WHERE name = 'operator_admin'`,
      { replacements: { now } },
    );

    await queryInterface.sequelize.query(
      `DELETE FROM roles WHERE name = 'operator_staff'`,
    );
  },
};
