const { passwordResetService } = require("../services/passwordResetService");
const { successResponse, errorResponse } = require("../utils/helpers");

exports.forgotPassword = async (req, res) => {
  try {
    await passwordResetService.requestPasswordReset(req.body.email);

    return successResponse(
      res,
      null,
      "If an account with that email exists, a reset link has been sent.",
      200,
    );
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return errorResponse(
      res,
      error.message || "Failed to process request",
      statusCode,
    );
  }
};

exports.resetPassword = async (req, res) => {
  try {
    await passwordResetService.resetPassword(req.body.token, req.body.password);

    return successResponse(
      res,
      null,
      "Password has been reset successfully.",
      200,
    );
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return errorResponse(
      res,
      error.message || "Failed to reset password",
      statusCode,
    );
  }
};
