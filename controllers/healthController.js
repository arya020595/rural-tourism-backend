const healthService = require("../services/healthService");
const { successResponse, errorResponse } = require("../utils/helpers");

exports.check = async (req, res) => {
  try {
    const result = await healthService.checkHealth();
    return successResponse(res, result, "API is healthy");
  } catch (err) {
    return errorResponse(res, err);
  }
};
