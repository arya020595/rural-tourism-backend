"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("form_responses", "booking_type", {
      type: Sequelize.ENUM("guest", "manual"),
      allowNull: false,
      defaultValue: "guest",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("form_responses", "booking_type");
  },
};
