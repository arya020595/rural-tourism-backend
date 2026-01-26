"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "activity_booking",
      "time",
      {
        type: Sequelize.STRING, // "2:00 PM - 5:00 PM"
        allowNull: true,
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("activity_booking", "time");
  },
};
