"use strict";

/**
 * Shared helpers for the legacy Kiulu migration seeders
 * (seeders/2026091500000{2..6}-seed-legacy-*.js). Lives under seeders/data/
 * (like rt-users-seed-data.js) rather than seeders/ directly — sequelize-cli
 * (via umzug@2) scans only the top level of the configured seeders path with
 * pattern /\.(cjs|js|cts|ts)$/ and no underscore/name exclusion, so a helper
 * file placed directly in seeders/ would be picked up and run as a seeder.
 */

const SELECT = (queryInterface) => queryInterface.sequelize.QueryTypes.SELECT;

/** Looks up an existing legacy_id_map row for (entity, legacyId). */
async function findMappedId(queryInterface, transaction, entity, legacyId) {
  const rows = await queryInterface.sequelize.query(
    "SELECT new_id FROM legacy_id_map WHERE entity = :entity AND legacy_id = :legacyId LIMIT 1",
    {
      type: SELECT(queryInterface),
      replacements: { entity, legacyId },
      transaction,
    },
  );
  return rows.length ? Number(rows[0].new_id) : null;
}

/** Records a new legacy_id_map row. Assumes findMappedId() found nothing. */
async function recordMapping(queryInterface, transaction, entity, legacyId, newId) {
  await queryInterface.sequelize.query(
    `INSERT INTO legacy_id_map (entity, legacy_id, new_id, created_at)
     VALUES (:entity, :legacyId, :newId, NOW())
     ON DUPLICATE KEY UPDATE new_id = VALUES(new_id)`,
    {
      replacements: { entity, legacyId, newId },
      transaction,
    },
  );
}

/** Resolves roles.id for a role name. Throws if the role is missing. */
async function requireRoleId(queryInterface, transaction, roleName) {
  const rows = await queryInterface.sequelize.query(
    "SELECT id FROM roles WHERE LOWER(name) = LOWER(:roleName) LIMIT 1",
    {
      type: SELECT(queryInterface),
      replacements: { roleName },
      transaction,
    },
  );
  const id = Number(rows[0]?.id || 0);
  if (!id) {
    throw new Error(
      `Required role '${roleName}' not found in roles table. Run RBAC role seeders first.`,
    );
  }
  return id;
}

/** Resolves associations.id for an association name. Throws if missing. */
async function requireAssociationId(queryInterface, transaction, associationName) {
  const rows = await queryInterface.sequelize.query(
    "SELECT id FROM associations WHERE name = :associationName LIMIT 1",
    {
      type: SELECT(queryInterface),
      replacements: { associationName },
      transaction,
    },
  );
  const id = Number(rows[0]?.id || 0);
  if (!id) {
    throw new Error(
      `Required association '${associationName}' not found in associations table. Run association seeders first.`,
    );
  }
  return id;
}

const KTA_ASSOCIATION_NAME = "KIULU TOURISM ASSOCIATION (KTA)";

module.exports = {
  findMappedId,
  recordMapping,
  requireRoleId,
  requireAssociationId,
  KTA_ASSOCIATION_NAME,
};
