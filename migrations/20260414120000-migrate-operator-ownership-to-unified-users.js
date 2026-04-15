"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
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

      const columnExists = async (tableName, columnName) => {
        if (!(await tableExists(tableName))) {
          return false;
        }

        const table = await queryInterface.describeTable(tableName, {
          transaction,
        });

        return !!table[columnName];
      };

      const indexExists = async (tableName, indexName) => {
        const rows = await queryInterface.sequelize.query(
          `SELECT INDEX_NAME
           FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = :tableName
             AND INDEX_NAME = :indexName
           LIMIT 1`,
          {
            type: SELECT,
            replacements: { tableName, indexName },
            transaction,
          },
        );
        return rows.length > 0;
      };

      const removeForeignKeys = async (tableName, columnName) => {
        const foreignKeys = await queryInterface.sequelize.query(
          `SELECT CONSTRAINT_NAME
           FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = :tableName
             AND COLUMN_NAME = :columnName
             AND REFERENCED_TABLE_NAME IS NOT NULL`,
          {
            type: SELECT,
            replacements: { tableName, columnName },
            transaction,
          },
        );

        for (const fk of foreignKeys) {
          await queryInterface.removeConstraint(tableName, fk.CONSTRAINT_NAME, {
            transaction,
          });
        }
      };

      const addConstraintIfMissing = async ({
        tableName,
        columnName,
        constraintName,
        referencedTable,
        referencedColumn,
        onDelete,
      }) => {
        const existing = await queryInterface.sequelize.query(
          `SELECT CONSTRAINT_NAME
           FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = :tableName
             AND CONSTRAINT_NAME = :constraintName
             AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
          {
            type: SELECT,
            replacements: { tableName, constraintName },
            transaction,
          },
        );

        if (existing.length > 0) {
          return;
        }

        await queryInterface.addConstraint(tableName, {
          fields: [columnName],
          type: "foreign key",
          name: constraintName,
          references: {
            table: referencedTable,
            field: referencedColumn,
          },
          onUpdate: "CASCADE",
          onDelete,
          transaction,
        });
      };

      const mapLegacyOperatorIdsToUnified = async (tableName, columnName) => {
        if (!(await tableExists("users"))) {
          return;
        }

        if (!(await tableExists("rt_users"))) {
          return;
        }

        await queryInterface.sequelize.query(
          `UPDATE ${tableName} target
           LEFT JOIN rt_users legacy_user
             ON legacy_user.user_id = target.${columnName}
           LEFT JOIN users unified_user
             ON unified_user.username = legacy_user.username
            AND unified_user.email = legacy_user.email_address
           SET target.${columnName} = COALESCE(unified_user.id, target.${columnName})`,
          { transaction },
        );
      };

      const mapUnifiedOperatorIdsToLegacy = async (tableName, columnName) => {
        if (!(await tableExists("users"))) {
          return;
        }

        if (!(await tableExists("rt_users"))) {
          return;
        }

        await queryInterface.sequelize.query(
          `UPDATE ${tableName} target
           LEFT JOIN users unified_user
             ON unified_user.id = target.${columnName}
           LEFT JOIN rt_users legacy_user
             ON legacy_user.username = unified_user.username
            AND legacy_user.email_address = unified_user.email
           SET target.${columnName} = COALESCE(legacy_user.user_id, target.${columnName})`,
          { transaction },
        );
      };

      const assertColumnReferencesUsers = async (tableName, columnName) => {
        if (!(await tableExists(tableName)) || !(await tableExists("users"))) {
          return;
        }

        const invalidRows = await queryInterface.sequelize.query(
          `SELECT target.${columnName} AS invalid_user_id
           FROM ${tableName} target
           LEFT JOIN users unified_user
             ON unified_user.id = target.${columnName}
           WHERE target.${columnName} IS NOT NULL
             AND unified_user.id IS NULL
           LIMIT 1`,
          {
            type: SELECT,
            transaction,
          },
        );

        if (invalidRows.length > 0) {
          throw new Error(
            `Cannot migrate ${tableName}.${columnName}. Missing users.id for value ${invalidRows[0].invalid_user_id}`,
          );
        }
      };

      const migrateOwnershipColumnToUsers = async ({
        tableName,
        legacyColumnName,
        newColumnName,
        indexName,
        constraintName,
      }) => {
        if (!(await tableExists(tableName))) {
          return;
        }

        const hasLegacyColumn = await columnExists(tableName, legacyColumnName);
        const hasNewColumn = await columnExists(tableName, newColumnName);

        if (hasLegacyColumn) {
          await removeForeignKeys(tableName, legacyColumnName);
          await mapLegacyOperatorIdsToUnified(tableName, legacyColumnName);
        }

        if (hasLegacyColumn && !hasNewColumn) {
          await queryInterface.renameColumn(tableName, legacyColumnName, newColumnName, {
            transaction,
          });
        }

        if (hasLegacyColumn && hasNewColumn) {
          await queryInterface.sequelize.query(
            `UPDATE ${tableName}
             SET ${newColumnName} = COALESCE(${newColumnName}, ${legacyColumnName})`,
            { transaction },
          );
          await queryInterface.removeColumn(tableName, legacyColumnName, {
            transaction,
          });
        }

        if (!(await columnExists(tableName, newColumnName))) {
          return;
        }

        await mapLegacyOperatorIdsToUnified(tableName, newColumnName);
        await assertColumnReferencesUsers(tableName, newColumnName);

        await queryInterface.changeColumn(
          tableName,
          newColumnName,
          {
            type: Sequelize.INTEGER,
            allowNull: false,
          },
          { transaction },
        );

        await removeForeignKeys(tableName, newColumnName);

        await addConstraintIfMissing({
          tableName,
          columnName: newColumnName,
          constraintName,
          referencedTable: "users",
          referencedColumn: "id",
          onDelete: "CASCADE",
        });

        if (!(await indexExists(tableName, indexName))) {
          await queryInterface.addIndex(tableName, [newColumnName], {
            name: indexName,
            transaction,
          });
        }
      };

      await migrateOwnershipColumnToUsers({
        tableName: "accommodation_list",
        legacyColumnName: "rt_user_id",
        newColumnName: "user_id",
        indexName: "accommodation_list_user_id_idx",
        constraintName: "accommodation_list_user_id_users_fk",
      });

      await migrateOwnershipColumnToUsers({
        tableName: "operator_activities",
        legacyColumnName: "rt_user_id",
        newColumnName: "user_id",
        indexName: "operator_activities_user_id_idx",
        constraintName: "operator_activities_user_id_users_fk",
      });

      if (await columnExists("form_responses", "operator_user_id")) {
        await removeForeignKeys("form_responses", "operator_user_id");
        await mapLegacyOperatorIdsToUnified("form_responses", "operator_user_id");
        await assertColumnReferencesUsers("form_responses", "operator_user_id");

        await addConstraintIfMissing({
          tableName: "form_responses",
          columnName: "operator_user_id",
          constraintName: "form_responses_operator_user_id_users_fk",
          referencedTable: "users",
          referencedColumn: "id",
          onDelete: "CASCADE",
        });
      }

      if (await tableExists("messages")) {
        const hasLegacyColumn = await columnExists("messages", "rt_user_id");
        const hasNewColumn = await columnExists("messages", "user_id");

        if (hasLegacyColumn) {
          await removeForeignKeys("messages", "rt_user_id");
          await mapLegacyOperatorIdsToUnified("messages", "rt_user_id");
        }

        if (hasLegacyColumn && !hasNewColumn) {
          await queryInterface.renameColumn("messages", "rt_user_id", "user_id", {
            transaction,
          });
        }

        if (hasLegacyColumn && hasNewColumn) {
          await queryInterface.sequelize.query(
            "UPDATE messages SET user_id = COALESCE(user_id, rt_user_id)",
            { transaction },
          );
          await queryInterface.removeColumn("messages", "rt_user_id", {
            transaction,
          });
        }

        if (await columnExists("messages", "user_id")) {
          await mapLegacyOperatorIdsToUnified("messages", "user_id");
          await assertColumnReferencesUsers("messages", "user_id");

          await queryInterface.changeColumn(
            "messages",
            "user_id",
            {
              type: Sequelize.INTEGER,
              allowNull: false,
            },
            { transaction },
          );

          await removeForeignKeys("messages", "user_id");

          await addConstraintIfMissing({
            tableName: "messages",
            columnName: "user_id",
            constraintName: "messages_user_id_users_fk",
            referencedTable: "users",
            referencedColumn: "id",
            onDelete: "CASCADE",
          });

          if (!(await indexExists("messages", "messages_user_id_idx"))) {
            await queryInterface.addIndex("messages", ["user_id"], {
              name: "messages_user_id_idx",
              transaction,
            });
          }
        }
      }

      if ((await tableExists("notifications")) && (await tableExists("rt_users"))) {
        await queryInterface.sequelize.query(
          `UPDATE notifications notification
           LEFT JOIN rt_users legacy_user
             ON legacy_user.user_id = notification.user_id
           LEFT JOIN users unified_user
             ON unified_user.username = legacy_user.username
            AND unified_user.email = legacy_user.email_address
           SET notification.user_id = unified_user.id
           WHERE unified_user.id IS NOT NULL
             AND (notification.user_type = 'operator' OR notification.user_type IS NULL)`,
          { transaction },
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
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

      const columnExists = async (tableName, columnName) => {
        if (!(await tableExists(tableName))) {
          return false;
        }

        const table = await queryInterface.describeTable(tableName, {
          transaction,
        });

        return !!table[columnName];
      };

      const removeForeignKeys = async (tableName, columnName) => {
        const foreignKeys = await queryInterface.sequelize.query(
          `SELECT CONSTRAINT_NAME
           FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = :tableName
             AND COLUMN_NAME = :columnName
             AND REFERENCED_TABLE_NAME IS NOT NULL`,
          {
            type: SELECT,
            replacements: { tableName, columnName },
            transaction,
          },
        );

        for (const fk of foreignKeys) {
          await queryInterface.removeConstraint(tableName, fk.CONSTRAINT_NAME, {
            transaction,
          });
        }
      };

      const mapUnifiedOperatorIdsToLegacy = async (tableName, columnName) => {
        if (!(await tableExists("users"))) {
          return;
        }

        if (!(await tableExists("rt_users"))) {
          return;
        }

        await queryInterface.sequelize.query(
          `UPDATE ${tableName} target
           LEFT JOIN users unified_user
             ON unified_user.id = target.${columnName}
           LEFT JOIN rt_users legacy_user
             ON legacy_user.username = unified_user.username
            AND legacy_user.email_address = unified_user.email
           SET target.${columnName} = COALESCE(legacy_user.user_id, target.${columnName})`,
          { transaction },
        );
      };

      const addConstraintIfMissing = async ({
        tableName,
        columnName,
        constraintName,
        referencedTable,
        referencedColumn,
      }) => {
        const existing = await queryInterface.sequelize.query(
          `SELECT CONSTRAINT_NAME
           FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = :tableName
             AND CONSTRAINT_NAME = :constraintName
             AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
          {
            type: SELECT,
            replacements: { tableName, constraintName },
            transaction,
          },
        );

        if (existing.length > 0) {
          return;
        }

        await queryInterface.addConstraint(tableName, {
          fields: [columnName],
          type: "foreign key",
          name: constraintName,
          references: {
            table: referencedTable,
            field: referencedColumn,
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          transaction,
        });
      };

      const restoreOwnershipColumnToLegacy = async ({
        tableName,
        unifiedColumnName,
        legacyColumnName,
        constraintName,
      }) => {
        if (!(await tableExists(tableName))) {
          return;
        }

        const hasUnifiedColumn = await columnExists(tableName, unifiedColumnName);
        const hasLegacyColumn = await columnExists(tableName, legacyColumnName);

        if (!hasUnifiedColumn && !hasLegacyColumn) {
          return;
        }

        if (hasUnifiedColumn) {
          await removeForeignKeys(tableName, unifiedColumnName);
          await mapUnifiedOperatorIdsToLegacy(tableName, unifiedColumnName);
        }

        if (hasUnifiedColumn && !hasLegacyColumn) {
          await queryInterface.renameColumn(tableName, unifiedColumnName, legacyColumnName, {
            transaction,
          });
        }

        if (hasUnifiedColumn && hasLegacyColumn) {
          await queryInterface.sequelize.query(
            `UPDATE ${tableName}
             SET ${legacyColumnName} = COALESCE(${legacyColumnName}, ${unifiedColumnName})`,
            { transaction },
          );
          await queryInterface.removeColumn(tableName, unifiedColumnName, {
            transaction,
          });
        }

        if ((await columnExists(tableName, legacyColumnName)) && (await tableExists("rt_users"))) {
          await removeForeignKeys(tableName, legacyColumnName);
          await addConstraintIfMissing({
            tableName,
            columnName: legacyColumnName,
            constraintName,
            referencedTable: "rt_users",
            referencedColumn: "user_id",
          });
        }
      };

      await restoreOwnershipColumnToLegacy({
        tableName: "accommodation_list",
        unifiedColumnName: "user_id",
        legacyColumnName: "rt_user_id",
        constraintName: "accommodation_list_rt_user_id_rt_users_fk",
      });

      await restoreOwnershipColumnToLegacy({
        tableName: "operator_activities",
        unifiedColumnName: "user_id",
        legacyColumnName: "rt_user_id",
        constraintName: "operator_activities_rt_user_id_rt_users_fk",
      });

      if ((await columnExists("form_responses", "operator_user_id")) && (await tableExists("rt_users"))) {
        await removeForeignKeys("form_responses", "operator_user_id");
        await mapUnifiedOperatorIdsToLegacy("form_responses", "operator_user_id");

        await addConstraintIfMissing({
          tableName: "form_responses",
          columnName: "operator_user_id",
          constraintName: "form_responses_operator_user_id_rt_users_fk",
          referencedTable: "rt_users",
          referencedColumn: "user_id",
        });
      }

      if (await tableExists("messages")) {
        const hasUnifiedColumn = await columnExists("messages", "user_id");
        const hasLegacyColumn = await columnExists("messages", "rt_user_id");

        if (hasUnifiedColumn) {
          await removeForeignKeys("messages", "user_id");
          await mapUnifiedOperatorIdsToLegacy("messages", "user_id");
        }

        if (hasUnifiedColumn && !hasLegacyColumn) {
          await queryInterface.renameColumn("messages", "user_id", "rt_user_id", {
            transaction,
          });
        }

        if (hasUnifiedColumn && hasLegacyColumn) {
          await queryInterface.sequelize.query(
            "UPDATE messages SET rt_user_id = COALESCE(rt_user_id, user_id)",
            { transaction },
          );
          await queryInterface.removeColumn("messages", "user_id", {
            transaction,
          });
        }

        if ((await columnExists("messages", "rt_user_id")) && (await tableExists("rt_users"))) {
          await removeForeignKeys("messages", "rt_user_id");

          await addConstraintIfMissing({
            tableName: "messages",
            columnName: "rt_user_id",
            constraintName: "messages_rt_user_id_rt_users_fk",
            referencedTable: "rt_users",
            referencedColumn: "user_id",
          });
        }
      }

      if ((await tableExists("notifications")) && (await tableExists("rt_users"))) {
        await queryInterface.sequelize.query(
          `UPDATE notifications notification
           LEFT JOIN users unified_user
             ON unified_user.id = notification.user_id
           LEFT JOIN rt_users legacy_user
             ON legacy_user.username = unified_user.username
            AND legacy_user.email_address = unified_user.email
           SET notification.user_id = legacy_user.user_id
           WHERE legacy_user.user_id IS NOT NULL
             AND (notification.user_type = 'operator' OR notification.user_type IS NULL)`,
          { transaction },
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
