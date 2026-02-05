"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Fetch dynamic IDs
    const tourists = await queryInterface.sequelize.query(
      `SELECT tourist_user_id FROM tourist_users ORDER BY tourist_user_id LIMIT 4`,
      { type: Sequelize.QueryTypes.SELECT },
    );
    const tourist1 = tourists[0].tourist_user_id;
    const tourist2 = tourists[1].tourist_user_id;
    const tourist3 = tourists[2].tourist_user_id;
    const tourist4 = tourists[3].tourist_user_id;

    const operators = await queryInterface.sequelize.query(
      `SELECT user_id FROM rt_users ORDER BY user_id LIMIT 3`,
      { type: Sequelize.QueryTypes.SELECT },
    );
    const operator1 = operators[0].user_id;
    const operator3 = operators[2].user_id;

    // Seed notifications (all IDs use auto-increment / PostgreSQL SERIAL style)
    await queryInterface.bulkInsert("notifications", [
      {
        user_id: tourist1,
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
        user_id: tourist1,
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
        user_id: tourist2,
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
        user_id: operator1,
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
        user_id: operator1,
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
        user_id: tourist3,
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
        user_id: tourist4,
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
        tourist_user_id: tourist1,
        rt_user_id: operator1,
        sender_type: "tourist",
        receiver_type: "operator",
        message:
          "Hi, I would like to ask about the Kinabalu climbing package. Is it suitable for beginners?",
        is_read: 1,
        created_at: new Date("2026-01-05 10:00:00"),
        updated_at: new Date("2026-01-05 10:00:00"),
      },
      {
        tourist_user_id: tourist1,
        rt_user_id: operator1,
        sender_type: "operator",
        receiver_type: "tourist",
        message:
          "Hello! Yes, our package is suitable for beginners. We provide experienced guides and proper equipment.",
        is_read: 1,
        created_at: new Date("2026-01-05 10:30:00"),
        updated_at: new Date("2026-01-05 10:30:00"),
      },
      {
        tourist_user_id: tourist1,
        rt_user_id: operator1,
        sender_type: "tourist",
        receiver_type: "operator",
        message:
          "That sounds great! I'll proceed with the booking for 2 people.",
        is_read: 1,
        created_at: new Date("2026-01-05 11:00:00"),
        updated_at: new Date("2026-01-05 11:00:00"),
      },
      {
        tourist_user_id: tourist2,
        rt_user_id: operator1,
        sender_type: "tourist",
        receiver_type: "operator",
        message:
          "What's the minimum age requirement for the river rafting activity?",
        is_read: 1,
        created_at: new Date("2026-01-06 09:00:00"),
        updated_at: new Date("2026-01-06 09:00:00"),
      },
      {
        tourist_user_id: tourist2,
        rt_user_id: operator1,
        sender_type: "operator",
        receiver_type: "tourist",
        message:
          "The minimum age is 12 years old. All participants must be able to swim.",
        is_read: 0,
        created_at: new Date("2026-01-06 09:15:00"),
        updated_at: new Date("2026-01-06 09:15:00"),
      },
      {
        tourist_user_id: tourist3,
        rt_user_id: operator3,
        sender_type: "tourist",
        receiver_type: "operator",
        message:
          "Can we bring our own snorkeling gear for the island hopping trip?",
        is_read: 1,
        created_at: new Date("2026-01-04 14:00:00"),
        updated_at: new Date("2026-01-04 14:00:00"),
      },
      {
        tourist_user_id: tourist3,
        rt_user_id: operator3,
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
