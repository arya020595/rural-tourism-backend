"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeConstraint("bookings", "bookings_ibfk_2");
    await queryInterface.addConstraint("bookings", {
      fields: ["product_id"],
      type: "foreign key",
      name: "bookings_product_id_fk",
      references: { table: "products", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint("bookings", "bookings_product_id_fk");
    await queryInterface.addConstraint("bookings", {
      fields: ["product_id"],
      type: "foreign key",
      name: "bookings_ibfk_2",
      references: { table: "products", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  },
};
