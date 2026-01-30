"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Seed activity_booking
    await queryInterface.bulkInsert("activity_booking", [
      {
        id: 1,
        tourist_user_id: "TU001",
        activity_id: 1, // Mount Kinabalu
        operator_activity_id: "OA001",
        total_price: 850.0,
        no_of_pax: 2,
        date: "2026-02-01",
        time: "08:00 - 09:00", // ← ADDED: Morning slot
        contact_name: "Alice Tourist",
        contact_phone: "+60123456789",
        nationality: "Malaysian",
        status: "booked", // ← lowercase for consistency
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 2,
        tourist_user_id: "TU001",
        activity_id: 1, // Mount Kinabalu
        operator_activity_id: "OA001",
        total_price: 850.0,
        no_of_pax: 2,
        date: "2026-02-01",
        time: "09:00 - 10:00", // ← ADDED: Another morning slot (same day, different time)
        contact_name: "Alice Tourist",
        contact_phone: "+60123456789",
        nationality: "Malaysian",
        status: "paid", // ← This one is paid
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 3,
        tourist_user_id: "TU002",
        activity_id: 2, // River Rafting
        operator_activity_id: "OA002",
        total_price: 280.0,
        no_of_pax: 3,
        date: "2026-02-01",
        time: "14:00 - 15:00", // ← ADDED: Afternoon slot
        contact_name: "Bob Traveler",
        contact_phone: "+60198765432",
        nationality: "Singaporean",
        status: "pending", // ← pending = NOT blocked
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 4,
        tourist_user_id: "TU003",
        activity_id: 4, // Island Hopping
        operator_activity_id: "OA004",
        total_price: 200.0,
        no_of_pax: 4,
        date: "2026-02-02",
        time: "10:00 - 11:00", // ← ADDED
        contact_name: "Charlie Explorer",
        contact_phone: "+60112233445",
        nationality: "Australian",
        status: "booked",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 5,
        tourist_user_id: "TU004",
        activity_id: 3, // Firefly Watching
        operator_activity_id: "OA003",
        total_price: 180.0,
        no_of_pax: 2,
        date: "2026-02-01",
        time: "15:00 - 16:00", // ← ADDED
        contact_name: "Diana Adventurer",
        contact_phone: "+60155667788",
        nationality: "British",
        status: "cancelled", // ← cancelled = NOT blocked
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Seed accommodation_booking
    await queryInterface.bulkInsert("accommodation_booking", [
      {
        id: 1,
        tourist_user_id: "TU001",
        accommodation_id: 1, // Kinabalu Mountain Lodge (has dates 2026-01-29 to 2026-02-04)
        check_in: "2026-01-30",
        check_out: "2026-02-01", // Blocks: Jan 30, 31, Feb 1
        total_no_of_nights: 2,
        total_price: "500.00",
        status: "booked", // ← lowercase, will BLOCK these dates
        no_of_pax: 2,
        contact_name: "Alice Tourist",
        contact_email: "alice@tourist.com",
        contact_phone: "+60123456789",
        nationality: "Malaysian",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 2,
        tourist_user_id: "TU002",
        accommodation_id: 2, // Riverside Homestay (has dates 2026-01-31 to 2026-02-04)
        check_in: "2026-02-01",
        check_out: "2026-02-02", // Blocks: Feb 1, 2
        total_no_of_nights: 1,
        total_price: "180.00",
        status: "paid", // ← Will BLOCK these dates
        no_of_pax: 3,
        contact_name: "Bob Traveler",
        contact_email: "bob@traveler.com",
        contact_phone: "+60198765432",
        nationality: "Singaporean",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 3,
        tourist_user_id: "TU003",
        accommodation_id: 3, // Island Beach Resort (has dates 2026-01-29 to 2026-02-04)
        check_in: "2026-02-03",
        check_out: "2026-02-04", // Blocks: Feb 3, 4
        total_no_of_nights: 1,
        total_price: "320.00",
        status: "pending", // ← Will NOT block (pending)
        no_of_pax: 4,
        contact_name: "Charlie Explorer",
        contact_email: "charlie@explorer.com",
        contact_phone: "+60112233445",
        nationality: "Australian",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 4,
        tourist_user_id: "TU004",
        accommodation_id: 1, // Kinabalu Mountain Lodge again
        check_in: "2026-02-02",
        check_out: "2026-02-03", // Blocks: Feb 2, 3
        total_no_of_nights: 1,
        total_price: "250.00",
        status: "cancelled", // ← Will NOT block (cancelled)
        no_of_pax: 2,
        contact_name: "Diana Adventurer",
        contact_email: "diana@adventure.com",
        contact_phone: "+60155667788",
        nationality: "British",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("accommodation_booking", null, {});
    await queryInterface.bulkDelete("activity_booking", null, {});
  },
};
