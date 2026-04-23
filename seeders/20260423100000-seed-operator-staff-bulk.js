"use strict";

const bcrypt = require("bcrypt");

const STAFF_COUNT = 60;
const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = "staff123";
const USERNAME_PREFIX = "operator_staff_bulk_";
const EMAIL_PREFIX = "operator.staff.bulk.";
const EMAIL_DOMAIN = "example.com";

function buildPaddedNumber(value) {
  return String(value).padStart(3, "0");
}

function buildUser(index) {
  const suffix = buildPaddedNumber(index);
  return {
    name: `Operator Staff ${suffix}`,
    username: `${USERNAME_PREFIX}${suffix}`,
    email: `${EMAIL_PREFIX}${suffix}@${EMAIL_DOMAIN}`,
  };
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;
    const now = new Date();

    const role = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE name = 'operator_staff' LIMIT 1`,
      { type: QueryTypes.SELECT },
    );

    const operatorStaffRoleId = Number(role[0]?.id || 0);
    if (!operatorStaffRoleId) {
      throw new Error(
        "Missing RBAC role 'operator_staff'. Run RBAC role seeders first.",
      );
    }

    const operatorSeedUser = await queryInterface.sequelize.query(
      `SELECT company_id FROM users WHERE username = 'operator_seed' LIMIT 1`,
      { type: QueryTypes.SELECT },
    );

    const companyId = Number(operatorSeedUser[0]?.company_id || 0) || null;
    if (!companyId) {
      throw new Error(
        "Missing company_id for 'operator_seed'. Seed operator user with company_id first.",
      );
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    for (let i = 1; i <= STAFF_COUNT; i += 1) {
      const staff = buildUser(i);

      const existing = await queryInterface.sequelize.query(
        `SELECT id FROM users WHERE username = :username OR email = :email LIMIT 1`,
        {
          type: QueryTypes.SELECT,
          replacements: {
            username: staff.username,
            email: staff.email,
          },
        },
      );

      if (!existing.length) {
        await queryInterface.sequelize.query(
          `INSERT INTO users (
            name,
            username,
            email,
            password,
            confirm_password,
            association_id,
            role_id,
            company_id,
            created_at,
            updated_at
          ) VALUES (
            :name,
            :username,
            :email,
            :password,
            :confirm_password,
            :association_id,
            :role_id,
            :company_id,
            :created_at,
            :updated_at
          )`,
          {
            replacements: {
              name: staff.name,
              username: staff.username,
              email: staff.email,
              password: passwordHash,
              confirm_password: passwordHash,
              association_id: null,
              role_id: operatorStaffRoleId,
              company_id: companyId,
              created_at: now,
              updated_at: now,
            },
          },
        );
      }

      // Keep seeded rows deterministic across reruns.
      await queryInterface.sequelize.query(
        `UPDATE users
         SET name = :name,
             role_id = :role_id,
             company_id = :company_id,
             password = :password,
             confirm_password = :confirm_password,
             updated_at = :updated_at
         WHERE username = :username OR email = :email`,
        {
          replacements: {
            name: staff.name,
            role_id: operatorStaffRoleId,
            company_id: companyId,
            password: passwordHash,
            confirm_password: passwordHash,
            updated_at: now,
            username: staff.username,
            email: staff.email,
          },
        },
      );
    }
  },

  async down(queryInterface) {
    const usernames = [];
    const emails = [];

    for (let i = 1; i <= STAFF_COUNT; i += 1) {
      const suffix = buildPaddedNumber(i);
      usernames.push(`${USERNAME_PREFIX}${suffix}`);
      emails.push(`${EMAIL_PREFIX}${suffix}@${EMAIL_DOMAIN}`);
    }

    await queryInterface.sequelize.query(
      `DELETE FROM users WHERE username IN (:usernames) OR email IN (:emails)`,
      {
        replacements: { usernames, emails },
      },
    );
  },
};
