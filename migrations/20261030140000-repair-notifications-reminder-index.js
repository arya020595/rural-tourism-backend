"use strict";

/**
 * Repairs `notifications_unique_reminder_per_day` on databases that ran the
 * FIRST version of 20260518000001-add-unique-index-to-notifications.
 *
 * That version did addIndex(["type", "related_id", "created_at"], { where:
 * { type: "booking_reminder" } }); MySQL has no partial indexes, so Sequelize
 * dropped the `where` and created a table-wide unique key. Any two
 * notifications of the same type about the same record in the same second
 * then collide — e.g. a new registration notifying several approvers at once
 * fails. The migration was later rewritten (generated column), but databases
 * that had already run it kept the old index.
 *
 * Here: if the index is the old (type, related_id, created_at) one, drop it
 * and create the intended reminder-only version. Databases that already have
 * the fixed index are left untouched. down() does nothing (the old index was
 * a bug).
 */
module.exports = {
  async up(queryInterface) {
    const indexes = await queryInterface.showIndex("notifications");
    const index = indexes.find((i) => i.name === "notifications_unique_reminder_per_day");
    const columns = (index?.fields || []).map((f) => f.attribute);
    const isOldTableWideIndex =
      index && columns.length === 3 && columns.includes("type") && columns.includes("related_id") && columns.includes("created_at");

    if (!isOldTableWideIndex) return;

    await queryInterface.removeIndex("notifications", "notifications_unique_reminder_per_day");

    const table = await queryInterface.describeTable("notifications");
    if (!table.reminder_dedupe_key) {
      // Same as the fixed 20260518000001: drop duplicate reminders first
      // (same booking, same day, keep the earliest) so the index can be made.
      await queryInterface.sequelize.query(`
        DELETE n1 FROM notifications n1
        INNER JOIN notifications n2
          ON n1.related_id = n2.related_id
         AND DATE(n1.created_at) = DATE(n2.created_at)
         AND n1.id > n2.id
        WHERE n1.type = 'booking_reminder'
          AND n2.type = 'booking_reminder'
      `);
      await queryInterface.sequelize.query(`
        ALTER TABLE notifications
        ADD COLUMN reminder_dedupe_key VARCHAR(80)
        GENERATED ALWAYS AS (
          CASE WHEN type = 'booking_reminder'
            THEN CONCAT(related_id, '_', DATE(created_at))
          END
        ) STORED
      `);
    }

    await queryInterface.addIndex("notifications", ["reminder_dedupe_key"], {
      unique: true,
      name: "notifications_unique_reminder_per_day",
    });
  },

  async down() {
    // Intentionally empty: restoring the table-wide index would bring the bug back.
  },
};
