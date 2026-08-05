const dashboardService = require("../services/dashboardService");
const { dashboardValidator } = require("../validators/dashboardValidator");
const { successResponse, errorResponse } = require("../utils/helpers");

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

    const result = await dashboardService.getAssociationStats();
    return successResponse(
      res,
      result,
      "Association stats fetched successfully",
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};
