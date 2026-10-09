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
 * Authentication middleware to protect routes.
 *
 * Login tokens last 30 days, so tokens that record which table their user
 * lives in (`src` claim) are re-checked against the database on every
 * request: a deactivated/removed user or a password changed elsewhere ends
 * the session (401 with a `code` the app uses to pick its message), and the
 * current role, permissions and company replace what the token said at login.
 * Tokens without `src` were issued before this check existed and keep the old
 * token-only behaviour until they expire.
 */
const authenticate = async (req, res, next) => {
  let decoded;
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        code: "NO_TOKEN",
        message: "Access denied. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        code: "TOKEN_EXPIRED",
        message: "Token expired. Please login again.",
      });
    }
    return res.status(401).json({
      success: false,
      code: "INVALID_TOKEN",
      message: "Invalid token.",
    });
  }

  if (!decoded.src) {
    req.user = normalizeDecodedPayload(decoded);
    return next();
  }

  let currentState;
  try {
    // Lazy require: the session service pulls in models/services that
    // themselves import this module (generateToken).
    const { sessionService } = require("../services/sessionService");
    currentState = await sessionService.loadCurrentState(decoded);
  } catch (error) {
    if (error.name === "SessionInvalidError") {
      return res.status(401).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    return next(error);
  }

  req.user = normalizeDecodedPayload({ ...decoded, ...(currentState || {}) });
  return next();
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

/** Login token lifetime; renewed by GET /api/auth/me while in use. */
const getTokenTtl = () => process.env.JWT_EXPIRES_IN || "30d";

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
  getTokenTtl,
  JWT_SECRET,
};
