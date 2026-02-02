"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create operator_activities table - using INTEGER AUTO_INCREMENT (PostgreSQL SERIAL style)
    await queryInterface.createTable("operator_activities", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      activity_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: "activity_master_table",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      rt_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "rt_users",
          key: "user_id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      address: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      district: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      image: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      services_provided: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      available_dates: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      price_per_pax: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
        ),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("operator_activities");
  },
};
