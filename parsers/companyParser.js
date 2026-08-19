/**
 * Company request parser — extracts and maps request fields to domain objects.
 */
const { parseNullableInt } = require("../utils/helpers");
const { saveUploadedFile } = require("../utils/fileStorage");

/**
 * Extract company fields from request body and uploaded files.
 * Accepts DB column names directly (e.g. `company_name`, `postcode`).
 * Returns { company, user, replacedFileFields } — replacedFileFields lists
 * which of the 4 file fields had a genuinely new file uploaded (as opposed
 * to an unchanged value passed through in the body), so the caller knows
 * which old files on disk are now safe to delete.
 */
async function extractCompanyUpdateFields(body, files) {
  const company = {};
  const user = {};

  const STRING_FIELDS = [
    "company_name",
    "address",
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

  const replacedFileFields = [];
  for (const key of FILE_FIELDS) {
    const file = files?.[key]?.[0];
    if (file) {
      company[key] = await saveUploadedFile(file.buffer, file.mimetype);
      replacedFileFields.push(key);
    } else if (body[key] !== undefined) {
      company[key] = body[key];
    }
  }

  // Extract user-level fields. The company profile's owner name AND email live
  // on the owner's `users` row (not the `companies` table), so route them
  // through the user bucket → updateCompanyOwner.
  // NOTE: association_id is intentionally excluded — changing it would orphan
  // existing package bookings that reference cross-association companies.
  // Only a superadmin DB migration should reassign a company's association.
  if (body.owner_full_name !== undefined) {
    user.name = body.owner_full_name; // Map frontend field to DB column
  }
  if (body.email !== undefined) {
    user.email = body.email;
  }

  return { company, user, replacedFileFields };
}

module.exports = { extractCompanyUpdateFields };
