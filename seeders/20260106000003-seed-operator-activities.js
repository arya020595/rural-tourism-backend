"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Fetch operator and activity master IDs dynamically
    const operators = await queryInterface.sequelize.query(
      `SELECT user_id FROM rt_users ORDER BY user_id LIMIT 3`,
      { type: Sequelize.QueryTypes.SELECT },
    );

    const activities = await queryInterface.sequelize.query(
      `SELECT id FROM activity_master_table ORDER BY id LIMIT 5`,
      { type: Sequelize.QueryTypes.SELECT },
    );

    const operator1 = operators[0].user_id;
    const operator2 = operators[1].user_id;
    const operator3 = operators[2].user_id;

    const activity1 = activities[0].id; // Mount Kinabalu
    const activity2 = activities[1].id; // River Rafting
    const activity3 = activities[2].id; // Firefly Watching
    const activity4 = activities[3].id; // Island Hopping
    const activity5 = activities[4].id; // Cultural Village

    // Helper function to generate dates dynamically
    const generateDatesWithSlots = (startDaysFromNow, daysCount, timeSlots) => {
      const dates = [];
      const today = new Date();

      for (let i = 0; i < daysCount; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + startDaysFromNow + i);
        const dateStr = date.toISOString().split("T")[0];

        timeSlots.forEach((slot) => {
          dates.push({
            date: dateStr,
            time: slot.time,
            price: slot.price,
          });
        });
      }
      return dates;
    };

    // Define time slot patterns
    const morningSlots = [
      { time: "08:00 - 09:00", price: 30 },
      { time: "09:00 - 10:00", price: 30 },
      { time: "10:00 - 11:00", price: 30 },
    ];

    const afternoonSlots = [
      { time: "14:00 - 15:00", price: 45 },
      { time: "15:00 - 16:00", price: 45 },
      { time: "16:00 - 17:00", price: 45 },
    ];

    // Seed operator_activities - id uses auto-increment (PostgreSQL SERIAL style)
    // Each activity has 2 different operators
    await queryInterface.bulkInsert("operator_activities", [
      // Mount Kinabalu Climbing - 2 operators
      {
        // id: 1 (auto-generated)
        activity_id: activity1,
        rt_user_id: operator1, // operator1
        address: "Kinabalu National Park, Ranau, Sabah",
        district: "Ranau",
        image: "operator-kinabalu-1.jpg",
        description:
          "2D1N Mount Kinabalu climbing package with experienced guide",
        services_provided: "Transport, Guide, Meals, Accommodation, Permits",
        available_dates: JSON.stringify(
          generateDatesWithSlots(0, 5, morningSlots),
        ),
        price_per_pax: 850.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: 2 (auto-generated)
        activity_id: activity1,
        rt_user_id: operator2, // operator2
        address: "Kinabalu National Park, Ranau, Sabah",
        district: "Ranau",
        image: "operator-kinabalu-2.jpg",
        description:
          "Budget-friendly Mount Kinabalu climb with local expert guide",
        services_provided: "Guide, Meals, Permits, First Aid Kit",
        available_dates: JSON.stringify(
          generateDatesWithSlots(1, 5, morningSlots),
        ),
        price_per_pax: 750.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      // River Rafting - 2 operators
      {
        // id: 3 (auto-generated)
        activity_id: activity2,
        rt_user_id: operator1, // operator1
        address: "Padas River, Beaufort, Sabah",
        district: "Beaufort",
        image: "operator-rafting-1.jpg",
        description: "Full day white water rafting adventure with BBQ lunch",
        services_provided: "Transport, Equipment, Guide, Lunch, Insurance",
        available_dates: JSON.stringify(
          generateDatesWithSlots(2, 4, afternoonSlots),
        ),
        price_per_pax: 280.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: 4 (auto-generated)
        activity_id: activity2,
        rt_user_id: operator3, // operator3
        address: "Padas River, Beaufort, Sabah",
        district: "Beaufort",
        image: "operator-rafting-2.jpg",
        description:
          "Extreme white water rafting with professional safety team",
        services_provided:
          "Transport, Equipment, Guide, Lunch, Insurance, Photos",
        available_dates: JSON.stringify(
          generateDatesWithSlots(0, 5, morningSlots),
        ),
        price_per_pax: 320.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      // Firefly Watching - 2 operators
      {
        // id: 5 (auto-generated)
        activity_id: activity3,
        rt_user_id: operator2, // operator2
        address: "Klias Wetland, Beaufort, Sabah",
        district: "Beaufort",
        image: "operator-firefly-1.jpg",
        description: "Evening cruise with dinner and proboscis monkey spotting",
        services_provided: "Transport, Boat Ride, Dinner, Guide",
        available_dates: JSON.stringify(
          generateDatesWithSlots(0, 5, morningSlots),
        ),
        price_per_pax: 180.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: 6 (auto-generated)
        activity_id: activity3,
        rt_user_id: operator1, // operator1
        address: "Klias Wetland, Beaufort, Sabah",
        district: "Beaufort",
        image: "operator-firefly-2.jpg",
        description:
          "Sunset river cruise with traditional Sabahan dinner buffet",
        services_provided:
          "Transport, Boat Ride, Buffet Dinner, Guide, Binoculars",
        available_dates: JSON.stringify(
          generateDatesWithSlots(1, 5, morningSlots),
        ),
        price_per_pax: 220.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      // Island Hopping - 2 operators
      {
        // id: 7 (auto-generated)
        activity_id: activity4,
        rt_user_id: operator3, // operator3
        address: "Jesselton Point, Kota Kinabalu, Sabah",
        district: "Kota Kinabalu",
        image: "operator-island-1.jpg",
        description:
          "Visit 3 beautiful islands with snorkeling and beach activities",
        services_provided: "Boat Transfer, Snorkeling Gear, Lunch, Guide",
        available_dates: JSON.stringify(
          generateDatesWithSlots(2, 4, afternoonSlots),
        ),
        price_per_pax: 200.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: 8 (auto-generated)
        activity_id: activity4,
        rt_user_id: operator2, // operator2
        address: "Jesselton Point, Kota Kinabalu, Sabah",
        district: "Kota Kinabalu",
        image: "operator-island-2.jpg",
        description:
          "Premium island hopping with 5 islands and underwater photography",
        services_provided:
          "Boat Transfer, Snorkeling Gear, BBQ Lunch, Guide, GoPro Rental",
        available_dates: JSON.stringify(
          generateDatesWithSlots(0, 5, morningSlots),
        ),
        price_per_pax: 280.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      // Cultural Village Tour - 2 operators
      {
        // id: 9 (auto-generated)
        activity_id: activity5,
        rt_user_id: operator3, // operator3
        address: "Mari Mari Cultural Village, Kota Kinabalu",
        district: "Kota Kinabalu",
        image: "operator-cultural-1.jpg",
        description: "Half day tour exploring 5 traditional ethnic houses",
        services_provided: "Transport, Entrance Fee, Guide, Traditional Snacks",
        available_dates: JSON.stringify(
          generateDatesWithSlots(0, 5, morningSlots),
        ),
        price_per_pax: 150.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: 10 (auto-generated)
        activity_id: activity5,
        rt_user_id: operator1, // operator1
        address: "Mari Mari Cultural Village, Kota Kinabalu",
        district: "Kota Kinabalu",
        image: "operator-cultural-2.jpg",
        description:
          "Full day immersive cultural experience with hands-on activities",
        services_provided:
          "Transport, Entrance Fee, Guide, Traditional Lunch, Costume Rental",
        available_dates: JSON.stringify(
          generateDatesWithSlots(1, 5, morningSlots),
        ),
        price_per_pax: 200.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("operator_activities", null, {});
  },
};
