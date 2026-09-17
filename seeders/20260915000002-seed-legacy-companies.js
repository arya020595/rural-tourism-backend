"use strict";

const seedData = require("./data/legacy-kiulu-seed-data");
const {
  findMappedId,
  recordMapping,
} = require("./data/legacyMigrationHelpers");

/**
 * Step 1 of the legacy Kiulu migration (see
 * docs/LEGACY_DB_MIGRATION_ANALYSIS.md §6): inserts the 37 companies
 * derived from the legacy rt_user.full_name values, recording each one in
 * legacy_id_map keyed by its normalised company name so later steps
 * (users, products, bookings) can resolve company_id.
 *
 * Idempotent: re-running skips any company already present in
 * legacy_id_map, and separately guards against colliding with an existing
 * production company_name (verified zero collisions in the analysis, but
 * checked here anyway rather than assumed).
 */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const SELECT = queryInterface.sequelize.QueryTypes.SELECT;
      let inserted = 0;
      let alreadyMapped = 0;
      let matchedExisting = 0;

      for (const company of seedData.companies) {
        const existingMapping = await findMappedId(
          queryInterface,
          transaction,
          "company",
          company.legacyKey,
        );
        if (existingMapping) {
          alreadyMapped += 1;
          continue;
        }

        const existingCompany = await queryInterface.sequelize.query(
          "SELECT id FROM companies WHERE company_name = :name LIMIT 1",
          {
            type: SELECT,
            replacements: { name: company.company_name },
            transaction,
          },
        );

        let companyId;
        if (existingCompany.length) {
          companyId = Number(existingCompany[0].id);
          matchedExisting += 1;
        } else {
          await queryInterface.sequelize.query(
            `INSERT INTO companies (company_name, location, created_at, updated_at)
             VALUES (:name, :location, NOW(), NOW())`,
            {
              replacements: {
                name: company.company_name,
                location: company.location,
              },
              transaction,
            },
          );

          const insertedRow = await queryInterface.sequelize.query(
            "SELECT id FROM companies WHERE company_name = :name ORDER BY id DESC LIMIT 1",
            {
              type: SELECT,
              replacements: { name: company.company_name },
              transaction,
            },
          );
          companyId = Number(insertedRow[0].id);
          inserted += 1;
        }

        await recordMapping(
          queryInterface,
          transaction,
          "company",
          company.legacyKey,
          companyId,
        );
      }

      console.log(
        `[seed-legacy-companies] up summary: source=${seedData.companies.length}, inserted=${inserted}, matched_existing=${matchedExisting}, already_mapped=${alreadyMapped}`,
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
        "SELECT new_id FROM legacy_id_map WHERE entity = 'company'",
        { type: SELECT, transaction },
      );
      const companyIds = mappedRows.map((r) => Number(r.new_id));

      if (companyIds.length) {
        // Only remove companies that no longer have any dependent rows
        // (users/products may already be gone if their down() ran first).
        await queryInterface.sequelize.query(
          `DELETE c FROM companies c
           LEFT JOIN users u ON u.company_id = c.id
           LEFT JOIN products p ON p.company_id = c.id
           WHERE c.id IN (:companyIds) AND u.id IS NULL AND p.id IS NULL`,
          { replacements: { companyIds }, transaction },
        );
      }

      await queryInterface.sequelize.query(
        "DELETE FROM legacy_id_map WHERE entity = 'company'",
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
