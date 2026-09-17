"use strict";

const seedData = require("./data/legacy-kiulu-seed-data");
const {
  findMappedId,
  recordMapping,
  requireAssociationId,
  KTA_ASSOCIATION_NAME,
} = require("./data/legacyMigrationHelpers");

/**
 * Step 5 of the legacy Kiulu migration (see
 * docs/LEGACY_DB_MIGRATION_ANALYSIS.md §5, §8.8): inserts package
 * bookings (booking_type='package') plus one booking_package_companies row
 * per leg. Per §8.8, the current table is a per-line cost breakdown, not a
 * referral chain: referrer_id is always the receipt's own company;
 * referee_id is the leg's nameOfBusiness resolved to a company (81.6% of
 * legs self-reference, i.e. referee_id = referrer_id — this is normal and
 * already used in production).
 *
 * booking_package_companies.referrer_id/referee_id are ON DELETE RESTRICT
 * (verified against migrations/20260427103000-create-booking-package-
 * companies-table.js), so both companies must already exist — this seeder
 * must run after the companies seeder.
 *
 * Enforces the same-association invariant that
 * services/bookingsService.js normally checks at request time
 * (bookingsService.js:617-624) but which raw SQL bypasses — per §8.8's
 * explicit warning, asserted here rather than assumed.
 */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const SELECT = queryInterface.sequelize.QueryTypes.SELECT;

      const ktaAssociationId = await requireAssociationId(
        queryInterface,
        transaction,
        KTA_ASSOCIATION_NAME,
      );

      let bookingsInserted = 0;
      let legsInserted = 0;
      let alreadyMapped = 0;

      const packageBookings = seedData.bookings.filter(
        (b) => b.bookingType === "package",
      );

      // Cache company -> association_id lookups within this run.
      const companyAssociationCache = new Map();
      async function resolveCompanyAssociationId(companyId) {
        if (companyAssociationCache.has(companyId)) {
          return companyAssociationCache.get(companyId);
        }
        const rows = await queryInterface.sequelize.query(
          `SELECT MIN(association_id) AS association_id
           FROM users WHERE company_id = :companyId AND association_id IS NOT NULL`,
          { type: SELECT, replacements: { companyId }, transaction },
        );
        const associationId = Number(rows[0]?.association_id || 0) || null;
        companyAssociationCache.set(companyId, associationId);
        return associationId;
      }

      for (const booking of packageBookings) {
        const mapKey = `${booking.legacyReceiptId}::${booking.legacyUserId}`;

        const existingMapping = await findMappedId(
          queryInterface,
          transaction,
          "booking",
          mapKey,
        );
        if (existingMapping) {
          alreadyMapped += 1;
          continue;
        }

        const userId = await findMappedId(
          queryInterface,
          transaction,
          "user",
          booking.legacyUserId,
        );
        if (!userId) {
          throw new Error(
            `No user_id mapping found for legacy user '${booking.legacyUserId}' (receipt ${booking.legacyReceiptId}). Run the users seeder first.`,
          );
        }

        const userRow = await queryInterface.sequelize.query(
          "SELECT company_id, name AS user_fullname FROM users WHERE id = :userId LIMIT 1",
          { type: SELECT, replacements: { userId }, transaction },
        );
        const referrerCompanyId = Number(userRow[0]?.company_id || 0) || null;
        const userFullname = userRow[0]?.user_fullname || booking.legacyUserId;
        if (!referrerCompanyId) {
          throw new Error(
            `Migrated user ${userId} (legacy ${booking.legacyUserId}) has no company_id — cannot resolve package referrer.`,
          );
        }

        const referrerAssociationId = await resolveCompanyAssociationId(
          referrerCompanyId,
        );

        const legs = booking.packageLegs || [];
        const totalPrice = legs.reduce((sum, leg) => sum + leg.totalRm, 0);

        // Package receipts carry the same citizenship field as other
        // receipts; reuse the same domestic/international convention (§3).
        const pax = Math.max(0, Number(booking.pax) || 0);
        const isInternational = booking.citizenship === "Bukan Warganegara";
        const antarbangsa = isInternational ? pax : 0;
        const domestik = isInternational ? 0 : pax;

        await queryInterface.sequelize.query(
          `INSERT INTO bookings (
            booking_type, customer_type, citizenship,
            no_of_pax_antarbangsa, no_of_pax_domestik,
            total_price, user_id, user_fullname, status,
            receipt_created_at, operator_name, company_id, company_name,
            legacy_receipt_id, created_at, updated_at
          ) VALUES (
            'package', 'tourist', :citizenship,
            :antarbangsa, :domestik,
            :totalPrice, :userId, :userFullname, :status,
            :createdAt, :operatorName, :companyId, NULL,
            :legacyReceiptId, :createdAt, :createdAt
          )`,
          {
            replacements: {
              citizenship: isInternational ? "international" : "domestic",
              antarbangsa,
              domestik,
              totalPrice,
              userId,
              userFullname,
              status: booking.status === "void" ? "cancelled" : "paid",
              createdAt: booking.createdAt,
              operatorName: booking.issuer || null,
              companyId: referrerCompanyId,
              legacyReceiptId: booking.legacyReceiptId,
            },
            transaction,
          },
        );

        const insertedBookingRow = await queryInterface.sequelize.query(
          `SELECT id FROM bookings
           WHERE legacy_receipt_id = :legacyReceiptId AND user_id = :userId
           ORDER BY id DESC LIMIT 1`,
          {
            type: SELECT,
            replacements: { legacyReceiptId: booking.legacyReceiptId, userId },
            transaction,
          },
        );
        const bookingId = Number(insertedBookingRow[0].id);
        bookingsInserted += 1;

        await recordMapping(
          queryInterface,
          transaction,
          "booking",
          mapKey,
          bookingId,
        );

        for (const leg of legs) {
          const refereeCompanyId = await findMappedId(
            queryInterface,
            transaction,
            "company",
            leg.company_legacy_key,
          );
          if (!refereeCompanyId) {
            throw new Error(
              `No company_id mapping found for package leg business '${leg.company_legacy_key}' (receipt ${booking.legacyReceiptId}). Check the alias table in scripts/parseLegacyDump.js.`,
            );
          }

          const refereeAssociationId = await resolveCompanyAssociationId(
            refereeCompanyId,
          );

          if (
            referrerAssociationId !== null &&
            refereeAssociationId !== null &&
            referrerAssociationId !== refereeAssociationId
          ) {
            throw new Error(
              `Package leg association mismatch on receipt ${booking.legacyReceiptId}: referrer company ${referrerCompanyId} is in association ${referrerAssociationId}, referee company ${refereeCompanyId} ('${leg.company_legacy_key}') is in association ${refereeAssociationId}. This should not happen — all legacy data is single-association KTA. Investigate before proceeding.`,
            );
          }

          const referrerNameRow = await queryInterface.sequelize.query(
            "SELECT company_name FROM companies WHERE id = :id LIMIT 1",
            { type: SELECT, replacements: { id: referrerCompanyId }, transaction },
          );
          const refereeNameRow = await queryInterface.sequelize.query(
            "SELECT company_name FROM companies WHERE id = :id LIMIT 1",
            { type: SELECT, replacements: { id: refereeCompanyId }, transaction },
          );

          await queryInterface.sequelize.query(
            `INSERT INTO booking_package_companies (
              booking_package_id, referrer_id, referral_company,
              referee_id, referee_company, description, per_price,
              association_id, created_at, updated_at
            ) VALUES (
              :bookingId, :referrerId, :referralCompany,
              :refereeId, :refereeCompany, :description, :perPrice,
              :associationId, NOW(), NOW()
            )`,
            {
              replacements: {
                bookingId,
                referrerId: referrerCompanyId,
                referralCompany: referrerNameRow[0]?.company_name || null,
                refereeId: refereeCompanyId,
                refereeCompany: refereeNameRow[0]?.company_name || null,
                description: leg.description || "",
                perPrice: leg.totalRm,
                associationId: ktaAssociationId,
              },
              transaction,
            },
          );
          legsInserted += 1;
        }
      }

      console.log(
        `[seed-legacy-booking-packages] up summary: source=${packageBookings.length}, bookings_inserted=${bookingsInserted}, legs_inserted=${legsInserted}, already_mapped=${alreadyMapped}`,
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

      // This seeder's mapped bookings are a subset of entity='booking' in
      // legacy_id_map that also have booking_package_companies rows;
      // 20260915000005's down() already deletes all entity='booking' rows,
      // so booking_package_companies cascades via its ON DELETE CASCADE FK
      // to bookings (migrations/20260427103000). Nothing extra to do here
      // beyond ensuring this runs its down() before 20260915000005's.
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
