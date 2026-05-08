"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("bookings", "phone_number", {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: "Tourist contact phone number",
    });

    await queryInterface.addColumn("bookings", "email", {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: "Tourist contact email address",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("bookings", "phone_number");
    await queryInterface.removeColumn("bookings", "email");
  },
};
