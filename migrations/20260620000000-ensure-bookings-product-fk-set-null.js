"use strict";

/**
 * Ensures the bookings.product_id foreign key uses ON DELETE SET NULL so a
 * product (master data) can be deleted even when bookings reference it.
 *
 * The earlier migration (20260520000001) hardcoded the constraint name
 * `bookings_ibfk_2`, but auto-generated FK names differ between environments
 * (staging still had `bookings_ibfk_1` with ON DELETE RESTRICT). This migration
 * is name-agnostic: it looks up whatever FK currently exists on
 * bookings.product_id, drops it, and recreates it with SET NULL. It is safe to
 * run even if the FK is already correct.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const TARGET_NAME = "bookings_product_id_fk";
    const dbName = queryInterface.sequelize.config.database;

    // Find every FK on bookings.product_id, regardless of its name.
    const [rows] = await queryInterface.sequelize.query(
      `SELECT CONSTRAINT_NAME
         FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = :dbName
          AND TABLE_NAME = 'bookings'
          AND COLUMN_NAME = 'product_id'
          AND REFERENCED_TABLE_NAME = 'products'`,
      { replacements: { dbName } },
    );

    for (const { CONSTRAINT_NAME } of rows) {
      await queryInterface.removeConstraint("bookings", CONSTRAINT_NAME);
    }

    await queryInterface.addConstraint("bookings", {
      fields: ["product_id"],
      type: "foreign key",
      name: TARGET_NAME,
      references: { table: "products", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert to the RESTRICT behaviour under the original generated name.
    await queryInterface
      .removeConstraint("bookings", "bookings_product_id_fk")
      .catch(() => {});

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
