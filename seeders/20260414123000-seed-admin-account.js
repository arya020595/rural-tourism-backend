"use strict";

const bcrypt = require("bcrypt");

const ADMIN_USER = {
  name: "Seeded Admin",
  username: "admin_seed",
  email: "admin.seed@example.com",
  password: "admin123",
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;
    const now = new Date();
    const passwordHash = await bcrypt.hash(ADMIN_USER.password, 10);

    const roles = await queryInterface.sequelize.query(
      `SELECT id, name FROM roles WHERE name = 'admin'`,
      { type: QueryTypes.SELECT },
    );

    const adminRoleId = Number(roles[0]?.id || 0);
    if (!adminRoleId) {
      throw new Error(
        "Missing RBAC role 'admin'. Run RBAC role seeders first.",
      );
    }

    const existingAdmin = await queryInterface.sequelize.query(
      `SELECT id
       FROM users
       WHERE username = :username OR email = :email
       ORDER BY id DESC
       LIMIT 1`,
      {
        type: QueryTypes.SELECT,
        replacements: {
          username: ADMIN_USER.username,
          email: ADMIN_USER.email,
        },
      },
    );

    if (!existingAdmin.length) {
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
            name: ADMIN_USER.name,
            username: ADMIN_USER.username,
            email: ADMIN_USER.email,
            password: passwordHash,
            confirm_password: passwordHash,
            association_id: null,
            role_id: adminRoleId,
            company_id: null,
            created_at: now,
            updated_at: now,
          },
        },
      );
    }

    // Keep role and credentials deterministic across reruns in non-production environments.
    await queryInterface.sequelize.query(
      `UPDATE users
       SET name = :name,
           role_id = :role_id,
           password = :password,
           confirm_password = :confirm_password,
           updated_at = :updated_at
       WHERE username = :username OR email = :email`,
      {
        replacements: {
          name: ADMIN_USER.name,
          role_id: adminRoleId,
          password: passwordHash,
          confirm_password: passwordHash,
          updated_at: now,
          username: ADMIN_USER.username,
          email: ADMIN_USER.email,
        },
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM users
       WHERE username = :username OR email = :email`,
      {
        replacements: {
          username: ADMIN_USER.username,
          email: ADMIN_USER.email,
        },
      },
    );
  },
};
