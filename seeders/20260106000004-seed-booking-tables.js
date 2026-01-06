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
        total_price: 1700.0, // 2 pax
        no_of_pax: 2,
        date: "2026-01-15",
        contact_name: "Alice Tourist",
        contact_phone: "+60123456789",
        nationality: "Malaysian",
        status: "confirmed",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 2,
        tourist_user_id: "TU002",
        activity_id: 2, // River Rafting
        operator_activity_id: "OA002",
        total_price: 840.0, // 3 pax
        no_of_pax: 3,
        date: "2026-01-18",
        contact_name: "Bob Traveler",
        contact_phone: "+60198765432",
        nationality: "Singaporean",
        status: "pending",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 3,
        tourist_user_id: "TU003",
        activity_id: 4, // Island Hopping
        operator_activity_id: "OA004",
        total_price: 800.0, // 4 pax
        no_of_pax: 4,
        date: "2026-01-12",
        contact_name: "Charlie Explorer",
        contact_phone: "+60112233445",
        nationality: "Australian",
        status: "confirmed",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 4,
        tourist_user_id: "TU004",
        activity_id: 3, // Firefly Watching
        operator_activity_id: "OA003",
        total_price: 360.0, // 2 pax
        no_of_pax: 2,
        date: "2026-01-14",
        contact_name: "Diana Adventurer",
        contact_phone: "+60155667788",
        nationality: "British",
        status: "completed",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Seed accommodation_booking
    await queryInterface.bulkInsert("accommodation_booking", [
      {
        id: 1,
        tourist_user_id: "TU001",
        accommodation_id: 1, // Kinabalu Mountain Lodge
        check_in: "2026-01-14",
        check_out: "2026-01-16",
        total_no_of_nights: 2,
        total_price: "500.00",
        status: "confirmed",
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
        accommodation_id: 2, // Riverside Chalet
        check_in: "2026-01-17",
        check_out: "2026-01-19",
        total_no_of_nights: 2,
        total_price: "360.00",
        status: "pending",
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
        accommodation_id: 3, // Beachfront Homestay
        check_in: "2026-01-11",
        check_out: "2026-01-14",
        total_no_of_nights: 3,
        total_price: "960.00",
        status: "confirmed",
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
        accommodation_id: 4, // Longhouse Experience
        check_in: "2026-01-20",
        check_out: "2026-01-22",
        total_no_of_nights: 2,
        total_price: "300.00",
        status: "cancelled",
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
