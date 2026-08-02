"use strict";

async function tableExists(queryInterface, tableName, transaction) {
  const tables = await queryInterface.showAllTables({ transaction });

  return tables.some((table) => {
    if (typeof table === "string") {
      return table === tableName;
    }

    if (table && typeof table === "object") {
      return table.tableName === tableName || table.table_name === tableName;
    }

    return false;
  });
}

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const hasCompany = await tableExists(
        queryInterface,
        "company",
        transaction,
      );
      let hasCompanies = await tableExists(
        queryInterface,
        "companies",
        transaction,
      );

      // If plural table is missing but legacy singular exists, normalize to plural.
      if (!hasCompanies && hasCompany) {
        await queryInterface.renameTable("company", "companies", {
          transaction,
        });
        hasCompanies = true;
      }

      // If both tables exist, copy any missing IDs from legacy singular into plural.
      if (hasCompany && hasCompanies) {
        await queryInterface.sequelize.query(
          `INSERT INTO companies (
            id,
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
          )
          SELECT
            c.id,
            c.company_name,
            c.address,
            c.email,
            c.location,
            c.postcode,
            c.total_fulltime_staff,
            c.total_partime_staff,
            c.contact_no,
            c.operator_logo_image,
            c.motac_license_file,
            c.trading_operation_license,
            c.homestay_certificate,
            c.created_at,
            c.updated_at
          FROM company c
          LEFT JOIN companies cc ON cc.id = c.id
          WHERE cc.id IS NULL`,
          { transaction },
        );

        const [rows] = await queryInterface.sequelize.query(
          "SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM companies",
          { transaction },
        );

        const nextId = Number(rows?.[0]?.next_id || 1);
        await queryInterface.sequelize.query(
          "ALTER TABLE companies AUTO_INCREMENT = :nextId",
          {
            replacements: { nextId },
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

  async down() {
    // Irreversible data sync. Keep as no-op.
  },
};
