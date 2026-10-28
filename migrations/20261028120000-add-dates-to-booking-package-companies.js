"use strict";

/**
 * Package items get their own type and dates, so the calendars can show when
 * the customer actually comes to each company — not the date the package was
 * booked:
 *   - product_type   'activity' | 'accommodation'
 *   - activity_date  activity items: date + optional time, stored "as typed"
 *                    (Malaysia wall-clock in the UTC fields), same as
 *                    bookings.activity_date
 *   - check_in_date / check_out_date  accommodation items
 *
 * All nullable: package items created before this migration (or by app
 * versions that don't send dates) have none, and the calendar falls back to
 * the package's own date for them.
 *
 * The indexes serve the calendar / booked-dates lookups, which filter by the
 * company providing the item (referee_id) and a date.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("booking_package_companies", "product_type", {
      type: Sequelize.ENUM("activity", "accommodation"),
      allowNull: true,
    });
    await queryInterface.addColumn("booking_package_companies", "activity_date", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("booking_package_companies", "check_in_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn("booking_package_companies", "check_out_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.addIndex(
      "booking_package_companies",
      ["referee_id", "activity_date"],
      { name: "idx_bpc_referee_activity_date" },
    );
    await queryInterface.addIndex(
      "booking_package_companies",
      ["referee_id", "check_in_date"],
      { name: "idx_bpc_referee_check_in_date" },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "booking_package_companies",
      "idx_bpc_referee_check_in_date",
    );
    await queryInterface.removeIndex(
      "booking_package_companies",
      "idx_bpc_referee_activity_date",
    );
    await queryInterface.removeColumn("booking_package_companies", "check_out_date");
    await queryInterface.removeColumn("booking_package_companies", "check_in_date");
    await queryInterface.removeColumn("booking_package_companies", "activity_date");
    await queryInterface.removeColumn("booking_package_companies", "product_type");
  },
};
