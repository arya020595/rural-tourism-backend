"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Generate available dates with time slots and prices
    const generateAvailableDates = (
      startDaysFromNow,
      daysCount,
      timeSlots,
      basePrice,
    ) => {
      const dates = [];
      const today = new Date();

      for (let i = 0; i < daysCount; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + startDaysFromNow + i);
        const dateStr = date.toISOString().split("T")[0];

        // Add each time slot for this date
        timeSlots.forEach((slot) => {
          dates.push({
            date: dateStr,
            time: slot.time,
            price: slot.price || basePrice,
          });
        });
      }
      return dates;
    };

    // Define time slots based on current time patterns
    const morningSlots = [
      { time: "08:00 - 09:00", price: 30 },
      { time: "09:00 - 10:00", price: 30 },
      { time: "10:00 - 11:00", price: 30 },
    ];

    const afternoonSlots = [
      { time: "09:00 - 10:00", price: 45 },
      { time: "10:00 - 11:30", price: 45 },
    ];

    // Update all accommodations concurrently for better performance
    await Promise.all([
      // Update accommodation 1 - Kinabalu Mountain Lodge
      // Available for the next 7 days starting from today with morning slots
      queryInterface.bulkUpdate(
        "accommodation_list",
        {
          available_dates: JSON.stringify(
            generateAvailableDates(0, 7, morningSlots, 30),
          ),
          updated_at: new Date(),
        },
        { accommodation_id: 1 },
      ),

      // Update accommodation 2 - Riverside Homestay
      // Available for 5 days starting from 2 days from now with afternoon slots
      queryInterface.bulkUpdate(
        "accommodation_list",
        {
          available_dates: JSON.stringify(
            generateAvailableDates(2, 5, afternoonSlots, 45),
          ),
          updated_at: new Date(),
        },
        { accommodation_id: 2 },
      ),

      // Update accommodation 3 - Island Beach Resort
      // Available for 7 days starting from today with morning slots
      queryInterface.bulkUpdate(
        "accommodation_list",
        {
          available_dates: JSON.stringify(
            generateAvailableDates(0, 7, morningSlots, 30),
          ),
          updated_at: new Date(),
        },
        { accommodation_id: 3 },
      ),

      // Update accommodation 4 - Firefly Village Retreat
      // Available for 5 days starting from 2 days from now with afternoon slots
      queryInterface.bulkUpdate(
        "accommodation_list",
        {
          available_dates: JSON.stringify(
            generateAvailableDates(2, 5, afternoonSlots, 45),
          ),
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
