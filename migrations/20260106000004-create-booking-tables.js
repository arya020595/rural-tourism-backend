"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create activity_booking table
    await queryInterface.createTable("activity_booking", {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      tourist_user_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        references: {
          model: "tourist_users",
          key: "tourist_user_id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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
      operator_activity_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        references: {
          model: "operator_activities",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      total_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      no_of_pax: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      contact_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      contact_phone: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      nationality: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(255),
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
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    // Create accommodation_booking table
    await queryInterface.createTable("accommodation_booking", {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      tourist_user_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        references: {
          model: "tourist_users",
          key: "tourist_user_id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      accommodation_id: {
        type: Sequelize.INTEGER(11),
        allowNull: false,
        references: {
          model: "accommodation_list",
          key: "accommodation_id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      check_in: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      check_out: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      total_no_of_nights: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      total_price: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      no_of_pax: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      contact_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      contact_email: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      contact_phone: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      nationality: {
        type: Sequelize.STRING(255),
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
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("accommodation_booking");
    await queryInterface.dropTable("activity_booking");
  },
};
