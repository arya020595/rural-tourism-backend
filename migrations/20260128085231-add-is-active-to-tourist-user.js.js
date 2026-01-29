"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("tourist_users", "is_active", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true, // default active
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("tourist_users", "is_active");
  },
};
