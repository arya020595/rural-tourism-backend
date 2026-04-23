"use strict";

const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

const DEFAULT_USERS = [
  {
    name: "Superadmin User",
    username: "superadmin_seed",
    email: "superadmin.seed@example.com",
    password: "superadmin123",
    roleName: "superadmin",
  },
  {
    name: "Operator User",
    username: "operator_seed",
    email: "operator.seed@example.com",
    password: "operator123",
    roleName: "operator_admin",
  },
  {
    name: "Operator Staff User",
    username: "operator_staff_seed",
    email: "operator.staff.seed@example.com",
    password: "staff123",
    roleName: "operator_staff",
  },
  {
    name: "Tourist User",
    username: "tourist_seed",
    email: "tourist.seed@example.com",
    password: "tourist123",
    roleName: "tourist",
  },
  {
    name: "Association User",
    username: "association_seed",
    email: "association.seed@example.com",
    password: "association123",
    roleName: "association",
    resolveAssociationId: true,
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;
    const now = new Date();

    const roles = await queryInterface.sequelize.query(
      `SELECT id, name FROM roles`,
      { type: QueryTypes.SELECT },
    );

    const roleMap = {};
    for (const role of roles) {
      roleMap[role.name] = Number(role.id);
    }

    // Resolve the first available association id for association users
    const associations = await queryInterface.sequelize.query(
      `SELECT id FROM associations WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 1`,
      { type: QueryTypes.SELECT },
    );
    const defaultAssociationId = associations[0]
      ? Number(associations[0].id)
      : null;

    for (const userData of DEFAULT_USERS) {
      const roleId = roleMap[userData.roleName];
      if (!roleId) {
        console.warn(
          `Skipping user '${userData.username}': role '${userData.roleName}' not found. Run RBAC role seeders first.`,
        );
        continue;
      }

      const passwordHash = await bcrypt.hash(userData.password, SALT_ROUNDS);
      const associationId = userData.resolveAssociationId
        ? defaultAssociationId
        : null;

      const existing = await queryInterface.sequelize.query(
        `SELECT id FROM users WHERE username = :username OR email = :email LIMIT 1`,
        {
          type: QueryTypes.SELECT,
          replacements: {
            username: userData.username,
            email: userData.email,
          },
        },
      );

      if (!existing.length) {
        await queryInterface.sequelize.query(
          `INSERT INTO users (
            name, username, email, password, confirm_password,
            association_id, role_id, company_id, created_at, updated_at
          ) VALUES (
            :name, :username, :email, :password, :confirm_password,
            :association_id, :role_id, :company_id, :created_at, :updated_at
          )`,
          {
            replacements: {
              name: userData.name,
              username: userData.username,
              email: userData.email,
              password: passwordHash,
              confirm_password: passwordHash,
              association_id: associationId,
              role_id: roleId,
              company_id: null,
              created_at: now,
              updated_at: now,
            },
          },
        );
      }

      await queryInterface.sequelize.query(
        `UPDATE users
         SET name = :name,
             role_id = :role_id,
             association_id = COALESCE(:association_id, association_id),
             password = :password,
             confirm_password = :confirm_password,
             updated_at = :updated_at
         WHERE username = :username OR email = :email`,
        {
          replacements: {
            name: userData.name,
            role_id: roleId,
            association_id: associationId,
            password: passwordHash,
            confirm_password: passwordHash,
            updated_at: now,
            username: userData.username,
            email: userData.email,
          },
        },
      );
    }
  },

  async down(queryInterface) {
    const usernames = DEFAULT_USERS.map((u) => u.username);
    const emails = DEFAULT_USERS.map((u) => u.email);

    await queryInterface.sequelize.query(
      `DELETE FROM users WHERE username IN (:usernames) OR email IN (:emails)`,
      {
        replacements: { usernames, emails },
      },
    );
  },
};
