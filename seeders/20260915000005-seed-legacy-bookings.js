"use strict";

const seedData = require("./data/legacy-kiulu-seed-data");
const {
  findMappedId,
  recordMapping,
} = require("./data/legacyMigrationHelpers");

/**
 * Step 4 of the legacy Kiulu migration (see
 * docs/LEGACY_DB_MIGRATION_ANALYSIS.md §5, §6): inserts activity/
 * accommodation bookings (booking_type='activity'|'accommodation').
 * Package bookings are handled separately by
 * 20260915000006-seed-legacy-booking-packages.js, since they need
 * booking_package_companies rows too.
 *
 * Field mapping (§5):
 *   citizenship 'Warganegara'       -> 'domestic'      + no_of_pax_domestik    = pax
 *   citizenship 'Bukan Warganegara' -> 'international' + no_of_pax_antarbangsa = pax
 *   status 'Active' -> 'paid', 'void' -> 'cancelled'
 *   total_rm -> total_price, issuer -> operator_name, receipt_id -> legacy_receipt_id
 *   date/createdAt: 2 known-corrupt dates (W1) fall back to createdAt
 *
 * idempotency_key is deliberately left NULL (would collide with the
 * partial unique index on that column — do not fabricate values).
 *
 * Must run after companies, users, and products.
 */

const CORRUPT_DATES = new Set(["0025-02-02", "1999-02-01"]);

function toPax(citizenship, pax) {
  const clamped = Math.max(0, Number(pax) || 0);
  if (citizenship === "Bukan Warganegara") {
    return { antarbangsa: clamped, domestik: 0 };
  }
  // 'Warganegara' and any unexpected value default to domestic, matching
  // the frontend's own citizenship fallback behaviour (see analysis §3).
  return { antarbangsa: 0, domestik: clamped };
}

function toStatus(legacyStatus) {
  return legacyStatus === "void" ? "cancelled" : "paid";
}

