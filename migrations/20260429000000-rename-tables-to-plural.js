"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.renameTable("company", "companies");
    await queryInterface.renameTable("activity_booking", "activity_bookings");
    await queryInterface.renameTable(
      "accommodation_booking",
      "accommodation_bookings",
    );
    await queryInterface.renameTable(
      "activity_master_table",
      "activity_master_data",
    );
    await queryInterface.renameTable("accommodation_list", "accommodations");
    await queryInterface.renameTable("conversation", "conversations");
  },

  async down(queryInterface) {
    await queryInterface.renameTable("companies", "company");
    await queryInterface.renameTable("activity_bookings", "activity_booking");
    await queryInterface.renameTable(
      "accommodation_bookings",
      "accommodation_booking",
    );
    await queryInterface.renameTable(
      "activity_master_data",
      "activity_master_table",
    );
    await queryInterface.renameTable("accommodations", "accommodation_list");
    await queryInterface.renameTable("conversations", "conversation");
  },
};
