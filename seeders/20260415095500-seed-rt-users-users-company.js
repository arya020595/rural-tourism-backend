"use strict";

const seedRows = require("./data/rt-users-seed-data");

function normalizeInt(value) {
  if (value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveCompanyName(source) {
  return (
    normalizeText(source.business_name) ||
    normalizeText(source.owner_full_name) ||
    normalizeText(source.username)
  );
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

      const hasUsers = await tableExists("users");
      const hasCompany = await tableExists("company");
      if (!hasUsers || !hasCompany) {
        throw new Error("Required target tables users/company are missing.");
      }

      const hasRoles = await tableExists("roles");
      if (!hasRoles) {
        throw new Error(
          "Required roles table is missing. Run RBAC role seeders before this seeder.",
        );
      }

      const operatorRoleRows = await queryInterface.sequelize.query(
        `SELECT id
         FROM roles
         WHERE LOWER(name) = 'operator_admin'
         ORDER BY id ASC
         LIMIT 1`,
        {
          type: SELECT,
          transaction,
        },
      );
      const operatorRoleId = Number(operatorRoleRows[0]?.id || 0);
      if (!operatorRoleId) {
        throw new Error(
          "Operator role not found in roles table. Run RBAC role seeder first.",
        );
      }

      const associationIds = (await tableExists("associations"))
        ? await queryInterface.sequelize.query("SELECT id FROM associations", {
            type: SELECT,
            transaction,
          })
        : [];
      const validAssociationIds = new Set(
        associationIds.map((association) => Number(association.id)),
      );

      let insertedCompanies = 0;
      let insertedUsers = 0;
      let updatedCompanies = 0;
      let updatedUsers = 0;
      let skippedInvalidRows = 0;

      for (const source of seedRows) {
        const username = normalizeText(source.username);
        const email = normalizeText(source.email_address);

        if (!username || !email) {
          skippedInvalidRows += 1;
          continue;
        }

        const companyName = resolveCompanyName(source);
        if (!companyName) {
          skippedInvalidRows += 1;
          continue;
        }

        const createdAt = normalizeText(source.created_at) || new Date();
        const updatedAt = normalizeText(source.updated_at) || new Date();

        const companyLookup = await queryInterface.sequelize.query(
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

        let companyId = Number(companyLookup[0]?.id || 0);

        if (!companyId) {
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
                total_fulltime_staff: normalizeInt(
                  source.no_of_full_time_staff,
                ),
                total_partime_staff: normalizeInt(source.no_of_part_time_staff),
                contact_no: normalizeText(source.contact_no),
                operator_logo_image: source.operator_logo_image,
                motac_license_file: source.motac_license_file,
                trading_operation_license: source.trading_operation_license,
                homestay_certificate: source.homestay_certificate,
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

          companyId = Number(insertedCompany[0]?.id || 0);
        } else {
          await queryInterface.sequelize.query(
            `UPDATE company
             SET address = :address,
                 location = :location,
                 postcode = :postcode,
                 total_fulltime_staff = :total_fulltime_staff,
                 total_partime_staff = :total_partime_staff,
                 contact_no = :contact_no,
                 operator_logo_image = :operator_logo_image,
                 motac_license_file = :motac_license_file,
                 trading_operation_license = :trading_operation_license,
                 homestay_certificate = :homestay_certificate,
                 updated_at = :updated_at
             WHERE id = :company_id`,
            {
              replacements: {
                company_id: companyId,
                address: normalizeText(source.business_address),
                location: normalizeText(source.location),
                postcode: normalizeText(source.poscode),
                total_fulltime_staff: normalizeInt(
                  source.no_of_full_time_staff,
                ),
                total_partime_staff: normalizeInt(source.no_of_part_time_staff),
                contact_no: normalizeText(source.contact_no),
                operator_logo_image: source.operator_logo_image,
                motac_license_file: source.motac_license_file,
                trading_operation_license: source.trading_operation_license,
                homestay_certificate: source.homestay_certificate,
                updated_at: updatedAt,
              },
              transaction,
            },
          );
          updatedCompanies += 1;
        }

        if (!companyId) {
          throw new Error(
            `Failed to determine company_id for username=${username}`,
          );
        }

        const associationIdRaw = normalizeInt(source.association_id);
        const associationId =
          associationIdRaw && validAssociationIds.has(associationIdRaw)
            ? associationIdRaw
            : null;

        const roleId = operatorRoleId;

        const userLookup = await queryInterface.sequelize.query(
          `SELECT id
           FROM users
           WHERE username = :username OR email = :email
           ORDER BY id DESC
           LIMIT 1`,
          {
            type: SELECT,
            replacements: { username, email },
            transaction,
          },
        );

        if (userLookup.length === 0) {
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
          continue;
        }

        await queryInterface.sequelize.query(
          `UPDATE users
           SET name = :name,
               password = :password,
               confirm_password = :confirm_password,
               association_id = :association_id,
               role_id = :role_id,
               company_id = :company_id,
               updated_at = :updated_at
           WHERE username = :username OR email = :email`,
          {
            replacements: {
              name: normalizeText(source.owner_full_name) || username,
              password: normalizeText(source.password),
              confirm_password:
                normalizeText(source.confirmed_password) ||
                normalizeText(source.password),
              association_id: associationId,
              role_id: roleId,
              company_id: companyId,
              updated_at: updatedAt,
              username,
              email,
            },
            transaction,
          },
        );
        updatedUsers += 1;
      }

      console.log(
        `[seed-rt-users-company] up summary: source_rows=${seedRows.length}, operator_role_id=${operatorRoleId}, inserted_companies=${insertedCompanies}, inserted_users=${insertedUsers}, updated_companies=${updatedCompanies}, updated_users=${updatedUsers}, skipped_invalid_rows=${skippedInvalidRows}`,
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

      const usernames = [
        ...new Set(
          seedRows.map((row) => normalizeText(row.username)).filter(Boolean),
        ),
      ];
      const emails = [
        ...new Set(
          seedRows
            .map((row) => normalizeText(row.email_address))
            .filter(Boolean),
        ),
      ];

      if (!usernames.length || !emails.length) {
        await transaction.commit();
        return;
      }

      const usersToDelete = await queryInterface.sequelize.query(
        `SELECT id, company_id
         FROM users
         WHERE username IN (:usernames)
            OR email IN (:emails)`,
        {
          type: SELECT,
          replacements: { usernames, emails },
          transaction,
        },
      );

      if (!usersToDelete.length) {
        await transaction.commit();
        return;
      }

      const userIds = usersToDelete.map((row) => Number(row.id));
      const companyIds = [
        ...new Set(
          usersToDelete.map((row) => Number(row.company_id)).filter(Boolean),
        ),
      ];

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
