"use strict";

/**
 * Audit columns for the "Recall Booking" action (paid → pending). Records who
 * recalled the booking and when, so a reverted payment leaves a trail.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("bookings", "recalled_by", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn("bookings", "recalled_at", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("bookings", "recalled_by");
    await queryInterface.removeColumn("bookings", "recalled_at");
  },
};
