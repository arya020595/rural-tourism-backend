"use strict";

/**
 * Deposits can include cents (e.g. RM3.50), matching total_price, which is
 * already DECIMAL(12,2). Widening INTEGER -> DECIMAL(12,2) is lossless for
 * existing rows (120 -> 120.00).
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("bookings", "total_deposit", {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Rolling back rounds any deposit with cents to a whole number.
    await queryInterface.changeColumn("bookings", "total_deposit", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },
};
