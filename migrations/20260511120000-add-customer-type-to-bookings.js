"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("bookings", "customer_type", {
      type: Sequelize.ENUM("tourist", "company"),
      allowNull: false,
      defaultValue: "tourist",
    });

    await queryInterface.addIndex("bookings", ["customer_type"], {
      name: "bookings_customer_type_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("bookings", "bookings_customer_type_idx");
    await queryInterface.removeColumn("bookings", "customer_type");
  },
};
