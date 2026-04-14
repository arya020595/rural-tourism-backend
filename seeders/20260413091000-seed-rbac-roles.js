"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const roles = ["admin", "operator", "tourist", "association"];

    for (const roleName of roles) {
      await queryInterface.sequelize.query(
        `
          INSERT INTO roles (name, created_at, updated_at)
          VALUES (:name, :createdAt, :updatedAt)
          ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)
        `,
        {
          replacements: {
            name: roleName,
            createdAt: now,
            updatedAt: now,
          },
        },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      "roles",
      {
        name: ["admin", "operator", "tourist", "association"],
      },
      {},
    );
  },
};
