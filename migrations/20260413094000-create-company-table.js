"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("company", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      company_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      postcode: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      total_fulltime_staff: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      total_partime_staff: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      contact_no: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      operator_logo_image: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },
      motac_license_file: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },
      trading_operation_license: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },
      homestay_certificate: {
        type: Sequelize.TEXT("long"),
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

    await queryInterface.addConstraint("users", {
      fields: ["company_id"],
      type: "foreign key",
      name: "users_company_id_foreign_idx",
      references: {
        table: "company",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint("users", "users_company_id_foreign_idx");
    await queryInterface.dropTable("company");
  },
};