function toActivityDate(booking) {
  if (booking.date && !CORRUPT_DATES.has(booking.date)) {
    return booking.date;
  }
  return booking.createdAt;
}

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const SELECT = queryInterface.sequelize.QueryTypes.SELECT;

      let inserted = 0;
      let alreadyMapped = 0;
      let orphanProductRefs = 0;
      let backfilledProductId = 0;

      const relevantBookings = seedData.bookings.filter(
        (b) => b.bookingType === "activity" || b.bookingType === "accommodation",
      );

      for (const booking of relevantBookings) {
        // form_responses' PK was (receipt_id, user_id), so a receipt_id can
        // legitimately repeat across different users (finding B2,
        // PE3669068 x2). legacy_id_map's key is (entity, legacy_id) alone,
        // so disambiguate with the user id to avoid losing the second row.
        const mapKey = `${booking.legacyReceiptId}::${booking.legacyUserId}`;

        const existingMapping = await findMappedId(
          queryInterface,
          transaction,
          "booking",
          mapKey,
        );
        if (existingMapping) {
          alreadyMapped += 1;
          // Backfill: a row inserted by an earlier run of this seeder may
          // have product_id = NULL because ORPHAN_PRODUCT_ID_ALIASES
          // (scripts/parseLegacyDump.js) didn't yet resolve it — e.g. the
          // 3 W8 receipts were fixed after their bookings already existed.
          // Re-running the seeder should still converge on the current
          // seed data rather than leave stale NULLs behind.
          if (booking.legacyProductId) {
            const productId = await findMappedId(
              queryInterface,
              transaction,
              "product",
              booking.legacyProductId,
            );
            if (productId) {
              // A raw UPDATE via sequelize.query() returns
              // [metadata, metadata] (both elements the same MySQL
              // result-set object) — NOT [rows, affectedCount]. The actual
              // affected-row count is metadata.affectedRows.
              const [result] = await queryInterface.sequelize.query(
                `UPDATE bookings SET product_id = :productId
                 WHERE id = :bookingId AND product_id IS NULL`,
                {
                  replacements: { productId, bookingId: existingMapping },
                  transaction,
                },
              );
              if (Number(result?.affectedRows) > 0) backfilledProductId += 1;
            }
          }
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

        const companyRow = await queryInterface.sequelize.query(
          "SELECT company_id, name AS user_fullname FROM users WHERE id = :userId LIMIT 1",
          { type: SELECT, replacements: { userId }, transaction },
        );
        const companyId = Number(companyRow[0]?.company_id || 0) || null;
        const userFullname = companyRow[0]?.user_fullname || booking.legacyUserId;

        // 3 receipts reference a homest_id no longer present in the source
        // accomodation table (finding W8) — product_id stays NULL for
        // these, matching how package bookings already have no single
        // product_id. The receipt's product_name snapshot is preserved
        // regardless, so the booking's revenue/pax history is not lost.
        let productId = null;
        if (booking.legacyProductId) {
          productId = await findMappedId(
            queryInterface,
            transaction,
            "product",
            booking.legacyProductId,
          );
          if (!productId) {
            orphanProductRefs += 1;
          }
        }

        const { antarbangsa, domestik } = toPax(booking.citizenship, booking.pax);
        const status = toStatus(booking.status);
        const activityDate = toActivityDate(booking);
        const totalPrice =
          booking.totalRm && booking.totalRm !== ""
            ? Number(booking.totalRm)
            : null;
        const totalOfNight =
          booking.bookingType === "accommodation" &&
          booking.totalNight &&
          booking.totalNight !== ""
            ? Number(booking.totalNight)
            : null;

        await queryInterface.sequelize.query(
          `INSERT INTO bookings (
            booking_type, customer_type, citizenship,
            no_of_pax_antarbangsa, no_of_pax_domestik,
            product_id, product_name, activity_date,
            check_in_date, check_out_date, total_of_night,
            total_price, user_id, user_fullname, status,
            receipt_created_at, operator_name, company_id, company_name,
            legacy_receipt_id, created_at, updated_at
          ) VALUES (
            :bookingType, 'tourist', :citizenship,
            :antarbangsa, :domestik,
            :productId, :productName, :activityDate,
            :checkInDate, :checkOutDate, :totalOfNight,
            :totalPrice, :userId, :userFullname, :status,
            :createdAt, :operatorName, :companyId, NULL,
            :legacyReceiptId, :createdAt, :createdAt
          )`,
          {
            replacements: {
              bookingType: booking.bookingType,
              citizenship:
                booking.citizenship === "Bukan Warganegara"
                  ? "international"
                  : "domestic",
              antarbangsa,
              domestik,
              productId,
              productName: booking.productName,
              activityDate:
                booking.bookingType === "activity" ? activityDate : null,
              checkInDate:
                booking.bookingType === "accommodation" ? activityDate : null,
              checkOutDate: null,
              totalOfNight,
              totalPrice,
              userId,
              userFullname,
              status,
              createdAt: booking.createdAt,
              operatorName: booking.issuer || null,
              companyId,
              legacyReceiptId: booking.legacyReceiptId,
            },
            transaction,
          },
        );

        const insertedRow = await queryInterface.sequelize.query(
          `SELECT id FROM bookings
           WHERE legacy_receipt_id = :legacyReceiptId AND user_id = :userId
           ORDER BY id DESC LIMIT 1`,
          {
            type: SELECT,
            replacements: { legacyReceiptId: booking.legacyReceiptId, userId },
            transaction,
          },
        );
        const bookingId = Number(insertedRow[0].id);
        inserted += 1;

        await recordMapping(
          queryInterface,
          transaction,
          "booking",
          mapKey,
          bookingId,
        );
      }

      console.log(
        `[seed-legacy-bookings] up summary: source=${relevantBookings.length}, inserted=${inserted}, already_mapped=${alreadyMapped}, orphan_product_refs=${orphanProductRefs} (W8 — product_id left NULL), backfilled_product_id=${backfilledProductId}`,
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
        "SELECT new_id FROM legacy_id_map WHERE entity = 'booking'",
        { type: SELECT, transaction },
      );
      const bookingIds = mappedRows.map((r) => Number(r.new_id));

      if (bookingIds.length) {
        await queryInterface.sequelize.query(
          "DELETE FROM bookings WHERE id IN (:bookingIds)",
          { replacements: { bookingIds }, transaction },
        );
      }

      await queryInterface.sequelize.query(
        "DELETE FROM legacy_id_map WHERE entity = 'booking'",
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
