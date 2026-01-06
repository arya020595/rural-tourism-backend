"use strict";

const bcrypt = require("bcrypt");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash("password123", 10);

    // Seed rt_users (operators)
    await queryInterface.bulkInsert("rt_users", [
      {
        user_id: "OP001",
        username: "operator1",
        user_email: "operator1@example.com",
        password: hashedPassword,
        full_name: "John Operator",
        security_Q1: "What is your pet name?",
        security_Q2: "What is your favorite color?",
        company_logo: "default_logo.png",
        business_name: "Sabah Adventure Tours",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        user_id: "OP002",
        username: "operator2",
        user_email: "operator2@example.com",
        password: hashedPassword,
        full_name: "Jane Operator",
        security_Q1: "What is your hometown?",
        security_Q2: "What is your mother's name?",
        company_logo: "default_logo.png",
        business_name: "Kinabalu Homestay",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        user_id: "OP003",
        username: "operator3",
        user_email: "operator3@example.com",
        password: hashedPassword,
        full_name: "Ahmad Operator",
        security_Q1: "What is your school name?",
        security_Q2: "What is your birth year?",
        company_logo: "default_logo.png",
        business_name: "Riverside Retreat",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Seed tourist_users
    await queryInterface.bulkInsert("tourist_users", [
      {
        tourist_user_id: "TU001",
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
        tourist_user_id: "TU002",
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
        tourist_user_id: "TU003",
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
        tourist_user_id: "TU004",
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
