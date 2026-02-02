"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Seed notifications (all IDs use auto-increment / PostgreSQL SERIAL style)
    await queryInterface.bulkInsert("notifications", [
      {
        // id: auto-generated
        user_id: 1, // tourist 1 (Alice)
        user_type: "tourist",
        title: "Booking Confirmed",
        message: "Your Mount Kinabalu climbing booking has been confirmed!",
        type: "booking",
        related_id: 1,
        is_read: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: auto-generated
        user_id: 1, // tourist 1 (Alice)
        user_type: "tourist",
        title: "Accommodation Confirmed",
        message: "Your stay at Kinabalu Mountain Lodge is confirmed.",
        type: "accommodation",
        related_id: 1,
        is_read: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: auto-generated
        user_id: 2, // tourist 2 (Bob)
        user_type: "tourist",
        title: "Booking Pending",
        message: "Your River Rafting booking is pending confirmation.",
        type: "booking",
        related_id: 2,
        is_read: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: auto-generated
        user_id: 1, // operator 1 (John)
        user_type: "operator",
        title: "New Booking",
        message: "You have received a new booking for Mount Kinabalu.",
        type: "booking",
        related_id: 1,
        is_read: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: auto-generated
        user_id: 1, // operator 1 (John)
        user_type: "operator",
        title: "New Booking",
        message: "You have received a new booking for River Rafting.",
        type: "booking",
        related_id: 2,
        is_read: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: auto-generated
        user_id: 3, // tourist 3 (Charlie)
        user_type: "tourist",
        title: "Booking Confirmed",
        message: "Your Island Hopping trip has been confirmed!",
        type: "booking",
        related_id: 3,
        is_read: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        // id: auto-generated
        user_id: 4, // tourist 4 (Diana)
        user_type: "tourist",
        title: "Booking Cancelled",
        message: "Your Longhouse Experience booking has been cancelled.",
        type: "accommodation",
        related_id: 4,
        is_read: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Seed messages (all IDs use auto-increment / PostgreSQL SERIAL style)
    await queryInterface.bulkInsert("messages", [
      {
        // id: auto-generated
        tourist_user_id: 1, // Alice
        rt_user_id: 1, // operator1
        sender_type: "tourist",
        receiver_type: "operator",
        message:
          "Hi, I would like to ask about the Kinabalu climbing package. Is it suitable for beginners?",
        is_read: 1,
        created_at: new Date("2026-01-05 10:00:00"),
        updated_at: new Date("2026-01-05 10:00:00"),
      },
      {
        // id: auto-generated
        tourist_user_id: 1, // Alice
        rt_user_id: 1, // operator1
        sender_type: "operator",
        receiver_type: "tourist",
        message:
          "Hello! Yes, our package is suitable for beginners. We provide experienced guides and proper equipment.",
        is_read: 1,
        created_at: new Date("2026-01-05 10:30:00"),
        updated_at: new Date("2026-01-05 10:30:00"),
      },
      {
        // id: auto-generated
        tourist_user_id: 1, // Alice
        rt_user_id: 1, // operator1
        sender_type: "tourist",
        receiver_type: "operator",
        message:
          "That sounds great! I'll proceed with the booking for 2 people.",
        is_read: 1,
        created_at: new Date("2026-01-05 11:00:00"),
        updated_at: new Date("2026-01-05 11:00:00"),
      },
      {
        // id: auto-generated
        tourist_user_id: 2, // Bob
        rt_user_id: 1, // operator1
        sender_type: "tourist",
        receiver_type: "operator",
        message:
          "What's the minimum age requirement for the river rafting activity?",
        is_read: 1,
        created_at: new Date("2026-01-06 09:00:00"),
        updated_at: new Date("2026-01-06 09:00:00"),
      },
      {
        // id: auto-generated
        tourist_user_id: 2, // Bob
        rt_user_id: 1, // operator1
        sender_type: "operator",
        receiver_type: "tourist",
        message:
          "The minimum age is 12 years old. All participants must be able to swim.",
        is_read: 0,
        created_at: new Date("2026-01-06 09:15:00"),
        updated_at: new Date("2026-01-06 09:15:00"),
      },
      {
        // id: auto-generated
        tourist_user_id: 3, // Charlie
        rt_user_id: 3, // operator3
        sender_type: "tourist",
        receiver_type: "operator",
        message:
          "Can we bring our own snorkeling gear for the island hopping trip?",
        is_read: 1,
        created_at: new Date("2026-01-04 14:00:00"),
        updated_at: new Date("2026-01-04 14:00:00"),
      },
      {
        // id: auto-generated
        tourist_user_id: 3, // Charlie
        rt_user_id: 3, // operator3
        sender_type: "operator",
        receiver_type: "tourist",
        message:
          "Yes, you can bring your own gear. We also provide complimentary gear if needed.",
        is_read: 1,
        created_at: new Date("2026-01-04 14:30:00"),
        updated_at: new Date("2026-01-04 14:30:00"),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("messages", null, {});
    await queryInterface.bulkDelete("notifications", null, {});
  },
};
