"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create form_responses table
    await queryInterface.createTable("form_responses", {
      reciept_id: {
        type: Sequelize.STRING(255),
        primaryKey: true,
        allowNull: false,
      },
      operator_user_id: {
        type: Sequelize.STRING(255),
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
        type: Sequelize.INTEGER(11),
        allowNull: false,
      },
      activity_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      tourist_user_id: {
        type: Sequelize.STRING(12),
        allowNull: false,
        references: {
          model: "tourist_users",
          key: "tourist_user_id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      homeest_name: {
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
        type: Sequelize.INTEGER(11),
        allowNull: true,
        defaultValue: null,
        references: {
          model: "accomodation_list",
          key: "accomodation_id",
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
      status: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      date: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
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
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("form_responses");
  },
};
