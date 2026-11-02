/**
 * Registration serializer — a company registration as the approvals page
 * shows it. Documents are returned as stored (normally an /uploads/... path)
 * for the app's FileUrlService to resolve; the list leaves them out.
 */
const { daysSince } = require("../utils/registrationHelpers");

function serialize(entry, { withDocuments = true } = {}) {
  const company = entry.company?.toJSON ? entry.company.toJSON() : entry.company;
  const owner = entry.owner;
  const status = company.registration_status || "approved";

  return {
    company_id: company.id,
    company_name: company.company_name,
    status,
    submitted_at: company.registration_submitted_at || company.created_at,
    waiting_days: status === "pending" ? daysSince(company.registration_submitted_at || company.created_at) : null,
    reviewed_at: company.registration_reviewed_at,
    reviewed_by: entry.reviewer ? entry.reviewer.name || entry.reviewer.username : null,
    rejection_reason: company.registration_rejection_reason,
    association: entry.association ? { id: entry.association.id, name: entry.association.name } : null,
    owner: owner
      ? {
          id: owner.id,
          name: owner.name,
          username: owner.username,
          email: owner.email,
        }
      : null,
    company: {
      address: company.address,
      location: company.location,
      postcode: company.postcode,
      email: company.email,
      contact_no: company.contact_no,
      total_fulltime_staff: company.total_fulltime_staff,
      total_partime_staff: company.total_partime_staff,
    },
    ...(withDocuments
      ? {
          documents: {
            operator_logo_image: company.operator_logo_image || null,
            motac_license_file: company.motac_license_file || null,
            trading_operation_license: company.trading_operation_license || null,
            homestay_certificate: company.homestay_certificate || null,
          },
        }
      : {}),
  };
}

function serializeMany(entries) {
  return entries.map((entry) => serialize(entry, { withDocuments: false }));
}

module.exports = { serialize, serializeMany };
