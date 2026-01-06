"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create rt_users table
    await queryInterface.createTable("rt_users", {
      user_id: {
        type: Sequelize.STRING(255),
        primaryKey: true,
        allowNull: false,
      },
      username: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      user_email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      full_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      security_Q1: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      security_Q2: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      company_logo: {
        type: Sequelize.TEXT("long"),
        allowNull: false,
      },
      business_name: {
        type: Sequelize.STRING(255),
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

    // Create tourist_users table
    await queryInterface.createTable("tourist_users", {
      tourist_user_id: {
        type: Sequelize.STRING(255),
        primaryKey: true,
        allowNull: false,
      },
      full_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      contact_no: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      username: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      nationality: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false,
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
    await queryInterface.dropTable("tourist_users");
    await queryInterface.dropTable("rt_users");
  },
};
