/**
 * Company serializer — converts Sequelize model instances
 * into a consistent API response shape.
 */

function serialize(company) {
  const plain = company.toJSON ? company.toJSON() : company;
  return {
    id: plain.id,
    company_name: plain.company_name,
    address: plain.address,
    email: plain.email,
    location: plain.location,
    postcode: plain.postcode,
    total_fulltime_staff: plain.total_fulltime_staff,
    total_partime_staff: plain.total_partime_staff,
    contact_no: plain.contact_no,
    operator_logo_image: plain.operator_logo_image,
    motac_license_file: plain.motac_license_file,
    trading_operation_license: plain.trading_operation_license,
    homestay_certificate: plain.homestay_certificate,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
  };
}

module.exports = { serialize };
