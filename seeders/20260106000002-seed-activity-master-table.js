"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Seed activity_master_table with sample activities
    await queryInterface.bulkInsert("activity_master_table", [
      {
        id: 1,
        activity_name: "Mount Kinabalu Climbing",
        description: "Climb Southeast Asia's highest peak at 4,095 meters",
        address: "Kinabalu National Park, Ranau, Sabah",
        things_to_know: "Requires physical fitness, Permits needed, 2D1N trip",
        image: null,
        show_in_suggestions: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 2,
        activity_name: "River Rafting",
        description: "White water rafting adventure on Padas River",
        address: "Padas River, Beaufort, Sabah",
        things_to_know: "Grade 3-4 rapids, Swimming skills required",
        image: null,
        show_in_suggestions: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 3,
        activity_name: "Firefly Watching",
        description: "Evening river cruise to see magical fireflies",
        address: "Klias Wetland, Beaufort, Sabah",
        things_to_know: "Best at night, Includes proboscis monkey spotting",
        image: null,
        show_in_suggestions: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 4,
        activity_name: "Island Hopping",
        description: "Visit multiple islands with snorkeling activities",
        address: "Tunku Abdul Rahman Marine Park, Kota Kinabalu",
        things_to_know: "Bring sunscreen, Snorkeling gear provided",
        image: null,
        show_in_suggestions: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 5,
        activity_name: "Cultural Village Tour",
        description: "Experience traditional Sabahan cultures and customs",
        address: "Mari Mari Cultural Village, Kota Kinabalu",
        things_to_know: "Half-day tour, Traditional food included",
        image: null,
        show_in_suggestions: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("activity_master_table", null, {});
  },
};
