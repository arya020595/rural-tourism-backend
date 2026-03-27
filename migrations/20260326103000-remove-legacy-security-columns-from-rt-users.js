"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "rt_users";
    const table = await queryInterface.describeTable(tableName);

    await queryInterface.sequelize.transaction(async (transaction) => {
      if (table.security_Q1) {
        await queryInterface.removeColumn(tableName, "security_Q1", {
          transaction,
        });
      }

      if (table.security_Q2) {
        await queryInterface.removeColumn(tableName, "security_Q2", {
          transaction,
        });
      }
    });
  },

  async down(queryInterface, Sequelize) {
    const tableName = "rt_users";
    const table = await queryInterface.describeTable(tableName);

    await queryInterface.sequelize.transaction(async (transaction) => {
      if (!table.security_Q1) {
        await queryInterface.addColumn(
          tableName,
          "security_Q1",
          {
            type: Sequelize.STRING(255),
            allowNull: true,
            defaultValue: null,
          },
          { transaction },
        );
      }

      if (!table.security_Q2) {
        await queryInterface.addColumn(
          tableName,
          "security_Q2",
          {
            type: Sequelize.STRING(255),
            allowNull: true,
            defaultValue: null,
          },
          { transaction },
        );
      }
    });
  },
};
