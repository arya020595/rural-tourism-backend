"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert("associations", [
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
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("associations", {
      name: ["KOBETA", "RATA", "KOMTDA", "USTA", "NTA", "KATA"],
    });
  },
};
