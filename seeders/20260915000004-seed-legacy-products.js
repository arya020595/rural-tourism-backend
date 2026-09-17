"use strict";

const seedData = require("./data/legacy-kiulu-seed-data");
const {
  findMappedId,
  recordMapping,
} = require("./data/legacyMigrationHelpers");

/**
 * Step 3 of the legacy Kiulu migration (see
 * docs/LEGACY_DB_MIGRATION_ANALYSIS.md §6, §8.5): inserts products,
 * deduplicating on (company_id, LOWER(TRIM(name))) since many legacy users
 * within the same company independently created near-identical product
 * catalogues (78 measured collisions per §8.5). Where a duplicate is
 * found, the legacy product id is mapped to the surviving product row
 * instead of inserting a second copy — bookings referencing any of the
 * duplicate legacy ids all resolve to the same product.
 *
 * Must run after the companies seeder (products have no user_id column —
 * they are owned by company_id only, per §8.5).
 */

function dedupeKey(companyId, name) {
  return `${companyId}::${name.trim().toLowerCase()}`;
}

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const SELECT = queryInterface.sequelize.QueryTypes.SELECT;

      let inserted = 0;
      let dedupedAgainstExisting = 0;
      let dedupedWithinRun = 0;
      let alreadyMapped = 0;

      // company_id::normalised-name -> product_id, seeded from anything
      // already in the DB (a prior partial run, or a pre-existing product
      // that happens to share the name), then extended as this run inserts.
      const seenProducts = new Map();

      for (const product of seedData.products) {
        const existingMapping = await findMappedId(
          queryInterface,
          transaction,
          "product",
          product.legacyProductId,
        );
        if (existingMapping) {
          alreadyMapped += 1;
          continue;
        }

        const companyId = await findMappedId(
          queryInterface,
          transaction,
          "company",
          product.company_legacy_key,
        );
        if (!companyId) {
          throw new Error(
            `No company_id mapping found for legacy company key '${product.company_legacy_key}' (product ${product.legacyProductId}). Run the companies seeder first.`,
          );
        }

        const key = dedupeKey(companyId, product.name);

        let productId = seenProducts.get(key);
        if (productId) {
          dedupedWithinRun += 1;
        } else {
          const existingProduct = await queryInterface.sequelize.query(
            `SELECT id FROM products
             WHERE company_id = :companyId AND LOWER(TRIM(name)) = LOWER(TRIM(:name))
             LIMIT 1`,
            {
              type: SELECT,
              replacements: { companyId, name: product.name },
              transaction,
            },
          );

          if (existingProduct.length) {
            productId = Number(existingProduct[0].id);
            dedupedAgainstExisting += 1;
          } else {
            await queryInterface.sequelize.query(
              `INSERT INTO products (company_id, name, product_type, created_at, updated_at)
               VALUES (:companyId, :name, :productType, NOW(), NOW())`,
              {
                replacements: {
                  companyId,
                  name: product.name,
                  productType: product.legacyProductType,
                },
                transaction,
              },
            );

            const insertedRow = await queryInterface.sequelize.query(
              `SELECT id FROM products
               WHERE company_id = :companyId AND name = :name
               ORDER BY id DESC LIMIT 1`,
              {
                type: SELECT,
                replacements: { companyId, name: product.name },
                transaction,
              },
            );
            productId = Number(insertedRow[0].id);
            inserted += 1;
          }

          seenProducts.set(key, productId);
        }

        await recordMapping(
          queryInterface,
          transaction,
          "product",
          product.legacyProductId,
          productId,
        );
      }

      console.log(
        `[seed-legacy-products] up summary: source=${seedData.products.length}, inserted=${inserted}, deduped_against_existing=${dedupedAgainstExisting}, deduped_within_run=${dedupedWithinRun}, already_mapped=${alreadyMapped}`,
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const SELECT = queryInterface.sequelize.QueryTypes.SELECT;

      const mappedRows = await queryInterface.sequelize.query(
        "SELECT DISTINCT new_id FROM legacy_id_map WHERE entity = 'product'",
        { type: SELECT, transaction },
      );
      const productIds = mappedRows.map((r) => Number(r.new_id));

      if (productIds.length) {
        // Deduping means multiple legacy ids may map to one product row —
        // only delete products no live booking still references.
        await queryInterface.sequelize.query(
          `DELETE p FROM products p
           LEFT JOIN bookings b ON b.product_id = p.id
           WHERE p.id IN (:productIds) AND b.id IS NULL`,
          { replacements: { productIds }, transaction },
        );
      }

      await queryInterface.sequelize.query(
        "DELETE FROM legacy_id_map WHERE entity = 'product'",
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
