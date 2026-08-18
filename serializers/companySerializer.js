/**
 * Company serializer — converts Sequelize model instances
 * into a consistent API response shape.
 *
 * License/certificate documents (motac_license_file,
 * trading_operation_license, homestay_certificate) are deliberately
 * excluded — each is a base64-encoded file that can be several MB, and none
 * of the callers of this serializer (company fetch, update confirmation,
 * package-company dropdown) read them. Company Profile's document viewer
 * fetches them separately via GET /users/:id/company-documents.
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
    created_at: plain.created_at,
    updated_at: plain.updated_at,
  };
}

function serializeMany(companies = []) {
  return companies.map(serialize);
}

module.exports = { serialize, serializeMany };
