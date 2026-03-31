"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "rt_users";
    const table = await queryInterface.describeTable(tableName);

    if (!table.poscode) {
      await queryInterface.addColumn(tableName, "poscode", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableName = "rt_users";
    const table = await queryInterface.describeTable(tableName);

    if (table.poscode) {
      await queryInterface.removeColumn(tableName, "poscode");
    }
  },
};
