const companyService = require("../services/companyService");
const { policy } = require("../policies");
const {
  serialize,
  serializeMany,
} = require("../serializers/companySerializer");
const { extractCompanyUpdateFields } = require("../parsers/companyParser");
const { successResponse, errorResponse } = require("../utils/helpers");
const { deleteFileIfManaged } = require("../utils/fileStorage");
const { ForbiddenError } = require("../services/errors/AppError");

/* ── Controller actions ────────────────────────────────────────── */

// GET /api/companies/:id
exports.getCompanyById = async (req, res) => {
  try {
    const company = await companyService.getCompanyById(req.params.id);

    if (!policy("company", req.user, company).show()) {
      throw new ForbiddenError("You can only access your own company.");
    }

    return successResponse(
      res,
      serialize(company),
      "Company fetched successfully",
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};

// PUT /api/companies/:id
exports.updateCompany = async (req, res) => {
  try {
    const company = await companyService.getCompanyById(req.params.id);

    const companyPolicy = policy("company", req.user, company);
    if (!companyPolicy.update()) {
      throw new ForbiddenError("You can only update your own company.");
    }

    const {
      company: companyFields,
      user: initialUserFields,
      replacedFileFields,
    } = await extractCompanyUpdateFields(req.body, req.files);

    // Owner name/email belong to the company owner's own account. Only the
    // owner (or a superadmin) may change them — a co-admin can still edit the
    // company details, but their owner fields are ignored.
    let userFields = initialUserFields;
    if (!companyPolicy.isAdmin()) {
      const owner = await companyService.getCompanyOwner(company.id);
      const callerId = req.user.unified_user_id ?? req.user.id;
      if (!owner || String(owner.id) !== String(callerId)) {
        userFields = {};
      }
    }

    // Update company table
    const updated = await companyService.updateCompany(
      req.params.id,
      companyFields,
    );

    // Clean up the old file on disk for any field that was just replaced,
    // now that the new path has been persisted successfully.
    for (const key of replacedFileFields) {
      if (company[key]) deleteFileIfManaged(company[key]);
    }

    // Update the company owner (operator_admin) if owner fields are present.
    await companyService.updateCompanyOwner(req.params.id, userFields);

    return successResponse(
      res,
      serialize(updated),
      "Company updated successfully",
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};

// GET /api/companies/package-options
exports.getPackageCompanies = async (req, res) => {
  try {
    const associationId = req.user?.association_id;
    if (!associationId && req.user?.role !== "superadmin") {
      throw new ForbiddenError("Association scope is required.");
    }

    const companies =
      req.user?.role === "superadmin"
        ? await companyService.getAllCompanies()
        : await companyService.getCompaniesByAssociationId(associationId);

    return successResponse(
      res,
      serializeMany(companies),
      "Companies fetched successfully",
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};
