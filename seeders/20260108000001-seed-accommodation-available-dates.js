"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Generate available dates for the next 3 months
    const generateAvailableDates = (startDaysFromNow, daysCount) => {
      const dates = [];
      const today = new Date();

      for (let i = 0; i < daysCount; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + startDaysFromNow + i);
        // Format as YYYY-MM-DD
        dates.push(date.toISOString().split("T")[0]);
      }
      return dates;
    };

    // Update accommodation 1 - Kinabalu Mountain Lodge
    // Available for the next 30 days starting from today
    await queryInterface.bulkUpdate(
      "accommodation_list",
      {
        available_dates: JSON.stringify(generateAvailableDates(0, 30)),
        updated_at: new Date(),
      },
      { accommodation_id: 1 }
    );

    // Update accommodation 2 - Riverside Homestay
    // Available for 45 days starting from 5 days from now
    await queryInterface.bulkUpdate(
      "accommodation_list",
      {
        available_dates: JSON.stringify(generateAvailableDates(5, 45)),
        updated_at: new Date(),
      },
      { accommodation_id: 2 }
    );

    // Update accommodation 3 - Island Beach Resort
    // Available for the next 60 days (high demand resort)
    await queryInterface.bulkUpdate(
      "accommodation_list",
      {
        available_dates: JSON.stringify(generateAvailableDates(0, 60)),
        updated_at: new Date(),
      },
      { accommodation_id: 3 }
    );

    // Update accommodation 4 - Firefly Village Retreat
    // Available for 20 days starting from 10 days from now
    await queryInterface.bulkUpdate(
      "accommodation_list",
      {
        available_dates: JSON.stringify(generateAvailableDates(10, 20)),
        updated_at: new Date(),
      },
      { accommodation_id: 4 }
    );
  },

  async down(queryInterface, Sequelize) {
    // Reset available_dates to null for all accommodations
    await queryInterface.bulkUpdate(
      "accommodation_list",
      {
        available_dates: null,
        updated_at: new Date(),
      },
      {}
    );
  },
};
