"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("bookings", {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      booking_type: {
        type: Sequelize.ENUM("activity", "accommodation", "package"),
        allowNull: false,
      },
      tourist_full_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      citizenship: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      no_of_pax_antarbangsa: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      no_of_pax_domestik: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "products",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      product_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      activity_date: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      total_price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      user_fullname: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      check_in_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      check_out_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      total_of_night: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "pending",
      },
      receipt_created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      operator_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "company",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      company_name: {
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
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
        ),
      },
    });

    await queryInterface.addIndex("bookings", ["booking_type"], {
      name: "bookings_booking_type_idx",
    });
    await queryInterface.addIndex("bookings", ["user_id"], {
      name: "bookings_user_id_idx",
    });
    await queryInterface.addIndex("bookings", ["status"], {
      name: "bookings_status_idx",
    });
    await queryInterface.addIndex("bookings", ["activity_date"], {
      name: "bookings_activity_date_idx",
    });
    await queryInterface.addIndex("bookings", ["product_id"], {
      name: "bookings_product_id_idx",
    });
    await queryInterface.addIndex("bookings", ["company_id"], {
      name: "bookings_company_id_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("bookings");
  },
};
