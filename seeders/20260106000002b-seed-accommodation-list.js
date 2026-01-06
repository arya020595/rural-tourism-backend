"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Seed accommodation_list with sample accommodations
    await queryInterface.bulkInsert("accommodation_list", [
      {
        accommodation_id: 1,
        rt_user_id: "OP001",
        name: "Kinabalu Mountain Lodge",
        description:
          "Cozy mountain lodge near Mount Kinabalu with stunning views",
        price: 250.0,
        image: null,
        district: "Ranau",
        provided: "WiFi, Hot Water, Breakfast, Mountain View",
        address: "Kundasang, Ranau, Sabah",
        location: "Kundasang",
        show_availability: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        accommodation_id: 2,
        rt_user_id: "OP002",
        name: "Riverside Homestay",
        description:
          "Traditional Sabahan homestay by the river with authentic experience",
        price: 180.0,
        image: null,
        district: "Beaufort",
        provided: "Meals, River View, Local Guide, Traditional Activities",
        address: "Kampung Sungai, Beaufort, Sabah",
        location: "Beaufort",
        show_availability: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        accommodation_id: 3,
        rt_user_id: "OP003",
        name: "Island Beach Resort",
        description:
          "Beachfront resort on Manukan Island with water sports facilities",
        price: 320.0,
        image: null,
        district: "Kota Kinabalu",
        provided: "Beach Access, Snorkeling Gear, Restaurant, Bar",
        address: "Manukan Island, Tunku Abdul Rahman Park",
        location: "Manukan Island",
        show_availability: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        accommodation_id: 4,
        rt_user_id: "OP002",
        name: "Firefly Village Retreat",
        description:
          "Peaceful retreat near Klias wetland, perfect for nature lovers",
        price: 150.0,
        image: null,
        district: "Beaufort",
        provided: "Dinner, Firefly Tour, Breakfast, Nature Walk",
        address: "Klias Village, Beaufort, Sabah",
        location: "Klias",
        show_availability: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("accommodation_list", null, {});
  },
};
