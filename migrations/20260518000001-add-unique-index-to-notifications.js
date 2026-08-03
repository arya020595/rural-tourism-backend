"use strict";

module.exports = {
  async up(queryInterface) {
    // MySQL has no partial/filtered index support, so addIndex({ where })
    // is silently dropped by Sequelize's MySQL dialect and this would
    // otherwise create a table-wide unique constraint across every
    // notification type instead of just booking_reminder.
    //
    // Remove pre-existing duplicate booking_reminder rows (same booking,
    // same calendar day) first, keeping the earliest, so the index below
    // can be created.
    await queryInterface.sequelize.query(`
      DELETE n1 FROM notifications n1
      INNER JOIN notifications n2
        ON n1.related_id = n2.related_id
       AND DATE(n1.created_at) = DATE(n2.created_at)
       AND n1.id > n2.id
      WHERE n1.type = 'booking_reminder'
        AND n2.type = 'booking_reminder'
    `);

    // Emulate a partial unique index with a generated column that is NULL
    // for every non-reminder row (NULLs don't collide in a MySQL/InnoDB
    // unique index) and holds a per-booking, per-day key otherwise.
    await queryInterface.sequelize.query(`
      ALTER TABLE notifications
      ADD COLUMN reminder_dedupe_key VARCHAR(80)
      GENERATED ALWAYS AS (
        CASE WHEN type = 'booking_reminder'
          THEN CONCAT(related_id, '_', DATE(created_at))
        END
      ) STORED
    `);

    await queryInterface.addIndex("notifications", ["reminder_dedupe_key"], {
      unique: true,
      name: "notifications_unique_reminder_per_day",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "notifications",
      "notifications_unique_reminder_per_day",
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE notifications DROP COLUMN reminder_dedupe_key",
    );
  },
};
