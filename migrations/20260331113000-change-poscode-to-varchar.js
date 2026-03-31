"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "rt_users";
    const table = await queryInterface.describeTable(tableName);

    if (table.poscode) {
      await queryInterface.changeColumn(tableName, "poscode", {
        type: Sequelize.STRING(5),
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableName = "rt_users";
    const table = await queryInterface.describeTable(tableName);

    if (table.poscode) {
      await queryInterface.changeColumn(tableName, "poscode", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },
};
