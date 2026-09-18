"use strict";

/**
 * Creates the legacy_id_map crosswalk table used by the legacy Kiulu
 * migration seeders (see docs/LEGACY_DB_MIGRATION_ANALYSIS.md §6 step 2).
 * Deliberately a plain seeder query, not a tracked schema migration — this
 * table is migration-support bookkeeping, not part of the application
 * schema, and nothing in the running app queries it.
 *
 * (entity, legacy_id) is unique so every downstream seeder step is
 * idempotent and safely re-runnable: re-running the migration looks up an
 * existing mapping before inserting anything new.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS legacy_id_map (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity VARCHAR(32) NOT NULL,
        legacy_id VARCHAR(255) NOT NULL,
        new_id BIGINT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY legacy_id_map_entity_legacy_id (entity, legacy_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "DROP TABLE IF EXISTS legacy_id_map",
    );
  },
};
