"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Fetch IDs dynamically
    const tourists = await queryInterface.sequelize.query(
      `SELECT tourist_user_id FROM tourist_users ORDER BY tourist_user_id LIMIT 4`,
      { type: Sequelize.QueryTypes.SELECT },
    );

    const activities = await queryInterface.sequelize.query(
      `SELECT id FROM activity_master_table ORDER BY id LIMIT 5`,
      { type: Sequelize.QueryTypes.SELECT },
    );

    const operatorActivities = await queryInterface.sequelize.query(
      `SELECT id FROM operator_activities ORDER BY id`,
      { type: Sequelize.QueryTypes.SELECT },
    );

    const accommodations = await queryInterface.sequelize.query(
      `SELECT accommodation_id FROM accommodation_list ORDER BY accommodation_id`,
      { type: Sequelize.QueryTypes.SELECT },
    );

    const tourist1 = tourists[0].tourist_user_id;
    const tourist2 = tourists[1].tourist_user_id;
    const tourist3 = tourists[2].tourist_user_id;
    const tourist4 = tourists[3].tourist_user_id;

    const activity1 = activities[0].id;
    const activity2 = activities[1].id;
    const activity3 = activities[2].id;
    const activity4 = activities[3].id;

    // Seed activity_booking (all IDs use auto-increment / PostgreSQL SERIAL style)
    await queryInterface.bulkInsert("activity_booking", [
      {
        // id: auto-generated
        tourist_user_id: tourist1,
        activity_id: activity1,
        operator_activity_id: operatorActivities[0].id, // First Mt Kinabalu operator
        total_price: 850.0,
        no_of_pax: 2,
        date: "2026-02-01",
        time: "08:00 - 09:00",
        contact_name: "Alice Tourist",
        contact_phone: "+60123456789",
        nationality: "Malaysian",
        status: "booked",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: 2 (auto-generated)
        tourist_user_id: tourist1, // Alice Tourist
        activity_id: activity1, // Mount Kinabalu
        operator_activity_id: operatorActivities[0].id, // First Mt Kinabalu operator
        total_price: 850.0,
        no_of_pax: 2,
        date: "2026-02-01",
        time: "09:00 - 10:00",
        contact_name: "Alice Tourist",
        contact_phone: "+60123456789",
        nationality: "Malaysian",
        status: "paid",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: 3 (auto-generated)
        tourist_user_id: tourist2, // Bob Traveler
        activity_id: activity2, // River Rafting
        operator_activity_id: operatorActivities[2].id, // First River Rafting operator
        total_price: 280.0,
        no_of_pax: 3,
        date: "2026-02-01",
        time: "14:00 - 15:00",
        contact_name: "Bob Traveler",
        contact_phone: "+60198765432",
        nationality: "Singaporean",
        status: "pending",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: 4 (auto-generated)
        tourist_user_id: tourist3, // Charlie Explorer
        activity_id: activity4, // Island Hopping
        operator_activity_id: operatorActivities[6].id, // First Island Hopping operator
        total_price: 200.0,
        no_of_pax: 4,
        date: "2026-02-02",
        time: "10:00 - 11:00",
        contact_name: "Charlie Explorer",
        contact_phone: "+60112233445",
        nationality: "Australian",
        status: "booked",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: 5 (auto-generated)
        tourist_user_id: tourist4, // Diana Adventurer
        activity_id: activity3, // Firefly Watching
        operator_activity_id: operatorActivities[4].id, // First Firefly operator
        total_price: 180.0,
        no_of_pax: 2,
        date: "2026-02-01",
        time: "15:00 - 16:00",
        contact_name: "Diana Adventurer",
        contact_phone: "+60155667788",
        nationality: "British",
        status: "cancelled",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Seed accommodation_booking (all IDs use auto-increment / PostgreSQL SERIAL style)
    await queryInterface.bulkInsert("accommodation_booking", [
      {
        // id: 1 (auto-generated)
        tourist_user_id: tourist1, // Alice Tourist
        accommodation_id: accommodations[0].accommodation_id, // First accommodation
        check_in: "2026-01-30",
        check_out: "2026-02-01",
        total_no_of_nights: 2,
        total_price: "500.00",
        status: "booked",
        no_of_pax: 2,
        contact_name: "Alice Tourist",
        contact_email: "alice@tourist.com",
        contact_phone: "+60123456789",
        nationality: "Malaysian",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: 2 (auto-generated)
        tourist_user_id: tourist2, // Bob Traveler
        accommodation_id: accommodations[1].accommodation_id, // Second accommodation
        check_in: "2026-02-01",
        check_out: "2026-02-02",
        total_no_of_nights: 1,
        total_price: "180.00",
        status: "paid",
        no_of_pax: 3,
        contact_name: "Bob Traveler",
        contact_email: "bob@traveler.com",
        contact_phone: "+60198765432",
        nationality: "Singaporean",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: 3 (auto-generated)
        tourist_user_id: tourist3, // Charlie Explorer
        accommodation_id: accommodations[2].accommodation_id, // Third accommodation
        check_in: "2026-02-03",
        check_out: "2026-02-04",
        total_no_of_nights: 1,
        total_price: "320.00",
        status: "pending",
        no_of_pax: 4,
        contact_name: "Charlie Explorer",
        contact_email: "charlie@explorer.com",
        contact_phone: "+60112233445",
        nationality: "Australian",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: 4 (auto-generated)
        tourist_user_id: tourist4, // Diana Adventurer
        accommodation_id: accommodations[0].accommodation_id, // First accommodation
        check_in: "2026-02-02",
        check_out: "2026-02-03",
        total_no_of_nights: 1,
        total_price: "250.00",
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
