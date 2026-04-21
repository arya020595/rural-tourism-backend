const companyService = require("../services/companyService");
const { policy } = require("../policies");
const { serialize } = require("../serializers/companySerializer");
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

    const fields = extractCompanyUpdateFields(req.body, req.files);
    const updated = await companyService.updateCompany(req.params.id, fields);

    return successResponse(
      res,
      serialize(updated),
      "Company updated successfully",
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};
