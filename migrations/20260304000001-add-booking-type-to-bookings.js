"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add booking_type column to activity_booking table
    await queryInterface.addColumn("activity_booking", "booking_type", {
      type: Sequelize.ENUM("guest", "manual"),
      allowNull: false,
      defaultValue: "guest",
      comment:
        "Differentiates between guest booking and manual booking by operator",
    });

    // Add booking_type column to accommodation_booking table
    await queryInterface.addColumn("accommodation_booking", "booking_type", {
      type: Sequelize.ENUM("guest", "manual"),
      allowNull: false,
      defaultValue: "guest",
      comment:
        "Differentiates between guest booking and manual booking by operator",
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove booking_type column from activity_booking
    await queryInterface.removeColumn("activity_booking", "booking_type");

    // Remove booking_type column from accommodation_booking
    await queryInterface.removeColumn("accommodation_booking", "booking_type");

    // Drop the ENUM types (MySQL handles this automatically, but good practice)
    // For PostgreSQL, you would need: await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_activity_booking_booking_type";');
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_accommodation_booking_booking_type";');
  },
};
