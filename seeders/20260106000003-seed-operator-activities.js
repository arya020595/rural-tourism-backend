"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
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
      { time: "09:00 - 10:00", price: 45 },
      { time: "10:00 - 11:30", price: 45 },
    ];

    // Seed operator_activities - Each activity has 2 different operators
    await queryInterface.bulkInsert("operator_activities", [
      // Mount Kinabalu Climbing - 2 operators
      {
        id: "OA001",
        activity_id: 1,
        rt_user_id: "OP001",
        address: "Kinabalu National Park, Ranau, Sabah",
        district: "Ranau",
        image: "operator-kinabalu-1.jpg",
        description:
          "2D1N Mount Kinabalu climbing package with experienced guide",
        services_provided: "Transport, Guide, Meals, Accommodation, Permits",
        available_dates: JSON.stringify(
          generateDatesWithSlots(0, 2, morningSlots),
        ),
        price_per_pax: 850.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: "OA006",
        activity_id: 1,
        rt_user_id: "OP002",
        address: "Kinabalu National Park, Ranau, Sabah",
        district: "Ranau",
        image: "operator-kinabalu-2.jpg",
        description:
          "Budget-friendly Mount Kinabalu climb with local expert guide",
        services_provided: "Guide, Meals, Permits, First Aid Kit",
        available_dates: JSON.stringify(
          generateDatesWithSlots(1, 2, morningSlots),
        ),
        price_per_pax: 750.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      // River Rafting - 2 operators
      {
        id: "OA002",
        activity_id: 2,
        rt_user_id: "OP001",
        address: "Padas River, Beaufort, Sabah",
        district: "Beaufort",
        image: "operator-rafting-1.jpg",
        description: "Full day white water rafting adventure with BBQ lunch",
        services_provided: "Transport, Equipment, Guide, Lunch, Insurance",
        available_dates: JSON.stringify(
          generateDatesWithSlots(2, 2, afternoonSlots),
        ),
        price_per_pax: 280.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: "OA007",
        activity_id: 2,
        rt_user_id: "OP003",
        address: "Padas River, Beaufort, Sabah",
        district: "Beaufort",
        image: "operator-rafting-2.jpg",
        description:
          "Extreme white water rafting with professional safety team",
        services_provided:
          "Transport, Equipment, Guide, Lunch, Insurance, Photos",
        available_dates: JSON.stringify(
          generateDatesWithSlots(0, 2, morningSlots),
        ),
        price_per_pax: 320.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      // Firefly Watching - 2 operators
      {
        id: "OA003",
        activity_id: 3,
        rt_user_id: "OP002",
        address: "Klias Wetland, Beaufort, Sabah",
        district: "Beaufort",
        image: "operator-firefly-1.jpg",
        description: "Evening cruise with dinner and proboscis monkey spotting",
        services_provided: "Transport, Boat Ride, Dinner, Guide",
        available_dates: JSON.stringify(
          generateDatesWithSlots(0, 2, morningSlots),
        ),
        price_per_pax: 180.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: "OA008",
        activity_id: 3,
        rt_user_id: "OP001",
        address: "Klias Wetland, Beaufort, Sabah",
        district: "Beaufort",
        image: "operator-firefly-2.jpg",
        description:
          "Sunset river cruise with traditional Sabahan dinner buffet",
        services_provided:
          "Transport, Boat Ride, Buffet Dinner, Guide, Binoculars",
        available_dates: JSON.stringify(
          generateDatesWithSlots(1, 2, morningSlots),
        ),
        price_per_pax: 220.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      // Island Hopping - 2 operators
      {
        id: "OA004",
        activity_id: 4,
        rt_user_id: "OP003",
        address: "Jesselton Point, Kota Kinabalu, Sabah",
        district: "Kota Kinabalu",
        image: "operator-island-1.jpg",
        description:
          "Visit 3 beautiful islands with snorkeling and beach activities",
        services_provided: "Boat Transfer, Snorkeling Gear, Lunch, Guide",
        available_dates: JSON.stringify(
          generateDatesWithSlots(2, 2, afternoonSlots),
        ),
        price_per_pax: 200.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: "OA009",
        activity_id: 4,
        rt_user_id: "OP002",
        address: "Jesselton Point, Kota Kinabalu, Sabah",
        district: "Kota Kinabalu",
        image: "operator-island-2.jpg",
        description:
          "Premium island hopping with 5 islands and underwater photography",
        services_provided:
          "Boat Transfer, Snorkeling Gear, BBQ Lunch, Guide, GoPro Rental",
        available_dates: JSON.stringify(
          generateDatesWithSlots(0, 2, morningSlots),
        ),
        price_per_pax: 280.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      // Cultural Village Tour - 2 operators
      {
        id: "OA005",
        activity_id: 5,
        rt_user_id: "OP003",
        address: "Mari Mari Cultural Village, Kota Kinabalu",
        district: "Kota Kinabalu",
        image: "operator-cultural-1.jpg",
        description: "Half day tour exploring 5 traditional ethnic houses",
        services_provided: "Transport, Entrance Fee, Guide, Traditional Snacks",
        available_dates: JSON.stringify(
          generateDatesWithSlots(0, 2, morningSlots),
        ),
        price_per_pax: 150.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: "OA010",
        activity_id: 5,
        rt_user_id: "OP001",
        address: "Mari Mari Cultural Village, Kota Kinabalu",
        district: "Kota Kinabalu",
        image: "operator-cultural-2.jpg",
        description:
          "Full day immersive cultural experience with hands-on activities",
        services_provided:
          "Transport, Entrance Fee, Guide, Traditional Lunch, Costume Rental",
        available_dates: JSON.stringify(
          generateDatesWithSlots(1, 2, morningSlots),
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
