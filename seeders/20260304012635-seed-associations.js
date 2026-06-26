"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const seedRows = [
      {
        name: "KOTA BELUD TOURISM ASSOCIATION (KOBETA)",
        image: "/uploads/associations/kobeta_logo.jpg",
        created_at: now,
        updated_at: now,
      },
      {
        name: "RANAU TOURISM ASSOCIATION (RATA)",
        image: "/uploads/associations/rata_logo.jpg",
        created_at: now,
        updated_at: now,
      },
      {
        name: "KOTA MARUDU TOURISM DEVELOPMENT ASSOCIATION (KOMTDA)",
        image: "/uploads/associations/komtda_logo.jpg",
        created_at: now,
        updated_at: now,
      },
      {
        name: "PERSATUAN PELANCONGAN ULU SUGUT (USTA)",
        image: "/uploads/associations/usta_logo.jpg",
        created_at: now,
        updated_at: now,
      },
      {
        name: "NABALU TOURISM ASSOCIATION (NTA)",
        image: "/uploads/associations/nta_logo.jpg",
        created_at: now,
        updated_at: now,
      },
      {
        name: "PERSATUAN PELANCONGAN KADAMAIAN SABAH (KATA)",
        image: "/uploads/associations/kata_logo.jpg",
        created_at: now,
        updated_at: now,
      },
      {
        name: "KIULU TOURISM ASSOCIATION (KTA)",
        image: "/uploads/associations/kta_logo.jpg",
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
      name: [
        "KOTA BELUD TOURISM ASSOCIATION (KOBETA)",
        "RANAU TOURISM ASSOCIATION (RATA)",
        "KOTA MARUDU TOURISM DEVELOPMENT ASSOCIATION (KOMTDA)",
        "PERSATUAN PELANCONGAN ULU SUGUT (USTA)",
        "NABALU TOURISM ASSOCIATION (NTA)",
        "PERSATUAN PELANCONGAN KADAMAIAN SABAH (KATA)",
        "KIULU TOURISM ASSOCIATION (KTA)",
      ],
    });
  },
};
