"use strict";

/**
 * One-time backfill: converts existing `companies` file columns
 * (operator_logo_image, motac_license_file, trading_operation_license,
 * homestay_certificate) from base64/legacy values into real files on disk,
 * rewriting each column to the resulting `/uploads/...` path.
 *
 * Run manually via SSH after taking a DB backup — this is intentionally NOT
 * wired into `npm run db:migrate`.
 *
 * Usage:
 *   node scripts/migrate-company-files-to-disk.js            # dry run (default, no writes)
 *   node scripts/migrate-company-files-to-disk.js --apply    # actually write files + update rows
 */

const fs = require("fs");
const path = require("path");
const { QueryTypes } = require("sequelize");
const db = require("../config/db");
const { saveBufferToDisk } = require("../utils/fileStorage");

const FIELDS = [
  "operator_logo_image",
  "motac_license_file",
  "trading_operation_license",
  "homestay_certificate",
];

const UPLOADS_ROOT = path.join(__dirname, "../uploads");
const isApply = process.argv.includes("--apply");

/**
 * Classify a single column value into what action it needs. Does not write
 * anything itself — callers decide whether to act based on `--apply`.
 */
function classify(value) {
  if (!value) return null;

  if (value.startsWith("/uploads/")) {
    return { action: "already-migrated" };
  }
  if (value.startsWith("uploads/")) {
    return { action: "normalize-prefix", newValue: `/${value}` };
  }
  if (value.startsWith("data:")) {
    const match = value.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) return { action: "unrecognized" };
    const [, mimetype, base64Payload] = match;
    return { action: "decode-base64", mimetype, base64Payload };
  }

  // Bare legacy filename (e.g. "default_logo.png") — no slash, no data: prefix,
  // matches values seeded by seeders/20260413091300-seed-unified-operator-
  // association-accounts.js and scripts/restore-seed-company.js.
  if (!value.includes("/") && path.extname(value)) {
    const legacyPath = path.join(UPLOADS_ROOT, "logos", value);
    if (fs.existsSync(legacyPath)) {
      return { action: "legacy-filename", newValue: `/uploads/logos/${value}` };
    }
    return { action: "legacy-file-missing" };
  }

  return { action: "unrecognized" };
}

async function updateField(companyId, field, newValue) {
  await db.query(`UPDATE companies SET ${field} = :newValue WHERE id = :companyId`, {
    replacements: { newValue, companyId },
  });
}

async function run() {
  const rows = await db.query(
    `SELECT id, ${FIELDS.join(", ")} FROM companies`,
    { type: QueryTypes.SELECT },
  );

  const summary = { migrated: 0, alreadyMigrated: 0, skipped: 0, errored: 0 };

  for (const row of rows) {
    for (const field of FIELDS) {
      const value = row[field];
      const result = classify(value);
      if (!result) continue; // null/empty — nothing to do

      try {
        switch (result.action) {
          case "already-migrated":
            summary.alreadyMigrated++;
            break;

          case "normalize-prefix":
            console.log(
              `company ${row.id}.${field}: normalize prefix -> ${result.newValue}`,
            );
            if (isApply) await updateField(row.id, field, result.newValue);
            summary.migrated++;
            break;

          case "decode-base64": {
            const buffer = Buffer.from(result.base64Payload, "base64");
            if (isApply) {
              const newPath = saveBufferToDisk(buffer, result.mimetype);
              await updateField(row.id, field, newPath);
              console.log(
                `company ${row.id}.${field}: decoded base64 (${buffer.length} bytes) -> ${newPath}`,
              );
            } else {
              console.log(
                `company ${row.id}.${field}: [dry-run] would decode base64 (${buffer.length} bytes, ${result.mimetype})`,
              );
            }
            summary.migrated++;
            break;
          }

          case "legacy-filename":
            console.log(
              `company ${row.id}.${field}: legacy filename -> ${result.newValue}`,
            );
            if (isApply) await updateField(row.id, field, result.newValue);
            summary.migrated++;
            break;

          case "legacy-file-missing":
            console.warn(
              `company ${row.id}.${field}: legacy filename "${value}" not found under uploads/logos/ - skipped, needs manual follow-up`,
            );
            summary.skipped++;
            break;

          case "unrecognized":
            console.warn(
              `company ${row.id}.${field}: unrecognized value shape - skipped, needs manual follow-up`,
            );
            summary.skipped++;
            break;
        }
      } catch (err) {
        console.error(`company ${row.id}.${field}: ERROR - ${err.message}`);
        summary.errored++;
      }
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Mode: ${isApply ? "APPLY (writes made)" : "DRY RUN (no writes made — pass --apply to write)"}`);
  console.log(summary);

  db.close();
}

run().catch((e) => {
  console.error(e);
  db.close();
  process.exit(1);
});
