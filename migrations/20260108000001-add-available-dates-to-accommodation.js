"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add available_dates column to accommodation_list table
    await queryInterface.addColumn("accommodation_list", "available_dates", {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove available_dates column
    await queryInterface.removeColumn("accommodation_list", "available_dates");
  },
};
