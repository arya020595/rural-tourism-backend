"use strict";

function normalizeInt(value) {
  if (value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value) {
  if (value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

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
        console.log(
          "[seed-users-company-sql] rt_users table not found. Nothing to migrate.",
        );
        await transaction.commit();
        return;
      }

      const hasUsers = await tableExists("users");
      const hasCompany = await tableExists("company");
      if (!hasUsers || !hasCompany) {
        throw new Error("Required target tables users/company are missing.");
      }

      const sourceRows = await queryInterface.sequelize.query(
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

      let processedRows = 0;
      let insertedCompanies = 0;
      let insertedUsers = 0;
      let skippedExistingUsers = 0;
      let skippedInvalidRows = 0;

      if (!sourceRows.length) {
        console.log(
          "[seed-users-company-sql] No rt_users rows found. Nothing to migrate.",
        );
        await transaction.commit();
        return;
      }

      const roleIds = (await tableExists("roles"))
        ? await queryInterface.sequelize.query("SELECT id FROM roles", {
            type: SELECT,
            transaction,
          })
        : [];
      const validRoleIds = new Set(roleIds.map((r) => Number(r.id)));

      const associationIds = (await tableExists("associations"))
        ? await queryInterface.sequelize.query("SELECT id FROM associations", {
            type: SELECT,
            transaction,
          })
        : [];
      const validAssociationIds = new Set(
        associationIds.map((a) => Number(a.id)),
      );

      for (const source of sourceRows) {
        processedRows += 1;
        const username = normalizeText(source.username);
        const email = normalizeText(source.email_address);

        if (!username || !email) {
          skippedInvalidRows += 1;
          continue;
        }

        const existingUser = await queryInterface.sequelize.query(
          `SELECT id
           FROM users
           WHERE username = :username OR email = :email
           LIMIT 1`,
          {
            type: SELECT,
            replacements: { username, email },
            transaction,
          },
        );

        if (existingUser.length > 0) {
          skippedExistingUsers += 1;
          continue;
        }

        const companyName =
          normalizeText(source.business_name) ||
          normalizeText(source.owner_full_name) ||
          username;

        const createdAt = normalizeText(source.created_at) || new Date();
        const updatedAt = normalizeText(source.updated_at) || new Date();

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
              address: normalizeText(source.business_address),
              email,
              location: normalizeText(source.location),
              postcode: normalizeText(source.poscode),
              total_fulltime_staff: normalizeInt(source.no_of_full_time_staff),
              total_partime_staff: normalizeInt(source.no_of_part_time_staff),
              contact_no: normalizeText(source.contact_no),
              operator_logo_image: normalizeText(source.operator_logo_image),
              motac_license_file: normalizeText(source.motac_license_file),
              trading_operation_license: normalizeText(
                source.trading_operation_license,
              ),
              homestay_certificate: normalizeText(source.homestay_certificate),
              created_at: createdAt,
              updated_at: updatedAt,
            },
            transaction,
          },
        );
        insertedCompanies += 1;

        const insertedCompany = await queryInterface.sequelize.query(
          `SELECT id
           FROM company
           WHERE email = :email AND company_name = :company_name
           ORDER BY id DESC
           LIMIT 1`,
          {
            type: SELECT,
            replacements: {
              email,
              company_name: companyName,
            },
            transaction,
          },
        );

        const companyId = Number(insertedCompany[0]?.id || 0);
        if (!companyId) {
          throw new Error(
            `Failed to determine inserted company_id for username=${username}`,
          );
        }

        const associationIdRaw = normalizeInt(source.association_id);
        const associationId =
          associationIdRaw && validAssociationIds.has(associationIdRaw)
            ? associationIdRaw
            : null;

        const roleIdRaw = normalizeInt(source.role_id);
        const roleId =
          roleIdRaw && validRoleIds.has(roleIdRaw) ? roleIdRaw : null;

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
              name: normalizeText(source.owner_full_name) || username,
              username,
              email,
              password: normalizeText(source.password),
              confirm_password:
                normalizeText(source.confirmed_password) ||
                normalizeText(source.password),
              association_id: associationId,
              role_id: roleId,
              company_id: companyId,
              created_at: createdAt,
              updated_at: updatedAt,
            },
            transaction,
          },
        );
        insertedUsers += 1;
      }

      console.log(
        `[seed-users-company-sql] up summary: parsed=${sourceRows.length}, processed=${processedRows}, inserted_companies=${insertedCompanies}, inserted_users=${insertedUsers}, skipped_existing_users=${skippedExistingUsers}, skipped_invalid_rows=${skippedInvalidRows}`,
      );

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
        console.log(
          "[seed-users-company-sql] down summary: rt_users table not found. Nothing to rollback.",
        );
        await transaction.commit();
        return;
      }

      let deletedUsers = 0;
      let deletedCompanies = 0;

      const usersToDelete = await queryInterface.sequelize.query(
        `SELECT DISTINCT u.id, u.company_id
         FROM users u
         INNER JOIN rt_users ru
           ON u.username = ru.username
          AND u.email = ru.email_address`,
        {
          type: SELECT,
          transaction,
        },
      );

      if (!usersToDelete.length) {
        console.log(
          "[seed-users-company-sql] down summary: no matching users found to delete.",
        );
        await transaction.commit();
        return;
      }

      const userIds = usersToDelete.map((u) => Number(u.id));
      const companyIds = [
        ...new Set(
          usersToDelete.map((u) => Number(u.company_id)).filter(Boolean),
        ),
      ];

      await queryInterface.sequelize.query(
        "DELETE FROM users WHERE id IN (:userIds)",
        {
          replacements: { userIds },
          transaction,
        },
      );
      deletedUsers = userIds.length;

      if (companyIds.length > 0) {
        const deleteCompanyResult = await queryInterface.sequelize.query(
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

        if (
          Array.isArray(deleteCompanyResult) &&
          deleteCompanyResult.length > 1
        ) {
          deletedCompanies = Number(deleteCompanyResult[1]?.affectedRows || 0);
        }
      }

      console.log(
        `[seed-users-company-sql] down summary: deleted_users=${deletedUsers}, deleted_companies=${deletedCompanies}`,
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
