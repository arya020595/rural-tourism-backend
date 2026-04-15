"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;

    const getForeignKeysForColumn = async (tableName, columnName) => {
      return queryInterface.sequelize.query(
        `
        SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = :tableName
          AND COLUMN_NAME = :columnName
          AND REFERENCED_TABLE_NAME IS NOT NULL
        `,
        {
          replacements: { tableName, columnName },
          type: QueryTypes.SELECT,
        },
      );
    };

    const dropConstraints = async (tableName, constraints) => {
      for (const constraint of constraints) {
        await queryInterface.removeConstraint(tableName, constraint.CONSTRAINT_NAME);
      }
    };

    const ensureForeignKey = async ({
      tableName,
      columnName,
      targetTable,
      targetColumn,
      constraintName,
      onUpdate = "CASCADE",
      onDelete = "CASCADE",
    }) => {
      const existing = await getForeignKeysForColumn(tableName, columnName);

      const hasDesired = existing.some(
        (fk) =>
          fk.REFERENCED_TABLE_NAME === targetTable &&
          fk.REFERENCED_COLUMN_NAME === targetColumn,
      );

      const mismatched = existing.filter(
        (fk) =>
          !(
            fk.REFERENCED_TABLE_NAME === targetTable &&
            fk.REFERENCED_COLUMN_NAME === targetColumn
          ),
      );

      if (mismatched.length > 0) {
        await dropConstraints(tableName, mismatched);
      }

      if (!hasDesired) {
        await queryInterface.addConstraint(tableName, {
          fields: [columnName],
          type: "foreign key",
          name: constraintName,
          references: {
            table: targetTable,
            field: targetColumn,
          },
          onUpdate,
          onDelete,
        });
      }
    };

    await ensureForeignKey({
      tableName: "activity_booking",
      columnName: "tourist_user_id",
      targetTable: "tourist_users",
      targetColumn: "tourist_user_id",
      constraintName: "activity_booking_tourist_user_fk",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await ensureForeignKey({
      tableName: "activity_booking",
      columnName: "activity_id",
      targetTable: "activity_master_table",
      targetColumn: "id",
      constraintName: "activity_booking_activity_fk",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await ensureForeignKey({
      tableName: "accommodation_booking",
      columnName: "tourist_user_id",
      targetTable: "tourist_users",
      targetColumn: "tourist_user_id",
      constraintName: "accommodation_booking_tourist_user_fk",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },

  async down(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;

    const getForeignKeysForColumn = async (tableName, columnName) => {
      return queryInterface.sequelize.query(
        `
        SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = :tableName
          AND COLUMN_NAME = :columnName
          AND REFERENCED_TABLE_NAME IS NOT NULL
        `,
        {
          replacements: { tableName, columnName },
          type: QueryTypes.SELECT,
        },
      );
    };

    const dropMatchingForeignKeys = async (
      tableName,
      columnName,
      targetTable,
      targetColumn,
    ) => {
      const existing = await getForeignKeysForColumn(tableName, columnName);
      const matching = existing.filter(
        (fk) =>
          fk.REFERENCED_TABLE_NAME === targetTable &&
          fk.REFERENCED_COLUMN_NAME === targetColumn,
      );

      for (const fk of matching) {
        await queryInterface.removeConstraint(tableName, fk.CONSTRAINT_NAME);
      }
    };

    await dropMatchingForeignKeys(
      "accommodation_booking",
      "tourist_user_id",
      "tourist_users",
      "tourist_user_id",
    );

    await dropMatchingForeignKeys(
      "activity_booking",
      "activity_id",
      "activity_master_table",
      "id",
    );

    await dropMatchingForeignKeys(
      "activity_booking",
      "tourist_user_id",
      "tourist_users",
      "tourist_user_id",
    );

    const existingActivityTouristFks = await getForeignKeysForColumn(
      "activity_booking",
      "tourist_user_id",
    );

    const hasLegacyFk = existingActivityTouristFks.some(
      (fk) =>
        fk.REFERENCED_TABLE_NAME === "rt_users" &&
        fk.REFERENCED_COLUMN_NAME === "user_id",
    );

    if (!hasLegacyFk) {
      const orphanCheck = await queryInterface.sequelize.query(
        `
        SELECT COUNT(*) AS orphan_count
        FROM activity_booking ab
        LEFT JOIN rt_users ru ON ru.user_id = ab.tourist_user_id
        WHERE ru.user_id IS NULL
        `,
        { type: QueryTypes.SELECT },
      );

      const orphanCount = Number(orphanCheck[0]?.orphan_count || 0);

      if (orphanCount === 0) {
        await queryInterface.addConstraint("activity_booking", {
          fields: ["tourist_user_id"],
          type: "foreign key",
          name: "activity_booking_tourist_user_legacy_fk",
          references: {
            table: "rt_users",
            field: "user_id",
          },
          onUpdate: "CASCADE",
        });
      }
    }
  },
};
