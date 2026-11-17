const dashboardService = require("../services/dashboardService");
const { dashboardValidator } = require("../validators/dashboardValidator");
const { serialize: serializeMember } = require("../serializers/associationMemberSerializer");
const { policy } = require("../policies");
const { successResponse, errorResponse } = require("../utils/helpers");
const { ForbiddenError } = require("../services/errors/AppError");

exports.getTodayDashboard = async (req, res) => {
  try {
    const validationResult = dashboardValidator.validateTodayQuery(req.query);
    if (!validationResult.isValid) {
      return res.status(400).json(validationResult.toResponse());
    }

    const result = await dashboardService.getTodayDashboard(req.user, req.query.date);
    return successResponse(res, result, "Dashboard today fetched successfully");
  } catch (err) {
    return errorResponse(res, err);
  }
};

exports.getTrendDashboard = async (req, res) => {
  try {
    const validationResult = dashboardValidator.validateTrendQuery(req.query);
    if (!validationResult.isValid) {
      return res.status(400).json(validationResult.toResponse());
    }

    const result = await dashboardService.getTrendDashboard(
      req.user,
      req.query.from,
      req.query.to,
    );

    return successResponse(res, result, "Dashboard trend fetched successfully");
  } catch (err) {
    return errorResponse(res, err);
  }
};

// Superadmin-only: all-time totals per association.
exports.getAssociationStats = async (req, res) => {
  try {
    const isSuperadmin =
      req.user?.role === "superadmin" ||
      (Array.isArray(req.user?.permissions) &&
        req.user.permissions.includes("*:*"));
    if (!isSuperadmin) {
      const error = new Error("Superadmin access is required.");
      error.statusCode = 403;
      throw error;
    }

    const validationResult = dashboardValidator.validateAssociationStatsQuery(
      req.query,
    );
    if (!validationResult.isValid) {
      return res.status(400).json(validationResult.toResponse());
    }

    const result = await dashboardService.getAssociationStats(
      req.query.from,
      req.query.to,
    );
    return successResponse(
      res,
      result,
      "Association stats fetched successfully",
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};

// Association statistics page: the user's own association + member companies.
exports.getMyAssociationStats = async (req, res) => {
  try {
    const validationResult = dashboardValidator.validateAssociationStatsQuery(
      req.query,
    );
    if (!validationResult.isValid) {
      return res.status(400).json(validationResult.toResponse());
    }

    const result = await dashboardService.getMyAssociationStats(
      req.user,
      req.query.from,
      req.query.to,
    );
    return successResponse(res, result, "Association stats fetched successfully");
  } catch (err) {
    return errorResponse(res, err);
  }
};

// GET /api/dashboard/my-association-members/:companyId
exports.getAssociationMember = async (req, res) => {
  try {
    const entry = await dashboardService.getAssociationMember(req.params.companyId);
    if (!policy("associationMember", req.user, entry).show()) {
      throw new ForbiddenError("This company is not a member of your association.");
    }
    return successResponse(res, serializeMember(entry), "Member profile fetched successfully");
  } catch (err) {
    return errorResponse(res, err);
  }
};
