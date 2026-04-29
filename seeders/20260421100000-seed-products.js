"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Fetch the first two existing companies at runtime to avoid hard-coded FK references
    const [companies] = await queryInterface.sequelize.query(
      "SELECT id FROM companies ORDER BY id ASC LIMIT 2",
    );

    if (companies.length === 0) {
      console.warn("No companies found – skipping product seed.");
      return;
    }

    const company1Id = companies[0].id;
    const company2Id = companies.length > 1 ? companies[1].id : companies[0].id;

    // Sample products for master data
    const products = [
      {
        company_id: company1Id,
        name: "Kayaking",
        product_type: "activity",
        created_at: now,
        updated_at: now,
      },
      {
        company_id: company1Id,
        name: "Rafting",
        product_type: "activity",
        created_at: now,
        updated_at: now,
      },
      {
        company_id: company1Id,
        name: "Resort Sentosa",
        product_type: "accommodation",
        created_at: now,
        updated_at: now,
      },
      {
        company_id: company1Id,
        name: "Jungle Lodge",
        product_type: "accommodation",
        created_at: now,
        updated_at: now,
      },
      {
        company_id: company2Id,
        name: "Hiking",
        product_type: "activity",
        created_at: now,
        updated_at: now,
      },
      {
        company_id: company2Id,
        name: "Rock Climbing",
        product_type: "activity",
        created_at: now,
        updated_at: now,
      },
      {
        company_id: company2Id,
        name: "Mountain Resort",
        product_type: "accommodation",
        created_at: now,
        updated_at: now,
      },
      {
        company_id: company2Id,
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
