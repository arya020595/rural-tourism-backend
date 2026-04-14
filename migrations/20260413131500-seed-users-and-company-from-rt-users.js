"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const SELECT = queryInterface.sequelize.QueryTypes.SELECT;

      const tableExists = async (tableName) => {
        const rows = await queryInterface.sequelize.query(
          "SHOW TABLES LIKE :tableName",
          {
            type: SELECT,
            replacements: { tableName },
            transaction,
          },
        );
        return rows.length > 0;
      };

      const hasRtUsers = await tableExists("rt_users");
      if (!hasRtUsers) {
        await transaction.commit();
        return;
      }

      const hasUsers = await tableExists("users");
      const hasCompany = await tableExists("company");
      if (!hasUsers || !hasCompany) {
        throw new Error("Required target tables users/company are missing.");
      }

      const rtUsers = await queryInterface.sequelize.query(
        `SELECT
          user_id,
          username,
          email_address,
          password,
          confirmed_password,
          owner_full_name,
          business_name,
          business_address,
          location,
          poscode,
          contact_no,
          no_of_full_time_staff,
          no_of_part_time_staff,
          operator_logo_image,
          motac_license_file,
          trading_operation_license,
          homestay_certificate,
          association_id,
          role_id,
          created_at,
          updated_at
        FROM rt_users
        ORDER BY user_id ASC`,
        {
          type: SELECT,
          transaction,
        },
      );

      if (!rtUsers.length) {
        await transaction.commit();
        return;
      }

      const validRoleIds = new Set();
      if (await tableExists("roles")) {
        const roles = await queryInterface.sequelize.query("SELECT id FROM roles", {
          type: SELECT,
          transaction,
        });
        roles.forEach((row) => validRoleIds.add(Number(row.id)));
      }

      const validAssociationIds = new Set();
      if (await tableExists("associations")) {
        const associations = await queryInterface.sequelize.query(
          "SELECT id FROM associations",
          {
            type: SELECT,
            transaction,
          },
        );
        associations.forEach((row) => validAssociationIds.add(Number(row.id)));
      }

      for (const source of rtUsers) {
        const existingUser = await queryInterface.sequelize.query(
          `SELECT id
           FROM users
           WHERE username = :username OR email = :email
           LIMIT 1`,
          {
            type: SELECT,
            replacements: {
              username: source.username,
              email: source.email_address,
            },
            transaction,
          },
        );

        if (existingUser.length > 0) {
          continue;
        }

        const companyName =
          (source.business_name && source.business_name.trim()) ||
          (source.owner_full_name && source.owner_full_name.trim()) ||
          source.username;

        const associationId =
          source.association_id && validAssociationIds.has(Number(source.association_id))
            ? Number(source.association_id)
            : null;

        const roleId =
          source.role_id && validRoleIds.has(Number(source.role_id))
            ? Number(source.role_id)
            : null;

        await queryInterface.sequelize.query(
          `INSERT INTO company (
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
              company_name: companyName,
              address: source.business_address,
              email: source.email_address,
              location: source.location,
              postcode: source.poscode,
              total_fulltime_staff: source.no_of_full_time_staff,
              total_partime_staff: source.no_of_part_time_staff,
              contact_no: source.contact_no,
              operator_logo_image: source.operator_logo_image,
              motac_license_file: source.motac_license_file,
              trading_operation_license: source.trading_operation_license,
              homestay_certificate: source.homestay_certificate,
              created_at: source.created_at,
              updated_at: source.updated_at,
            },
            transaction,
          },
        );

        const insertedCompany = await queryInterface.sequelize.query(
          `SELECT id
           FROM company
           WHERE email = :email
             AND company_name = :company_name
           ORDER BY id DESC
           LIMIT 1`,
          {
            type: SELECT,
            replacements: {
              email: source.email_address,
              company_name: companyName,
            },
            transaction,
          },
        );

        const companyId = Number(insertedCompany[0]?.id || 0);

        if (!companyId) {
          throw new Error(
            `Failed to determine company_id for rt_users.user_id=${source.user_id}`,
          );
        }

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
              name: source.owner_full_name,
              username: source.username,
              email: source.email_address,
              password: source.password,
              confirm_password: source.confirmed_password,
              association_id: associationId,
              role_id: roleId,
              company_id: companyId,
              created_at: source.created_at,
              updated_at: source.updated_at,
            },
            transaction,
          },
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const SELECT = queryInterface.sequelize.QueryTypes.SELECT;

      const rows = await queryInterface.sequelize.query(
        `SELECT u.id, u.company_id
         FROM users u
         INNER JOIN rt_users ru
           ON u.username = ru.username
          AND u.email = ru.email_address`,
        {
          type: SELECT,
          transaction,
        },
      );

      if (!rows.length) {
        await transaction.commit();
        return;
      }

      const userIds = rows.map((row) => Number(row.id));
      const companyIds = [...new Set(rows.map((row) => Number(row.company_id)).filter(Boolean))];

      await queryInterface.sequelize.query(
        "DELETE FROM users WHERE id IN (:userIds)",
        {
          replacements: { userIds },
          transaction,
        },
      );

      if (companyIds.length > 0) {
        await queryInterface.sequelize.query(
          `DELETE c
           FROM company c
           LEFT JOIN users u ON u.company_id = c.id
           WHERE c.id IN (:companyIds)
             AND u.id IS NULL`,
          {
            replacements: { companyIds },
            transaction,
          },
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
