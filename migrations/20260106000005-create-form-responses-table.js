"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create form_responses table - using INTEGER for foreign keys (PostgreSQL SERIAL style)
    await queryInterface.createTable("form_responses", {
      receipt_id: {
        type: Sequelize.STRING(255),
        primaryKey: true,
        allowNull: false,
      },
      operator_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "rt_users",
          key: "user_id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      citizenship: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      pax: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      activity_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      tourist_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "tourist_users",
          key: "tourist_user_id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      homest_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      activity_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
        references: {
          model: "activity_master_table",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      homest_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        references: {
          model: "accommodation_list",
          key: "accommodation_id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      total_rm: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      total_night: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      package: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
        defaultValue: null,
      },
      issuer: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      date: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      activity_booking_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
        references: {
          model: "activity_booking",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      accommodation_booking_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
        references: {
          model: "accommodation_booking",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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
    await queryInterface.dropTable("form_responses");
  },
};
