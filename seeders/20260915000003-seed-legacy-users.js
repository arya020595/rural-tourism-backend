"use strict";

const seedData = require("./data/legacy-kiulu-seed-data");
const {
  findMappedId,
  recordMapping,
  requireRoleId,
  requireAssociationId,
  KTA_ASSOCIATION_NAME,
} = require("./data/legacyMigrationHelpers");

/**
 * Step 2 of the legacy Kiulu migration (see
 * docs/LEGACY_DB_MIGRATION_ANALYSIS.md §6): inserts the 54 migrated users,
 * resolving company_id via the legacy_id_map rows written by
 * 20260915000002-seed-legacy-companies.js. Password hashes are copied as-is
 * (bcrypt $2b$, portable per the analysis §1 — no forced reset needed).
 *
 * Must run after the companies seeder. Idempotent via legacy_id_map, and
 * also checks for an existing production user by email/username (verified
 * zero collisions after test-account exclusion in the analysis, but checked
 * here rather than assumed — see §8 "silent duplication" risk).
 */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const SELECT = queryInterface.sequelize.QueryTypes.SELECT;

      const operatorAdminRoleId = await requireRoleId(
        queryInterface,
        transaction,
        "operator_admin",
      );
      const operatorStaffRoleId = await requireRoleId(
        queryInterface,
        transaction,
        "operator_staff",
      );
      const ktaAssociationId = await requireAssociationId(
        queryInterface,
        transaction,
        KTA_ASSOCIATION_NAME,
      );

      let inserted = 0;
      let alreadyMapped = 0;
      let matchedExisting = 0;
      const collisions = [];

      for (const user of seedData.users) {
        const existingMapping = await findMappedId(
          queryInterface,
          transaction,
          "user",
          user.legacyUserId,
        );
        if (existingMapping) {
          alreadyMapped += 1;
          continue;
        }

        const companyId = await findMappedId(
          queryInterface,
          transaction,
          "company",
          user.company_legacy_key,
        );
        if (!companyId) {
          throw new Error(
            `No company_id mapping found for legacy company key '${user.company_legacy_key}' (user ${user.legacyUserId}). Run the companies seeder first.`,
          );
        }

        const existingUser = await queryInterface.sequelize.query(
          "SELECT id FROM users WHERE username = :username OR email = :email LIMIT 1",
          {
            type: SELECT,
            replacements: { username: user.username, email: user.email },
            transaction,
          },
        );

        let userId;
        if (existingUser.length) {
          userId = Number(existingUser[0].id);
          matchedExisting += 1;
          collisions.push({
            legacyUserId: user.legacyUserId,
            username: user.username,
            email: user.email,
            matchedUserId: userId,
          });
        } else {
          const roleId =
            user.role === "operator_admin"
              ? operatorAdminRoleId
              : operatorStaffRoleId;

          await queryInterface.sequelize.query(
            `INSERT INTO users (
              name, username, email, password, association_id, role_id,
              company_id, created_at, updated_at
            ) VALUES (
              :name, :username, :email, :password, :associationId, :roleId,
              :companyId, NOW(), NOW()
            )`,
            {
              replacements: {
                name: user.name,
                username: user.username,
                email: user.email,
                password: user.password,
                associationId: ktaAssociationId,
                roleId,
                companyId,
              },
              transaction,
            },
          );

          const insertedRow = await queryInterface.sequelize.query(
            "SELECT id FROM users WHERE username = :username LIMIT 1",
            {
              type: SELECT,
              replacements: { username: user.username },
              transaction,
            },
          );
          userId = Number(insertedRow[0].id);
          inserted += 1;
        }

        await recordMapping(
          queryInterface,
          transaction,
          "user",
          user.legacyUserId,
          userId,
        );
      }

      if (collisions.length) {
        console.warn(
          `[seed-legacy-users] WARNING: ${collisions.length} legacy user(s) matched an existing production user by username/email — mapped to the existing row instead of inserting a duplicate. This was expected to be zero per the migration analysis; review before trusting this run:`,
          JSON.stringify(collisions, null, 2),
        );
      }

      console.log(
        `[seed-legacy-users] up summary: source=${seedData.users.length}, inserted=${inserted}, matched_existing=${matchedExisting}, already_mapped=${alreadyMapped}, collisions=${collisions.length}`,
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

      const mappedRows = await queryInterface.sequelize.query(
        "SELECT new_id FROM legacy_id_map WHERE entity = 'user'",
        { type: SELECT, transaction },
      );
      const userIds = mappedRows.map((r) => Number(r.new_id));

      if (userIds.length) {
        await queryInterface.sequelize.query(
          "DELETE FROM users WHERE id IN (:userIds)",
          { replacements: { userIds }, transaction },
        );
      }

      await queryInterface.sequelize.query(
        "DELETE FROM legacy_id_map WHERE entity = 'user'",
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
