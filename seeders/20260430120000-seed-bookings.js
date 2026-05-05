"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;
    const now = new Date();

    // Resolve company
    const companies = await queryInterface.sequelize.query(
      "SELECT id, company_name FROM companies ORDER BY id ASC LIMIT 1",
      { type: QueryTypes.SELECT },
    );

    if (companies.length === 0) {
      console.warn("No companies found – skipping booking seed.");
      return;
    }

    const company = companies[0];

    // Resolve operator user belonging to that company
    const users = await queryInterface.sequelize.query(
      "SELECT id, name FROM users WHERE company_id = :companyId ORDER BY id ASC LIMIT 1",
      { type: QueryTypes.SELECT, replacements: { companyId: company.id } },
    );

    if (users.length === 0) {
      console.warn(
        `No users found for company ${company.id} – skipping booking seed.`,
      );
      return;
    }

    const operator = users[0];

    const bookings = [
      {
        booking_type: "activity",
        tourist_full_name: "Amiirul Hamizan",
        citizenship: "Malaysian",
        no_of_pax_antarbangsa: 0,
        no_of_pax_domestik: 1,
        product_id: null,
        product_name: "Kiulu Water Rafting",
        activity_date: new Date("2025-01-21T08:30:00Z"),
        total_price: "120.00",
        user_id: operator.id,
        user_fullname: operator.name,
        check_in_date: null,
        check_out_date: null,
        total_of_night: null,
        status: "pending",
        receipt_created_at: null,
        operator_name: operator.name,
        company_id: company.id,
        company_name: company.company_name,
        created_at: now,
        updated_at: now,
      },
      {
        booking_type: "activity",
        tourist_full_name: "Siti Nuraini Binti Razali",
        citizenship: "Malaysian",
        no_of_pax_antarbangsa: 0,
        no_of_pax_domestik: 3,
        product_id: null,
        product_name: "Kiulu Water Rafting",
        activity_date: new Date("2025-02-10T09:00:00Z"),
        total_price: "360.00",
        user_id: operator.id,
        user_fullname: operator.name,
        check_in_date: null,
        check_out_date: null,
        total_of_night: null,
        status: "paid",
        receipt_created_at: now,
        operator_name: operator.name,
        company_id: company.id,
        company_name: company.company_name,
        created_at: now,
        updated_at: now,
      },
      {
        booking_type: "accommodation",
        tourist_full_name: "Rajesh Kumar",
        citizenship: "Indian",
        no_of_pax_antarbangsa: 2,
        no_of_pax_domestik: 0,
        product_id: null,
        product_name: "Jungle Lodge",
        activity_date: null,
        total_price: "450.00",
        user_id: operator.id,
        user_fullname: operator.name,
        check_in_date: "2025-03-15",
        check_out_date: "2025-03-18",
        total_of_night: 3,
        status: "confirmed",
        receipt_created_at: null,
        operator_name: operator.name,
        company_id: company.id,
        company_name: company.company_name,
        created_at: now,
        updated_at: now,
      },
      {
        booking_type: "activity",
        tourist_full_name: "Lim Wei Xian",
        citizenship: "Malaysian",
        no_of_pax_antarbangsa: 0,
        no_of_pax_domestik: 2,
        product_id: null,
        product_name: "Kayaking",
        activity_date: new Date("2025-04-05T08:00:00Z"),
        total_price: "200.00",
        user_id: operator.id,
        user_fullname: operator.name,
        check_in_date: null,
        check_out_date: null,
        total_of_night: null,
        status: "booked",
        receipt_created_at: null,
        operator_name: operator.name,
        company_id: company.id,
        company_name: company.company_name,
        created_at: now,
        updated_at: now,
      },
      {
        booking_type: "accommodation",
        tourist_full_name: "Michael Tan Ah Kow",
        citizenship: "Malaysian",
        no_of_pax_antarbangsa: 0,
        no_of_pax_domestik: 4,
        product_id: null,
        product_name: "Resort Sentosa",
        activity_date: null,
        total_price: "800.00",
        user_id: operator.id,
        user_fullname: operator.name,
        check_in_date: "2025-05-01",
        check_out_date: "2025-05-03",
        total_of_night: 2,
        status: "completed",
        receipt_created_at: now,
        operator_name: operator.name,
        company_id: company.id,
        company_name: company.company_name,
        created_at: now,
        updated_at: now,
      },
    ];

    await queryInterface.bulkInsert("bookings", bookings, {});

    console.log(
      `Seeded ${bookings.length} bookings for company "${company.company_name}".`,
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("bookings", null, {});
  },
};
