"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Seed form_responses (receipts)
    // All IDs use auto-increment (PostgreSQL SERIAL style)
    await queryInterface.bulkInsert("form_responses", [
      {
        receipt_id: "RCP-2026-0001",
        operator_user_id: 1, // operator1
        citizenship: "Malaysian",
        pax: 2,
        activity_name: "Mount Kinabalu Climbing",
        tourist_user_id: 1, // Alice Tourist
        homest_name: null,
        location: "Kinabalu National Park",
        activity_id: 1,
        homest_id: null,
        total_rm: "1700.00",
        total_night: null,
        package: JSON.stringify({
          name: "2D1N Kinabalu Climb",
          includes: ["Guide", "Meals", "Accommodation", "Permits"],
        }),
        issuer: "John Operator",
        date: new Date("2026-01-15"),
        activity_booking_id: 1, // Links to activity_booking.id = 1
        accommodation_booking_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        receipt_id: "RCP-2026-0002",
        operator_user_id: 2, // operator2
        citizenship: "Malaysian",
        pax: 2,
        activity_name: null,
        tourist_user_id: 1, // Alice Tourist
        homest_name: "Kinabalu Mountain Lodge",
        location: "Ranau",
        activity_id: null,
        homest_id: 1,
        total_rm: "500.00",
        total_night: "2",
        package: JSON.stringify({
          name: "Lodge Stay Package",
          includes: ["Breakfast", "WiFi", "Mountain View"],
        }),
        issuer: "Jane Operator",
        date: new Date("2026-01-14"),
        activity_booking_id: null,
        accommodation_booking_id: 1, // Links to accommodation_booking.id = 1
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        receipt_id: "RCP-2026-0003",
        operator_user_id: 1, // operator1
        citizenship: "Singaporean",
        pax: 3,
        activity_name: "River Rafting",
        tourist_user_id: 2, // Bob Traveler
        homest_name: null,
        location: "Beaufort",
        activity_id: 2,
        homest_id: null,
        total_rm: "840.00",
        total_night: null,
        package: JSON.stringify({
          name: "Full Day Rafting",
          includes: ["Transport", "Equipment", "Lunch", "Insurance"],
        }),
        issuer: "John Operator",
        date: new Date("2026-01-18"),
        activity_booking_id: 3, // Links to activity_booking.id = 3
        accommodation_booking_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        receipt_id: "RCP-2026-0004",
        operator_user_id: 3, // operator3
        citizenship: "Australian",
        pax: 4,
        activity_name: "Island Hopping",
        tourist_user_id: 3, // Charlie Explorer
        homest_name: null,
        location: "Kota Kinabalu",
        activity_id: 4,
        homest_id: null,
        total_rm: "800.00",
        total_night: null,
        package: JSON.stringify({
          name: "3 Island Tour",
          includes: ["Boat Transfer", "Snorkeling", "Lunch"],
        }),
        issuer: "Ahmad Operator",
        date: new Date("2026-01-12"),
        activity_booking_id: 4, // Links to activity_booking.id = 4
        accommodation_booking_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        receipt_id: "RCP-2026-0005",
        operator_user_id: 3, // operator3
        citizenship: "Australian",
        pax: 4,
        activity_name: null,
        tourist_user_id: 3, // Charlie Explorer
        homest_name: "Island Beach Resort",
        location: "Kota Kinabalu",
        activity_id: null,
        homest_id: 3,
        total_rm: "960.00",
        total_night: "3",
        package: JSON.stringify({
          name: "Beach Retreat Package",
          includes: ["Breakfast", "Beach Access", "Snorkeling Equipment"],
        }),
        issuer: "Ahmad Operator",
        date: new Date("2026-01-11"),
        activity_booking_id: null,
        accommodation_booking_id: 3, // Links to accommodation_booking.id = 3
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("form_responses", null, {});
  },
};
