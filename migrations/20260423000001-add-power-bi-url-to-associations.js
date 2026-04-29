"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("associations", "power_bi_url", {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      after: "image",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("associations", "power_bi_url");
  },
};
