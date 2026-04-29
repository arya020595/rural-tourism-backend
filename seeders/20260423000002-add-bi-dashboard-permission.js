"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.sequelize.query(
      `
        INSERT INTO permissions (name, code, resource, section, created_at, updated_at)
        VALUES (:name, :code, :resource, :section, :createdAt, :updatedAt)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          resource = VALUES(resource),
          section = VALUES(section),
          updated_at = VALUES(updated_at)
      `,
      {
        replacements: {
          name: "View BI Dashboard",
          code: "bi_dashboard:read",
          resource: "bi_dashboard",
          section: "BI Dashboard",
          createdAt: now,
          updatedAt: now,
        },
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      "permissions",
      { code: "bi_dashboard:read" },
      {},
    );
  },
};
