"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Seed form_responses (receipts)
    // All IDs use auto-increment (PostgreSQL SERIAL style)

    // Fetch dynamic IDs from database
    const operators = await queryInterface.sequelize.query(
      `SELECT user_id FROM rt_users ORDER BY user_id LIMIT 3`,
      { type: Sequelize.QueryTypes.SELECT },
    );
    const operator1 = operators[0].user_id;
    const operator2 = operators[1].user_id;
    const operator3 = operators[2].user_id;

    const tourists = await queryInterface.sequelize.query(
      `SELECT tourist_user_id FROM tourist_users ORDER BY tourist_user_id LIMIT 4`,
      { type: Sequelize.QueryTypes.SELECT },
    );
    const tourist1 = tourists[0].tourist_user_id;
    const tourist2 = tourists[1].tourist_user_id;
    const tourist3 = tourists[2].tourist_user_id;

    const activities = await queryInterface.sequelize.query(
      `SELECT id FROM activity_master_table ORDER BY id LIMIT 5`,
      { type: Sequelize.QueryTypes.SELECT },
    );
    const activity1 = activities[0].id;
    const activity2 = activities[1].id;
    const activity4 = activities[3].id;

    const accommodations = await queryInterface.sequelize.query(
      `SELECT accommodation_id FROM accommodation_list ORDER BY accommodation_id`,
      { type: Sequelize.QueryTypes.SELECT },
    );
    const accommodation1 = accommodations[0].accommodation_id;
    const accommodation3 = accommodations[2].accommodation_id;

    const activityBookings = await queryInterface.sequelize.query(
      `SELECT id FROM activity_booking ORDER BY id`,
      { type: Sequelize.QueryTypes.SELECT },
    );
    const activityBooking1 = activityBookings[0].id;
    const activityBooking3 = activityBookings[2].id;
    const activityBooking4 = activityBookings[3].id;

    const accommodationBookings = await queryInterface.sequelize.query(
      `SELECT id FROM accommodation_booking ORDER BY id`,
      { type: Sequelize.QueryTypes.SELECT },
    );
    const accommodationBooking1 = accommodationBookings[0].id;
    const accommodationBooking3 = accommodationBookings[2].id;

    await queryInterface.bulkInsert("form_responses", [
      {
        receipt_id: "RCP-2026-0001",
        operator_user_id: operator1,
        citizenship: "Malaysian",
        pax: 2,
        activity_name: "Mount Kinabalu Climbing",
        tourist_user_id: tourist1,
        homest_name: null,
        location: "Kinabalu National Park",
        activity_id: activity1,
        homest_id: null,
        total_rm: "1700.00",
        total_night: null,
        package: JSON.stringify({
          name: "2D1N Kinabalu Climb",
          includes: ["Guide", "Meals", "Accommodation", "Permits"],
        }),
        issuer: "John Operator",
        date: new Date("2026-01-15"),
        activity_booking_id: activityBooking1,
        accommodation_booking_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        receipt_id: "RCP-2026-0002",
        operator_user_id: operator2,
        citizenship: "Malaysian",
        pax: 2,
        activity_name: null,
        tourist_user_id: tourist1,
        homest_name: "Kinabalu Mountain Lodge",
        location: "Ranau",
        activity_id: null,
        homest_id: accommodation1,
        total_rm: "500.00",
        total_night: "2",
        package: JSON.stringify({
          name: "Lodge Stay Package",
          includes: ["Breakfast", "WiFi", "Mountain View"],
        }),
        issuer: "Jane Operator",
        date: new Date("2026-01-14"),
        activity_booking_id: null,
        accommodation_booking_id: accommodationBooking1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        receipt_id: "RCP-2026-0003",
        operator_user_id: operator1,
        citizenship: "Singaporean",
        pax: 3,
        activity_name: "River Rafting",
        tourist_user_id: tourist2,
        homest_name: null,
        location: "Beaufort",
        activity_id: activity2,
        homest_id: null,
        total_rm: "840.00",
        total_night: null,
        package: JSON.stringify({
          name: "Full Day Rafting",
          includes: ["Transport", "Equipment", "Lunch", "Insurance"],
        }),
        issuer: "John Operator",
        date: new Date("2026-01-18"),
        activity_booking_id: activityBooking3,
        accommodation_booking_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        receipt_id: "RCP-2026-0004",
        operator_user_id: operator3,
        citizenship: "Australian",
        pax: 4,
        activity_name: "Island Hopping",
        tourist_user_id: tourist3,
        homest_name: null,
        location: "Kota Kinabalu",
        activity_id: activity4,
        homest_id: null,
        total_rm: "800.00",
        total_night: null,
        package: JSON.stringify({
          name: "3 Island Tour",
          includes: ["Boat Transfer", "Snorkeling", "Lunch"],
        }),
        issuer: "Ahmad Operator",
        date: new Date("2026-01-12"),
        activity_booking_id: activityBooking4,
        accommodation_booking_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        receipt_id: "RCP-2026-0005",
        operator_user_id: operator3,
        citizenship: "Australian",
        pax: 4,
        activity_name: null,
        tourist_user_id: tourist3,
        homest_name: "Island Beach Resort",
        location: "Kota Kinabalu",
        activity_id: null,
        homest_id: accommodation3,
        total_rm: "960.00",
        total_night: "3",
        package: JSON.stringify({
          name: "Beach Retreat Package",
          includes: ["Breakfast", "Beach Access", "Snorkeling Equipment"],
        }),
        issuer: "Ahmad Operator",
        date: new Date("2026-01-11"),
        activity_booking_id: null,
        accommodation_booking_id: accommodationBooking3,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("form_responses", null, {});
  },
};
