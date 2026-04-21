/**
 * Company request parser — extracts and maps request fields to domain objects.
 */
const { toBase64DataUri, parseNullableInt } = require("../utils/helpers");

/**
 * Extract company fields from request body and uploaded files.
 * Accepts DB column names directly (e.g. `company_name`, `postcode`).
 */
function extractCompanyUpdateFields(body, files) {
  const fields = {};

  const STRING_FIELDS = [
    "company_name",
    "address",
    "email",
    "location",
    "postcode",
    "contact_no",
  ];

  for (const key of STRING_FIELDS) {
    if (body[key] !== undefined) fields[key] = body[key];
  }

  const INT_FIELDS = ["total_fulltime_staff", "total_partime_staff"];
  for (const key of INT_FIELDS) {
    if (body[key] !== undefined) fields[key] = parseNullableInt(body[key]);
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
      fields[key] = toBase64DataUri(file);
    } else if (body[key] !== undefined) {
      fields[key] = body[key];
    }
  }

  return fields;
}

module.exports = { extractCompanyUpdateFields };
