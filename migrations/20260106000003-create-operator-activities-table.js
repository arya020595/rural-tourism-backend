"use strict";

/**
 * Migration: Create operator_activities table
 *
 * This table stores activities offered by tour operators with proper schema
 * matching the Sequelize model definitions.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
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
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      address: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      district: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      image: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },
      operator_logo: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      services_provided: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      available_dates: {
        type: Sequelize.JSON,
        allowNull: true,
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

    // Create indexes for better query performance
    await queryInterface.addIndex("operator_activities", ["activity_id"]);
    await queryInterface.addIndex("operator_activities", ["rt_user_id"]);
    await queryInterface.addIndex("operator_activities", ["district"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("operator_activities");
  },
};
