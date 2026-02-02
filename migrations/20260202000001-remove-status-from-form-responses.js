"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Intentionally left as a no-op: retain the `status` column on form_responses
    // because existing application code still depends on it.
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
