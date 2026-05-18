"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex("notifications", ["type", "related_id", "created_at"], {
      unique: true,
      name: "notifications_unique_reminder_per_day",
      where: {
        type: "booking_reminder",
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "notifications",
      "notifications_unique_reminder_per_day",
    );
  },
};
