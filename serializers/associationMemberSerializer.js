/**
 * Association member serializer — a member company's profile as its
 * association sees it (the "i" button on the association statistics page).
 * Files are returned as stored (normally an /uploads/... path) for the app's
 * FileUrlService to resolve.
 */
function serialize(entry) {
  const company = entry.company?.toJSON ? entry.company.toJSON() : entry.company;
  const owner = entry.owner;

  return {
    company_id: company.id,
    company_name: company.company_name,
    address: company.address,
    location: company.location,
    postcode: company.postcode,
    email: company.email,
    contact_no: company.contact_no,
    total_fulltime_staff: company.total_fulltime_staff,
    total_partime_staff: company.total_partime_staff,
    joined_at: company.registration_reviewed_at || company.created_at,
    association: entry.association ? { id: entry.association.id, name: entry.association.name } : null,
    owner: owner
      ? {
          name: owner.name,
          username: owner.username,
          email: owner.email,
        }
      : null,
    documents: {
      operator_logo_image: company.operator_logo_image || null,
      motac_license_file: company.motac_license_file || null,
      trading_operation_license: company.trading_operation_license || null,
      homestay_certificate: company.homestay_certificate || null,
    },
  };
}

module.exports = { serialize };
