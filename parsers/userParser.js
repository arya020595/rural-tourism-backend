/**
 * User request parser — extracts and maps request fields to domain objects.
 *
 * Pattern: Rails-style strong params (one file per resource).
 * Separates HTTP-layer field mapping from controller logic.
 */
const { toBase64DataUri, parseNullableInt } = require("../utils/helpers");

/**
 * Extract company-related fields from the request body and uploaded files.
 * Returns `null` when no company fields are present.
 */
function extractCompanyFields(body, files) {
  const fields = {};

  // Simple string mappings: body key → DB column
  const FIELD_MAP = {
    business_name: "company_name",
    business_address: "address",
    location: "location",
    contact_no: "contact_no",
  };

  for (const [bodyKey, dbKey] of Object.entries(FIELD_MAP)) {
    if (body[bodyKey] !== undefined) fields[dbKey] = body[bodyKey];
  }

  // Numeric / formatted fields
  if (body.poscode !== undefined) fields.postcode = body.poscode;
  if (body.no_of_full_time_staff !== undefined)
    fields.total_fulltime_staff = parseNullableInt(body.no_of_full_time_staff);
  if (body.no_of_part_time_staff !== undefined)
    fields.total_partime_staff = parseNullableInt(body.no_of_part_time_staff);

  // Sync email from user fields when present
  if (body.email !== undefined) fields.email = body.email;

  // File uploads — prefer uploaded binary over body string
  const FILE_FIELDS = [
    {
      db: "operator_logo_image",
      keys: ["operator_logo_image", "company_logo"],
    },
    { db: "motac_license_file", keys: ["motac_license_file"] },
    { db: "trading_operation_license", keys: ["trading_operation_license"] },
    { db: "homestay_certificate", keys: ["homestay_certificate"] },
  ];

  for (const { db, keys } of FILE_FIELDS) {
    const file = keys.reduce((found, key) => found || files?.[key]?.[0], null);
    if (file) {
      fields[db] = toBase64DataUri(file);
    } else if (body[keys[0]] !== undefined) {
      fields[db] = body[keys[0]];
    }
  }

  return Object.keys(fields).length > 0 ? fields : null;
}

module.exports = { extractCompanyFields };
