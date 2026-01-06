"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Seed operator_activities
    await queryInterface.bulkInsert("operator_activities", [
      {
        id: "OA001",
        activity_id: 1, // Mount Kinabalu Climbing
        rt_user_id: "OP001",
        address: "Kinabalu National Park, Ranau, Sabah",
        district: "Ranau",
        image: null,
        description:
          "2D1N Mount Kinabalu climbing package with experienced guide",
        services_provided: "Transport, Guide, Meals, Accommodation, Permits",
        available_dates: JSON.stringify([
          "2026-01-10",
          "2026-01-15",
          "2026-01-20",
          "2026-01-25",
          "2026-02-01",
          "2026-02-10",
        ]),
        price_per_pax: 850.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: "OA002",
        activity_id: 2, // River Rafting
        rt_user_id: "OP001",
        address: "Padas River, Beaufort, Sabah",
        district: "Beaufort",
        image: null,
        description: "Full day white water rafting adventure with BBQ lunch",
        services_provided: "Transport, Equipment, Guide, Lunch, Insurance",
        available_dates: JSON.stringify([
          "2026-01-11",
          "2026-01-12",
          "2026-01-18",
          "2026-01-19",
          "2026-01-25",
          "2026-01-26",
        ]),
        price_per_pax: 280.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: "OA003",
        activity_id: 3, // Firefly Watching
        rt_user_id: "OP002",
        address: "Klias Wetland, Beaufort, Sabah",
        district: "Beaufort",
        image: null,
        description: "Evening cruise with dinner and proboscis monkey spotting",
        services_provided: "Transport, Boat Ride, Dinner, Guide",
        available_dates: JSON.stringify([
          "2026-01-10",
          "2026-01-11",
          "2026-01-12",
          "2026-01-13",
          "2026-01-14",
          "2026-01-15",
        ]),
        price_per_pax: 180.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: "OA004",
        activity_id: 4, // Island Hopping
        rt_user_id: "OP003",
        address: "Jesselton Point, Kota Kinabalu, Sabah",
        district: "Kota Kinabalu",
        image: null,
        description:
          "Visit 3 beautiful islands with snorkeling and beach activities",
        services_provided: "Boat Transfer, Snorkeling Gear, Lunch, Guide",
        available_dates: JSON.stringify([
          "2026-01-10",
          "2026-01-11",
          "2026-01-12",
          "2026-01-13",
          "2026-01-14",
          "2026-01-15",
          "2026-01-16",
        ]),
        price_per_pax: 200.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: "OA005",
        activity_id: 5, // Cultural Village Tour
        rt_user_id: "OP003",
        address: "Mari Mari Cultural Village, Kota Kinabalu",
        district: "Kota Kinabalu",
        image: null,
        description: "Half day tour exploring 5 traditional ethnic houses",
        services_provided: "Transport, Entrance Fee, Guide, Traditional Snacks",
        available_dates: JSON.stringify([
          "2026-01-10",
          "2026-01-11",
          "2026-01-12",
          "2026-01-13",
          "2026-01-14",
        ]),
        price_per_pax: 150.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("operator_activities", null, {});
  },
};
