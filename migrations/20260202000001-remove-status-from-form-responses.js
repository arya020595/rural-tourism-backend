"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove status column from form_responses table
    await queryInterface.removeColumn("form_responses", "status");
  },

  async down(queryInterface, Sequelize) {
    // Add status column back to form_responses table
    await queryInterface.addColumn("form_responses", "status", {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
  },
};
