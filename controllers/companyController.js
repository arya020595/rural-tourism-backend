const companyService = require("../services/companyService");
const { policy } = require("../policies");
const {
  serialize,
  serializeMany,
} = require("../serializers/companySerializer");
const { extractCompanyUpdateFields } = require("../parsers/companyParser");
const { successResponse, errorResponse } = require("../utils/helpers");
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

    if (!policy("company", req.user, company).update()) {
      throw new ForbiddenError("You can only update your own company.");
    }

    const { company: companyFields, user: userFields } =
      extractCompanyUpdateFields(req.body, req.files);

    // Update company table
    const updated = await companyService.updateCompany(
      req.params.id,
      companyFields,
    );

    // Update associated user(s) if user fields are present
    if (Object.keys(userFields).length > 0) {
      const UnifiedUser = require("../models/unifiedUserModel");
      await UnifiedUser.update(userFields, {
        where: { company_id: req.params.id },
      });
    }

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
