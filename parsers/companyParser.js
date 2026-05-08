/**
 * Company request parser — extracts and maps request fields to domain objects.
 */
const { toBase64DataUri, parseNullableInt } = require("../utils/helpers");

/**
 * Extract company fields from request body and uploaded files.
 * Accepts DB column names directly (e.g. `company_name`, `postcode`).
 * Returns { company, user } with separate buckets for company and user fields.
 */
function extractCompanyUpdateFields(body, files) {
  const company = {};
  const user = {};

  const STRING_FIELDS = [
    "company_name",
    "address",
    "email",
    "location",
    "postcode",
    "contact_no",
  ];

  for (const key of STRING_FIELDS) {
    if (body[key] !== undefined) company[key] = body[key];
  }

  const INT_FIELDS = ["total_fulltime_staff", "total_partime_staff"];
  for (const key of INT_FIELDS) {
    if (body[key] !== undefined) company[key] = parseNullableInt(body[key]);
  }

  const FILE_FIELDS = [
    "operator_logo_image",
    "motac_license_file",
    "trading_operation_license",
    "homestay_certificate",
  ];

  for (const key of FILE_FIELDS) {
    const file = files?.[key]?.[0];
    if (file) {
      company[key] = toBase64DataUri(file);
    } else if (body[key] !== undefined) {
      company[key] = body[key];
    }
  }

  // Extract user-level fields
  if (body.association_id !== undefined) {
    user.association_id = parseNullableInt(body.association_id);
  }
  if (body.owner_full_name !== undefined) {
    user.name = body.owner_full_name; // Map frontend field to DB column
  }

  return { company, user };
}

module.exports = { extractCompanyUpdateFields };
