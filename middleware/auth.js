const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

const normalizeDecodedPayload = (decoded = {}) => {
  const normalizedUserType = decoded.user_type || null;
  const isOperator = normalizedUserType === "operator";

  const normalized = {
    ...decoded,
    role: decoded.role || null,
    permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
    user_type: normalizedUserType,
  };

  if (!isOperator) {
    normalized.legacy_user_id = decoded.legacy_user_id ?? decoded.id ?? null;
  } else if (normalized.legacy_user_id !== undefined) {
    delete normalized.legacy_user_id;
  }

  if (normalized.id === undefined || normalized.id === null) {
    normalized.id = isOperator
      ? (decoded.unified_user_id ?? decoded.id ?? null)
      : normalized.legacy_user_id;
  }

  if (
    isOperator &&
    (normalized.unified_user_id === undefined ||
      normalized.unified_user_id === null)
  ) {
    normalized.unified_user_id = normalized.id ?? null;
  }

  return normalized;
};

/**
 * Authentication middleware to protect routes
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = normalizeDecodedPayload(decoded);
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = normalizeDecodedPayload(decoded);
    }
    next();
  } catch (error) {
    // Continue without user if token is invalid
    next();
  }
};

/**
 * Generate JWT token
 */
const generateToken = (payload, expiresIn = "24h") => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

module.exports = {
  authenticate,
  optionalAuth,
  generateToken,
  JWT_SECRET,
};
