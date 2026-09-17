"use strict";

/**
 * Adds legacy_receipt_id so migrated Kiulu bookings keep their old PE#######
 * receipt number for lookup, without disturbing the internal autoincrement
 * id (see docs/LEGACY_DB_MIGRATION_ANALYSIS.md §8.9). Non-unique: the old
 * dump has one duplicate receipt id (PE3669068, finding B2) that must not
 * collide.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("bookings", "legacy_receipt_id", {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: "idempotency_key",
    });

    await queryInterface.addIndex("bookings", ["legacy_receipt_id"], {
      name: "bookings_legacy_receipt_id_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "bookings",
      "bookings_legacy_receipt_id_idx",
    );
    await queryInterface.removeColumn("bookings", "legacy_receipt_id");
  },
};
