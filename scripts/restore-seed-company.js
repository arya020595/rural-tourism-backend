"use strict";

const { QueryTypes } = require("sequelize");
const db = require("../config/db");

async function run() {
  const now = new Date();

  // Insert the seeded operator company
  await db.query(
    `INSERT INTO companies (
      company_name, address, email, location, postcode,
      total_fulltime_staff, total_partime_staff, contact_no,
      operator_logo_image, motac_license_file, trading_operation_license,
      homestay_certificate, created_at, updated_at
    ) VALUES (
      :company_name, :address, :email, :location, :postcode,
      :total_fulltime_staff, :total_partime_staff, :contact_no,
      :operator_logo_image, NULL, NULL, NULL, :created_at, :updated_at
    )`,
    {
      replacements: {
        company_name: "Seeded Operator Company",
        address: "Jalan Tun Fuad Stephens, Kota Kinabalu",
        email: "operator.company@example.com",
        location: "Kota Kinabalu",
        postcode: "88000",
        total_fulltime_staff: 8,
        total_partime_staff: 3,
        contact_no: "+601155500011",
        operator_logo_image: "default_logo.png",
        created_at: now,
        updated_at: now,
      },
    },
  );

  const [inserted] = await db.query(
    `SELECT id FROM companies WHERE email = 'operator.company@example.com' ORDER BY id DESC LIMIT 1`,
    { type: QueryTypes.SELECT },
  );

  const companyId = Number(inserted.id);
  console.log("Inserted company id:", companyId);

  // Update the user to point to the new company
  await db.query(
    `UPDATE users SET company_id = :companyId WHERE username = 'operator_seed'`,
    { replacements: { companyId } },
  );

  console.log("Updated operator_seed company_id to", companyId);
  db.close();
}

run().catch((e) => {
  console.error(e.message);
  db.close();
  process.exit(1);
});
