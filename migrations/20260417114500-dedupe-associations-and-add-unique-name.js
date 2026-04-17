"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [duplicateGroups] = await queryInterface.sequelize.query(
        `
        SELECT LOWER(TRIM(name)) AS normalized_name
        FROM associations
        WHERE deleted_at IS NULL
        GROUP BY LOWER(TRIM(name))
        HAVING COUNT(*) > 1
        `,
        { transaction },
      );

      if (duplicateGroups.length > 0) {
        const [associationTables] = await queryInterface.sequelize.query(
          `
          SELECT DISTINCT TABLE_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND COLUMN_NAME = 'association_id'
          `,
          { transaction },
        );

        for (const group of duplicateGroups) {
          const normalizedName = group.normalized_name;

          const [rowsForName] = await queryInterface.sequelize.query(
            `
            SELECT id
            FROM associations
            WHERE deleted_at IS NULL
              AND LOWER(TRIM(name)) = :normalizedName
            ORDER BY id ASC
            `,
            {
              replacements: { normalizedName },
              transaction,
            },
          );

          if (rowsForName.length <= 1) {
            continue;
          }

          const keepId = rowsForName[0].id;
          const duplicateIds = rowsForName.slice(1).map((row) => row.id);

          for (const tableRow of associationTables) {
            const tableName = tableRow.TABLE_NAME;

            await queryInterface.sequelize.query(
              `
              UPDATE \`${tableName}\`
              SET association_id = :keepId
              WHERE association_id IN (:duplicateIds)
              `,
              {
                replacements: {
                  keepId,
                  duplicateIds,
                },
                transaction,
              },
            );
          }

          await queryInterface.bulkDelete(
            "associations",
            { id: duplicateIds },
            { transaction },
          );
        }
      }

      const [existingIndexes] = await queryInterface.sequelize.query(
        `
        SELECT INDEX_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'associations'
          AND INDEX_NAME = 'associations_name_unique'
        `,
        { transaction },
      );

      if (existingIndexes.length === 0) {
        await queryInterface.addIndex("associations", ["name"], {
          name: "associations_name_unique",
          unique: true,
          transaction,
        });
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [existingIndexes] = await queryInterface.sequelize.query(
        `
        SELECT INDEX_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'associations'
          AND INDEX_NAME = 'associations_name_unique'
        `,
        { transaction },
      );

      if (existingIndexes.length > 0) {
        await queryInterface.removeIndex(
          "associations",
          "associations_name_unique",
          { transaction },
        );
      }
    });
  },
};