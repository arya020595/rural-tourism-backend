const authService = require("../services/authService");

const SUPPORTED_USER_TYPES = ["operator", "tourist", "association"];

exports.login = async (req, res) => {
  try {
    const identifier = req.body.identifier || req.body.username || req.body.email;
    const { password } = req.body;
    const userType = req.body.user_type;

    if (userType && !SUPPORTED_USER_TYPES.includes(userType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid user_type. Allowed values: ${SUPPORTED_USER_TYPES.join(", ")}.`,
      });
    }

    const authResult = await authService.login({
      identifier,
      password,
      allowedUserTypes: userType ? [userType] : undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: authResult,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

exports.me = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Authenticated user fetched successfully",
    data: {
      user: req.user,
    },
  });
};

exports.register = async (req, res) => {
  try {
    const userType = req.body.user_type || req.body.userType;

    if (!userType || !SUPPORTED_USER_TYPES.includes(userType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid user_type. Allowed values: ${SUPPORTED_USER_TYPES.join(", ")}.`,
      });
    }

    const registerResult = await authService.register({
      userType,
      payload: req.body,
      files: req.files,
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: registerResult,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
