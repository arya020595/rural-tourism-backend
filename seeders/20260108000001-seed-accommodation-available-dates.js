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

    // Update all accommodations concurrently for better performance
    await Promise.all([
      // Update accommodation 1 - Kinabalu Mountain Lodge (RM250/night)
      // Available for the next 7 days starting from today
      queryInterface.bulkUpdate(
        "accommodation_list",
        {
          available_dates: JSON.stringify(generateAvailableDates(0, 7, 250)),
          updated_at: new Date(),
        },
        { accommodation_id: 1 },
      ),

      // Update accommodation 2 - Riverside Homestay (RM180/night)
      // Available for 5 days starting from 2 days from now
      queryInterface.bulkUpdate(
        "accommodation_list",
        {
          available_dates: JSON.stringify(generateAvailableDates(2, 5, 180)),
          updated_at: new Date(),
        },
        { accommodation_id: 2 },
      ),

      // Update accommodation 3 - Island Beach Resort (RM320/night)
      // Available for 7 days starting from today
      queryInterface.bulkUpdate(
        "accommodation_list",
        {
          available_dates: JSON.stringify(generateAvailableDates(0, 7, 320)),
          updated_at: new Date(),
        },
        { accommodation_id: 3 },
      ),

      // Update accommodation 4 - Firefly Village Retreat (RM150/night)
      // Available for 5 days starting from 2 days from now
      queryInterface.bulkUpdate(
        "accommodation_list",
        {
          available_dates: JSON.stringify(generateAvailableDates(2, 5, 150)),
          updated_at: new Date(),
        },
        { accommodation_id: 4 },
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
