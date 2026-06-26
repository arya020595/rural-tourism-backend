"use strict";

/**
 * Adds the Kiulu Tourism Association (KTA) — a new association that was missing
 * from the original seed data. Idempotent: inserts only if a row with the same
 * name does not already exist (respects the unique name index).
 */
const ASSOCIATION = {
  name: "KIULU TOURISM ASSOCIATION (KTA)",
  image: "/uploads/associations/kta_logo.jpg",
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.sequelize.query(
      `
        SELECT id FROM associations
        WHERE name = :name AND deleted_at IS NULL
      `,
      {
        replacements: { name: ASSOCIATION.name },
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    if (existing.length === 0) {
      const now = new Date();
      await queryInterface.bulkInsert("associations", [
        {
          name: ASSOCIATION.name,
          image: ASSOCIATION.image,
          created_at: now,
          updated_at: now,
        },
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("associations", {
      name: ASSOCIATION.name,
    });
  },
};
