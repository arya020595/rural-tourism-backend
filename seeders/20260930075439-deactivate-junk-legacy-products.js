"use strict";

const { findMappedId } = require("./data/legacyMigrationHelpers");

/**
 * One-time data fix, not a schema change: deactivates two junk product rows
 * discovered after the Kiulu migration landed.
 *
 * - act_08719342 ("32", Kiulu Eco-Tourism): a bare numeric placeholder name
 *   carried over verbatim from the old system. No bookings reference it.
 * - acc_04713450 ("kanahon rm150/Sinurambi moden rm300/Lamin pisompuruan150/
 *   Olundus hut rm150/Sondoton view rm150/Agaragas hut rm150", Pusat
 *   Reakriasi Bambangan): six separate room listings merged into a single
 *   product name — every room it lists already exists as its own proper
 *   product row for this company. One paid booking (legacy receipt
 *   PE6593345) references it, so it's deactivated (hidden from new
 *   bookings) rather than deleted, to keep that booking's product_id intact.
 *
 * Idempotent: looks up each row via legacy_id_map (populated by the original
 * seed-legacy-products seeder) rather than a hardcoded product id, since ids
 * are not guaranteed to match across local/staging/production.
 */

const TARGETS = [
  { legacyProductId: "act_08719342", label: '"32" (Kiulu Eco-Tourism)' },
  {
    legacyProductId: "acc_04713450",
    label: "merged Kanahon/Sinurambi/Lamin/Olundus/Sondoton/Agaragas listing (Pusat Reakriasi Bambangan)",
  },
];

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      let deactivated = 0;
      let alreadyInactive = 0;
      let notFound = 0;

      for (const target of TARGETS) {
        const productId = await findMappedId(
          queryInterface,
          transaction,
          "product",
          target.legacyProductId,
        );

        if (productId === null) {
          console.warn(
            `  [skip] ${target.label}: no legacy_id_map entry for ${target.legacyProductId} (migration not run yet on this database?)`,
          );
          notFound += 1;
          continue;
        }

        const [result] = await queryInterface.sequelize.query(
          "UPDATE products SET is_active = false WHERE id = :productId AND is_active = true",
          { replacements: { productId }, transaction },
        );

        if (Number(result?.affectedRows) > 0) {
          deactivated += 1;
        } else {
          alreadyInactive += 1;
        }
      }

      await transaction.commit();
      console.log(
        `[deactivate-junk-legacy-products] deactivated: ${deactivated}, already inactive: ${alreadyInactive}, not found: ${notFound}`,
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      for (const target of TARGETS) {
        const productId = await findMappedId(
          queryInterface,
          transaction,
          "product",
          target.legacyProductId,
        );
        if (productId === null) continue;

        await queryInterface.sequelize.query(
          "UPDATE products SET is_active = true WHERE id = :productId",
          { replacements: { productId }, transaction },
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
