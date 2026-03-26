"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("rt_users");

    if (
      table.operator_logo_image &&
      table.operator_logo_image.allowNull === false
    ) {
      await queryInterface.changeColumn("rt_users", "operator_logo_image", {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("rt_users");

    if (
      table.operator_logo_image &&
      table.operator_logo_image.allowNull === true
    ) {
      await queryInterface.changeColumn("rt_users", "operator_logo_image", {
        type: Sequelize.TEXT("long"),
        allowNull: false,
      });
    }
  },
};
