"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const addRoleColumnIfMissing = async (tableName) => {
      const table = await queryInterface.describeTable(tableName);

      if (!table.role_id) {
        await queryInterface.addColumn(tableName, "role_id", {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "roles",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        });
      }
    };

    await addRoleColumnIfMissing("rt_users");
    await addRoleColumnIfMissing("tourist_users");
    await addRoleColumnIfMissing("association_users");
  },

  async down(queryInterface) {
    const removeRoleColumnIfExists = async (tableName) => {
      const table = await queryInterface.describeTable(tableName);

      if (table.role_id) {
        await queryInterface.removeColumn(tableName, "role_id");
      }
    };

    await removeRoleColumnIfExists("association_users");
    await removeRoleColumnIfExists("tourist_users");
    await removeRoleColumnIfExists("rt_users");
  },
};
