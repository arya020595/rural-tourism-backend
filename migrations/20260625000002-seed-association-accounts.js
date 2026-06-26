"use strict";

const bcrypt = require("bcrypt");

/**
 * Creates one login account (in the `users` table) for each association, so
 * every association has its own credentials. Accounts use the `association`
 * role and are linked to their own association_id, which lets the header logo
 * show the association's image instead of a company logo.
 *
 * Username convention: lowercase short code (kobeta, rata, kta, ...).
 * All accounts share a default password (stored hashed). Change after rollout.
 */
const DEFAULT_PASSWORD = "password123";
const SALT_ROUNDS = 10;

// Maps association full name -> account details.
const ACCOUNTS = [
  {
    associationName: "KOTA BELUD TOURISM ASSOCIATION (KOBETA)",
    username: "kobeta",
    email: "kobeta@ruraltourismsabah.com",
    fullName: "KOBETA Association Admin",
  },
  {
    associationName: "RANAU TOURISM ASSOCIATION (RATA)",
    username: "rata",
    email: "rata@ruraltourismsabah.com",
    fullName: "RATA Association Admin",
  },
  {
    associationName: "KOTA MARUDU TOURISM DEVELOPMENT ASSOCIATION (KOMTDA)",
    username: "komtda",
    email: "komtda@ruraltourismsabah.com",
    fullName: "KOMTDA Association Admin",
  },
  {
    associationName: "PERSATUAN PELANCONGAN ULU SUGUT (USTA)",
    username: "usta",
    email: "usta@ruraltourismsabah.com",
    fullName: "USTA Association Admin",
  },
  {
    associationName: "NABALU TOURISM ASSOCIATION (NTA)",
    username: "nta",
    email: "nta@ruraltourismsabah.com",
    fullName: "NTA Association Admin",
  },
  {
    associationName: "PERSATUAN PELANCONGAN KADAMAIAN SABAH (KATA)",
    username: "kata",
    email: "kata@ruraltourismsabah.com",
    fullName: "KATA Association Admin",
  },
  {
    associationName: "KIULU TOURISM ASSOCIATION (KTA)",
    username: "kta",
    email: "kta@ruraltourismsabah.com",
    fullName: "KTA Association Admin",
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;
    const now = new Date();
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    const roleRows = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE name = 'association' LIMIT 1`,
      { type: QueryTypes.SELECT },
    );
    const associationRoleId = Number(roleRows[0]?.id || 0);
    if (!associationRoleId) {
      throw new Error(
        "Missing 'association' RBAC role. Run RBAC role seeders first.",
      );
    }

    for (const account of ACCOUNTS) {
      const assocRows = await queryInterface.sequelize.query(
        `SELECT id FROM associations
         WHERE name = :name AND deleted_at IS NULL
         LIMIT 1`,
        {
          type: QueryTypes.SELECT,
          replacements: { name: account.associationName },
        },
      );
      const associationId = Number(assocRows[0]?.id || 0);
      if (!associationId) {
        // Association not present in this DB; skip rather than fail.
        continue;
      }

      const existing = await queryInterface.sequelize.query(
        `SELECT id FROM users
         WHERE username = :username OR email = :email
         LIMIT 1`,
        {
          type: QueryTypes.SELECT,
          replacements: {
            username: account.username,
            email: account.email,
          },
        },
      );
      if (existing.length > 0) {
        continue;
      }

      await queryInterface.sequelize.query(
        `INSERT INTO users (
          name, username, email, password, confirm_password,
          association_id, role_id, company_id, created_at, updated_at
        ) VALUES (
          :name, :username, :email, :password, :confirm_password,
          :association_id, :role_id, NULL, :created_at, :updated_at
        )`,
        {
          replacements: {
            name: account.fullName,
            username: account.username,
            email: account.email,
            password: passwordHash,
            confirm_password: passwordHash,
            association_id: associationId,
            role_id: associationRoleId,
            created_at: now,
            updated_at: now,
          },
        },
      );
    }
  },

  async down(queryInterface, Sequelize) {
    const usernames = ACCOUNTS.map((a) => a.username);
    const emails = ACCOUNTS.map((a) => a.email);
    await queryInterface.bulkDelete("users", {
      [Sequelize.Op.or]: [
        { username: usernames },
        { email: emails },
      ],
    });
  },
};
