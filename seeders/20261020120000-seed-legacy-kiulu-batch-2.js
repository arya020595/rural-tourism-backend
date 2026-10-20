"use strict";

/**
 * Legacy Kiulu (KTA) migration — batch 2.
 *
 * The old system's final export (dump-rural_tourism-202610200931.sql, taken
 * 2026-10-20) is a superset of the first one, and
 * seeders/data/legacy-kiulu-seed-data.js was regenerated from it. This seeder
 * re-runs the batch-1 legacy seeders, which skip everything already in
 * legacy_id_map, so it only adds what is new:
 *   - 26 receipts created 2026-09-14 14:02:55 → 2026-10-11 05:32:01
 *     (Dapako Hill, Disan Baang Kiulu, Murug Turug Eco Tourism)
 *   - 10 Dapako Hill products (2 of them — sijil, Team building — match
 *     products that already exist and are mapped, not inserted)
 * No companies or users: Enstine / "Sinopian Campsite" is excluded in
 * scripts/parseLegacyDump.js (same business as "Sinopian RC").
 *
 * down() removes only batch-2 rows (the receipt/product ids below).
 */

const { QueryTypes } = require("sequelize");
const companies = require("./20260915000002-seed-legacy-companies");
const users = require("./20260915000003-seed-legacy-users");
const products = require("./20260915000004-seed-legacy-products");
const bookings = require("./20260915000005-seed-legacy-bookings");
const bookingPackages = require("./20260915000006-seed-legacy-booking-packages");

const BATCH_2_RECEIPT_IDS = [
  "PE0018808", "PE0318767", "PE0935444", "PE1059490", "PE1570108",
  "PE1720896", "PE2637555", "PE2762313", "PE2788661", "PE2847985",
  "PE3400460", "PE4669789", "PE5064621", "PE5210842", "PE5283368",
  "PE5404371", "PE6740095", "PE7000400", "PE7134624", "PE7543408",
  "PE7554590", "PE7651353", "PE7822655", "PE8720687", "PE9016775",
  "PE9738074",
];

const BATCH_2_PRODUCT_IDS = [
  "act_00984870", "act_01297223", "act_02480504", "act_03358611",
  "act_04368428", "act_06159024", "act_06756571", "act_06897432",
  "act_08266572", "act_08856550",
];

module.exports = {
  async up(queryInterface, Sequelize) {
    // Same order as batch 1 — each step runs in its own transaction and
    // skips rows already mapped in legacy_id_map.
    await companies.up(queryInterface, Sequelize);
    await users.up(queryInterface, Sequelize);
    await products.up(queryInterface, Sequelize);
    await bookings.up(queryInterface, Sequelize);
    await bookingPackages.up(queryInterface, Sequelize);
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Bookings: legacy_id_map keys are "<receipt>::<legacy user>".
      const bookingMaps = await queryInterface.sequelize.query(
        `SELECT legacy_id, new_id FROM legacy_id_map
         WHERE entity = 'booking' AND SUBSTRING_INDEX(legacy_id, '::', 1) IN (:receipts)`,
        {
          replacements: { receipts: BATCH_2_RECEIPT_IDS },
          type: QueryTypes.SELECT,
          transaction,
        },
      );
      const bookingIds = bookingMaps.map((m) => m.new_id);
      if (bookingIds.length) {
        await queryInterface.sequelize.query(
          "DELETE FROM bookings WHERE id IN (:ids)",
          { replacements: { ids: bookingIds }, transaction },
        );
        await queryInterface.sequelize.query(
          "DELETE FROM legacy_id_map WHERE entity = 'booking' AND legacy_id IN (:keys)",
          { replacements: { keys: bookingMaps.map((m) => m.legacy_id) }, transaction },
        );
      }

      // Products: drop the batch-2 mappings, then delete a product only if
      // nothing else maps to it and no booking uses it — products that were
      // matched to existing ones (sijil, Team building) stay.
      const productMaps = await queryInterface.sequelize.query(
        `SELECT legacy_id, new_id FROM legacy_id_map
         WHERE entity = 'product' AND legacy_id IN (:ids)`,
        {
          replacements: { ids: BATCH_2_PRODUCT_IDS },
          type: QueryTypes.SELECT,
          transaction,
        },
      );
      if (productMaps.length) {
        await queryInterface.sequelize.query(
          "DELETE FROM legacy_id_map WHERE entity = 'product' AND legacy_id IN (:ids)",
          { replacements: { ids: productMaps.map((m) => m.legacy_id) }, transaction },
        );
        await queryInterface.sequelize.query(
          `DELETE FROM products
           WHERE id IN (:ids)
             AND NOT EXISTS (SELECT 1 FROM legacy_id_map m WHERE m.entity = 'product' AND m.new_id = products.id)
             AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.product_id = products.id)`,
          { replacements: { ids: productMaps.map((m) => m.new_id) }, transaction },
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
