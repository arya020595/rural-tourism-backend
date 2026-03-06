"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Generate available dates with prices (accommodations have dates + prices, no time slots)
    const generateAvailableDates = (
      startDaysFromNow,
      daysCount,
      pricePerNight,
    ) => {
      const dates = [];
      const today = new Date();

      for (let i = 0; i < daysCount; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + startDaysFromNow + i);
        const dateStr = date.toISOString().split("T")[0];
        dates.push({
          date: dateStr,
          price: pricePerNight,
        });
      }
      return dates;
    };

    // Update all accommodations using name as reference (more robust for auto-generated IDs)
    await Promise.all([
      // Update Kinabalu Mountain Lodge (RM250/night)
      // Available for the next 7 days starting from today
      queryInterface.bulkUpdate(
        "accommodation_list",
        {
          available_dates: JSON.stringify(generateAvailableDates(0, 7, 250)),
          updated_at: new Date(),
        },
        { name: "Kinabalu Mountain Lodge" },
      ),

      // Update Riverside Homestay (RM180/night)
      // Available for 5 days starting from 2 days from now
      queryInterface.bulkUpdate(
        "accommodation_list",
        {
          available_dates: JSON.stringify(generateAvailableDates(2, 5, 180)),
          updated_at: new Date(),
        },
        { name: "Riverside Homestay" },
      ),

      // Update Island Beach Resort (RM320/night)
      // Available for 7 days starting from today
      queryInterface.bulkUpdate(
        "accommodation_list",
        {
          available_dates: JSON.stringify(generateAvailableDates(0, 7, 320)),
          updated_at: new Date(),
        },
        { name: "Island Beach Resort" },
      ),

      // Update Firefly Village Retreat (RM150/night)
      // Available for 5 days starting from 2 days from now
      queryInterface.bulkUpdate(
        "accommodation_list",
        {
          available_dates: JSON.stringify(generateAvailableDates(2, 5, 150)),
          updated_at: new Date(),
        },
        { name: "Firefly Village Retreat" },
      ),
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Reset available_dates to null for all accommodations
    await queryInterface.bulkUpdate(
      "accommodation_list",
      {
        available_dates: null,
        updated_at: new Date(),
      },
      {},
    );
  },
};
