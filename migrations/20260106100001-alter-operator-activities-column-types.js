"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Change description from STRING(255) to TEXT for longer descriptions
    await queryInterface.changeColumn("operator_activities", "description", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Change services_provided from STRING(255) to TEXT for JSON data
    await queryInterface.changeColumn(
      "operator_activities",
      "services_provided",
      {
        type: Sequelize.TEXT,
        allowNull: true,
      }
    );

    // Make available_dates nullable to allow empty values
    await queryInterface.changeColumn(
      "operator_activities",
      "available_dates",
      {
        type: Sequelize.JSON,
        allowNull: true,
      }
    );
  },

  async down(queryInterface, Sequelize) {
    // Revert changes
    await queryInterface.changeColumn("operator_activities", "description", {
      type: Sequelize.STRING(255),
      allowNull: false,
    });

    await queryInterface.changeColumn(
      "operator_activities",
      "services_provided",
      {
        type: Sequelize.STRING(255),
        allowNull: false,
      }
    );

    await queryInterface.changeColumn(
      "operator_activities",
      "available_dates",
      {
        type: Sequelize.JSON,
        allowNull: false,
      }
    );
  },
};
