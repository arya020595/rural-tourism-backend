"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const seedRows = [
      {
        name: "KOBETA",
        image: "/uploads/associations/kobeta_logo.jpg",
        created_at: now,
        updated_at: now,
      },
      {
        name: "RATA",
        image: "/uploads/associations/rata_logo.jpg",
        created_at: now,
        updated_at: now,
      },
      {
        name: "KOMTDA",
        image: "/uploads/associations/komtda_logo.jpg",
        created_at: now,
        updated_at: now,
      },
      {
        name: "USTA",
        image: "/uploads/associations/usta_logo.jpg",
        created_at: now,
        updated_at: now,
      },
      {
        name: "NTA",
        image: "/uploads/associations/nta_logo.jpg",
        created_at: now,
        updated_at: now,
      },
      {
        name: "KATA",
        image: "/uploads/associations/kata_logo.jpg",
        created_at: now,
        updated_at: now,
      },
    ];

    const existingRows = await queryInterface.sequelize.query(
      "SELECT name FROM associations WHERE deleted_at IS NULL",
      { type: Sequelize.QueryTypes.SELECT },
    );

    const existingNames = new Set(
      existingRows.map((row) => String(row.name || "").trim().toLowerCase()),
    );

    const rowsToInsert = seedRows.filter(
      (row) => !existingNames.has(String(row.name || "").trim().toLowerCase()),
    );

    if (rowsToInsert.length > 0) {
      await queryInterface.bulkInsert("associations", rowsToInsert);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("associations", {
      name: ["KOBETA", "RATA", "KOMTDA", "USTA", "NTA", "KATA"],
    });
  },
};
