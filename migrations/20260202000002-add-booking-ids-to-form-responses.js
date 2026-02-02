"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add activity_booking_id column to form_responses table
    await queryInterface.addColumn("form_responses", "activity_booking_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      defaultValue: null,
      references: {
        model: "activity_booking",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    // Add accommodation_booking_id column to form_responses table
    await queryInterface.addColumn(
      "form_responses",
      "accommodation_booking_id",
      {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
        references: {
          model: "accommodation_booking",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
    );
  },

  async down(queryInterface, Sequelize) {
    // Remove the columns
    await queryInterface.removeColumn("form_responses", "activity_booking_id");
    await queryInterface.removeColumn(
      "form_responses",
      "accommodation_booking_id",
    );
  },
};
