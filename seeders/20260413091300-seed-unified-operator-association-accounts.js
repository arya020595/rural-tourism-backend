"use strict";

const bcrypt = require("bcrypt");

const OPERATOR_USER = {
  name: "Seeded Operator",
  username: "operator_seed",
  email: "operator.seed@example.com",
  company: {
    company_name: "Seeded Operator Company",
    address: "Jalan Tun Fuad Stephens, Kota Kinabalu",
    email: "operator.company@example.com",
    location: "Kota Kinabalu",
    postcode: "88000",
    total_fulltime_staff: 8,
    total_partime_staff: 3,
    contact_no: "+601155500011",
    operator_logo_image: "default_logo.png",
  },
};

const ASSOCIATION_USER = {
  name: "Seeded Association",
  username: "association_seed",
  email: "association.seed@example.com",
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;
    const now = new Date();
    const passwordHash = await bcrypt.hash("password123", 10);

    const roles = await queryInterface.sequelize.query(
      `SELECT id, name FROM roles WHERE name IN ('operator_admin', 'association')`,
      { type: QueryTypes.SELECT },
    );

    const roleByName = new Map(
      roles.map((role) => [role.name, Number(role.id)]),
    );
    const operatorRoleId = roleByName.get("operator_admin");
    const associationRoleId = roleByName.get("association");

    if (!operatorRoleId || !associationRoleId) {
      throw new Error(
        "Missing RBAC roles for operator_admin/association. Run RBAC role seeders first.",
      );
    }

    const associations = await queryInterface.sequelize.query(
      `SELECT id FROM associations ORDER BY id ASC LIMIT 1`,
      { type: QueryTypes.SELECT },
    );

    const defaultAssociationId = Number(associations[0]?.id || 0);
    if (!defaultAssociationId) {
      throw new Error(
        "No association records found. Run seed-associations before this seeder.",
      );
    }

    const existingCompany = await queryInterface.sequelize.query(
      `SELECT id
       FROM companies
       WHERE email = :email AND company_name = :companyName
       ORDER BY id DESC
       LIMIT 1`,
      {
        type: QueryTypes.SELECT,
        replacements: {
          email: OPERATOR_USER.company.email,
          companyName: OPERATOR_USER.company.company_name,
        },
      },
    );

    let companyId = Number(existingCompany[0]?.id || 0);

    if (!companyId) {
      await queryInterface.sequelize.query(
        `INSERT INTO companies (
          company_name,
          address,
          email,
          location,
          postcode,
          total_fulltime_staff,
          total_partime_staff,
          contact_no,
          operator_logo_image,
          motac_license_file,
          trading_operation_license,
          homestay_certificate,
          created_at,
          updated_at
        ) VALUES (
          :company_name,
          :address,
          :email,
          :location,
          :postcode,
          :total_fulltime_staff,
          :total_partime_staff,
          :contact_no,
          :operator_logo_image,
          :motac_license_file,
          :trading_operation_license,
          :homestay_certificate,
          :created_at,
          :updated_at
        )`,
        {
          replacements: {
            ...OPERATOR_USER.company,
            motac_license_file: null,
            trading_operation_license: null,
            homestay_certificate: null,
            created_at: now,
            updated_at: now,
          },
        },
      );

      const insertedCompany = await queryInterface.sequelize.query(
        `SELECT id
         FROM companies
         WHERE email = :email AND company_name = :companyName
         ORDER BY id DESC
         LIMIT 1`,
        {
          type: QueryTypes.SELECT,
          replacements: {
            email: OPERATOR_USER.company.email,
            companyName: OPERATOR_USER.company.company_name,
          },
        },
      );

      companyId = Number(insertedCompany[0]?.id || 0);
    }

    if (!companyId) {
      throw new Error(
        "Unable to resolve company_id for seeded operator account.",
      );
    }

    const existingOperator = await queryInterface.sequelize.query(
      `SELECT id
       FROM users
       WHERE username = :username OR email = :email
       ORDER BY id DESC
       LIMIT 1`,
      {
        type: QueryTypes.SELECT,
        replacements: {
          username: OPERATOR_USER.username,
          email: OPERATOR_USER.email,
        },
      },
    );

    if (!existingOperator.length) {
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
            name: OPERATOR_USER.name,
            username: OPERATOR_USER.username,
            email: OPERATOR_USER.email,
            password: passwordHash,
            confirm_password: passwordHash,
            association_id: defaultAssociationId,
            role_id: operatorRoleId,
            company_id: companyId,
            created_at: now,
            updated_at: now,
          },
        },
      );
    }

    // Keep seeded operator relationship data consistent across reruns.
    await queryInterface.sequelize.query(
      `UPDATE users
       SET association_id = :association_id,
           role_id = :role_id,
           company_id = :company_id,
           updated_at = :updated_at
       WHERE username = :username OR email = :email`,
      {
        replacements: {
          association_id: defaultAssociationId,
          role_id: operatorRoleId,
          company_id: companyId,
          updated_at: now,
          username: OPERATOR_USER.username,
          email: OPERATOR_USER.email,
        },
      },
    );

    const existingAssociation = await queryInterface.sequelize.query(
      `SELECT id
       FROM users
       WHERE username = :username OR email = :email
       ORDER BY id DESC
       LIMIT 1`,
      {
        type: QueryTypes.SELECT,
        replacements: {
          username: ASSOCIATION_USER.username,
          email: ASSOCIATION_USER.email,
        },
      },
    );

    if (!existingAssociation.length) {
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
            name: ASSOCIATION_USER.name,
            username: ASSOCIATION_USER.username,
            email: ASSOCIATION_USER.email,
            password: passwordHash,
            confirm_password: passwordHash,
            association_id: defaultAssociationId,
            role_id: associationRoleId,
            company_id: null,
            created_at: now,
            updated_at: now,
          },
        },
      );
    }

    // Keep seeded association relationship data consistent across reruns.
    await queryInterface.sequelize.query(
      `UPDATE users
       SET association_id = :association_id,
           role_id = :role_id,
           company_id = :company_id,
           updated_at = :updated_at
       WHERE username = :username OR email = :email`,
      {
        replacements: {
          association_id: defaultAssociationId,
          role_id: associationRoleId,
          company_id: null,
          updated_at: now,
          username: ASSOCIATION_USER.username,
          email: ASSOCIATION_USER.email,
        },
      },
    );
  },

  async down(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;

    await queryInterface.sequelize.query(
      `DELETE FROM users
       WHERE username IN (:operatorUsername, :associationUsername)
          OR email IN (:operatorEmail, :associationEmail)`,
      {
        replacements: {
          operatorUsername: OPERATOR_USER.username,
          associationUsername: ASSOCIATION_USER.username,
          operatorEmail: OPERATOR_USER.email,
          associationEmail: ASSOCIATION_USER.email,
        },
      },
    );

    await queryInterface.sequelize.query(
      `DELETE c
       FROM companies c
       LEFT JOIN users u ON u.company_id = c.id
       WHERE c.email = :email
         AND c.company_name = :companyName
         AND u.id IS NULL`,
      {
        type: QueryTypes.DELETE,
        replacements: {
          email: OPERATOR_USER.company.email,
          companyName: OPERATOR_USER.company.company_name,
        },
      },
    );
  },
};
