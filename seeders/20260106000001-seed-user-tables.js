"use strict";

const bcrypt = require("bcrypt");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash("password123", 10);

    // Seed rt_users (operators) - user_id uses auto-increment (PostgreSQL SERIAL style)
    await queryInterface.bulkInsert("rt_users", [
      {
        // user_id: 1 (auto-generated)
        username: "operator1",
        email_address: "operator1@example.com",
        password: hashedPassword,
        owner_full_name: "John Operator",
        operator_logo_image: "default_logo.png",
        business_name: "Sabah Adventure Tours",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // user_id: 2 (auto-generated)
        username: "operator2",
        email_address: "operator2@example.com",
        password: hashedPassword,
        owner_full_name: "Jane Operator",
        operator_logo_image: "default_logo.png",
        business_name: "Kinabalu Homestay",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // user_id: 3 (auto-generated)
        username: "operator3",
        email_address: "operator3@example.com",
        password: hashedPassword,
        owner_full_name: "Ahmad Operator",
        operator_logo_image: "default_logo.png",
        business_name: "Riverside Retreat",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Seed tourist_users - tourist_user_id uses auto-increment (PostgreSQL SERIAL style)
    await queryInterface.bulkInsert("tourist_users", [
      {
        // tourist_user_id: 1 (auto-generated)
        full_name: "Alice Tourist",
        contact_no: "+60123456789",
        username: "alice_tourist",
        email: "alice@tourist.com",
        nationality: "Malaysian",
        password: hashedPassword,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // tourist_user_id: 2 (auto-generated)
        full_name: "Bob Traveler",
        contact_no: "+60198765432",
        username: "bob_traveler",
        email: "bob@traveler.com",
        nationality: "Singaporean",
        password: hashedPassword,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // tourist_user_id: 3 (auto-generated)
        full_name: "Charlie Explorer",
        contact_no: "+60112233445",
        username: "charlie_explorer",
        email: "charlie@explorer.com",
        nationality: "Australian",
        password: hashedPassword,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // tourist_user_id: 4 (auto-generated)
        full_name: "Diana Adventurer",
        contact_no: "+60155667788",
        username: "diana_adventure",
        email: "diana@adventure.com",
        nationality: "British",
        password: hashedPassword,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("tourist_users", null, {});
    await queryInterface.bulkDelete("rt_users", null, {});
  },
};
