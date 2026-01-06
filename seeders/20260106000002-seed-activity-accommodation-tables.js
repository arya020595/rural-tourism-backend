"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Seed activity_master_table
    await queryInterface.bulkInsert("activity_master_table", [
      {
        id: 1,
        activity_name: "Mount Kinabalu Climbing",
        description:
          "Experience the majestic Mount Kinabalu, Southeast Asia's highest peak",
        address: "Kinabalu National Park, Ranau",
        things_to_know: "Bring warm clothing, hiking boots required",
        image: null,
        show_in_suggestions: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 2,
        activity_name: "River Rafting",
        description: "Thrilling white water rafting adventure on Padas River",
        address: "Padas River, Beaufort",
        things_to_know: "Swimming ability required, life jackets provided",
        image: null,
        show_in_suggestions: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 3,
        activity_name: "Firefly Watching",
        description: "Magical night cruise to see thousands of fireflies",
        address: "Klias River, Beaufort",
        things_to_know:
          "Best viewed on clear nights, insect repellent recommended",
        image: null,
        show_in_suggestions: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 4,
        activity_name: "Island Hopping",
        description: "Explore beautiful islands around Kota Kinabalu",
        address: "Jesselton Point, Kota Kinabalu",
        things_to_know: "Bring sunscreen, snorkeling gear available",
        image: null,
        show_in_suggestions: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 5,
        activity_name: "Cultural Village Tour",
        description: "Learn about indigenous cultures of Sabah",
        address: "Mari Mari Cultural Village, Kota Kinabalu",
        things_to_know: "Comfortable walking shoes recommended",
        image: null,
        show_in_suggestions: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Seed activity table (legacy)
    await queryInterface.bulkInsert("activity", [
      {
        activity_id: 1,
        activity_name: "Jungle Trekking",
        description: "Explore the rainforest with experienced guides",
        price: 150.0,
        image: null,
        district: "Sandakan",
        things_to_know: "Wear long pants and closed shoes",
        user_id: "OP001",
        location: "5.8402,118.1179",
        address: "Sepilok Forest Reserve, Sandakan",
        show_in_suggestion: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        activity_id: 2,
        activity_name: "Scuba Diving",
        description: "Discover underwater wonders at Sipadan Island",
        price: 500.0,
        image: null,
        district: "Semporna",
        things_to_know: "PADI certification required for advanced dives",
        user_id: "OP001",
        location: "4.1147,118.6288",
        address: "Sipadan Island, Semporna",
        show_in_suggestion: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Seed accomodation_list
    await queryInterface.bulkInsert("accomodation_list", [
      {
        accomodation_id: 1,
        rt_user_id: "OP002",
        name: "Kinabalu Mountain Lodge",
        description:
          "Cozy lodge at the foot of Mount Kinabalu with stunning views",
        price: 250.0,
        image: null,
        district: "Ranau",
        provided: "Breakfast, WiFi, Hot Shower, Mountain View",
        address: "Kinabalu Park Road, Ranau, Sabah",
        location: "6.0753,116.5432",
        show_availability: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        accomodation_id: 2,
        rt_user_id: "OP002",
        name: "Riverside Chalet",
        description: "Traditional wooden chalet by the river",
        price: 180.0,
        image: null,
        district: "Beaufort",
        provided: "Breakfast, River View, Traditional Dinner",
        address: "Kampung Padas, Beaufort, Sabah",
        location: "5.3456,115.7654",
        show_availability: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        accomodation_id: 3,
        rt_user_id: "OP003",
        name: "Beachfront Homestay",
        description: "Relax at our beachfront property with ocean views",
        price: 320.0,
        image: null,
        district: "Kota Belud",
        provided: "Breakfast, Beach Access, Snorkeling Equipment, WiFi",
        address: "Pantai Tempurung, Kota Belud, Sabah",
        location: "6.3421,116.4567",
        show_availability: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        accomodation_id: 4,
        rt_user_id: "OP003",
        name: "Longhouse Experience",
        description: "Authentic Rungus longhouse stay experience",
        price: 150.0,
        image: null,
        district: "Kudat",
        provided: "Traditional Meals, Cultural Performance, Guided Tours",
        address: "Kampung Bavanggazo, Kudat, Sabah",
        location: "6.8845,116.8432",
        show_availability: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("accomodation_list", null, {});
    await queryInterface.bulkDelete("activity", null, {});
    await queryInterface.bulkDelete("activity_master_table", null, {});
  },
};
