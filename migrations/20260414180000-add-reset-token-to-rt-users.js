"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "rt_users";
    const table = await queryInterface.describeTable(tableName);

    if (!table.reset_token) {
      await queryInterface.addColumn(tableName, "reset_token", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    if (!table.reset_token_expires) {
      await queryInterface.addColumn(tableName, "reset_token_expires", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableName = "rt_users";
    const table = await queryInterface.describeTable(tableName);

    if (table.reset_token_expires) {
      await queryInterface.removeColumn(tableName, "reset_token_expires");
    }

    if (table.reset_token) {
      await queryInterface.removeColumn(tableName, "reset_token");
    }
  },
};
