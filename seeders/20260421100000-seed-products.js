"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    
    // Sample products for master data
    // Assuming companies exist with different locations
    const products = [
      {
        company_id: 1,
        name: "Kayaking",
        product_type: "activity",
        created_at: now,
        updated_at: now,
      },
      {
        company_id: 1,
        name: "Rafting",
        product_type: "activity",
        created_at: now,
        updated_at: now,
      },
      {
        company_id: 1,
        name: "Resort Sentosa",
        product_type: "accommodation",
        created_at: now,
        updated_at: now,
      },
      {
        company_id: 1,
        name: "Jungle Lodge",
        product_type: "accommodation",
        created_at: now,
        updated_at: now,
      },
      {
        company_id: 2,
        name: "Hiking",
        product_type: "activity",
        created_at: now,
        updated_at: now,
      },
      {
        company_id: 2,
        name: "Rock Climbing",
        product_type: "activity",
        created_at: now,
        updated_at: now,
      },
      {
        company_id: 2,
        name: "Mountain Resort",
        product_type: "accommodation",
        created_at: now,
        updated_at: now,
      },
      {
        company_id: 2,
        name: "Eco Camp",
        product_type: "accommodation",
        created_at: now,
        updated_at: now,
      },
    ];

    await queryInterface.bulkInsert("products", products, {
      ignoreDuplicates: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("products", null, {});
  },
};
