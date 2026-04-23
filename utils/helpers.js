/**
 * Async handler wrapper to avoid try-catch in every controller
 * @param {Function} fn - Async function to wrap
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Convert an uploaded file buffer to a base64 data URI string.
 */
const toBase64DataUri = (file) => {
  if (!file || !file.buffer) return null;
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
};

/**
 * Parse a value as an integer, returning null for empty/invalid values.
 */
const parseNullableInt = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

/**
 * Standard success response
 */
const successResponse = (res, data, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Standard error response.
 *
 * Accepts either an Error object or positional args:
 *   errorResponse(res, err)                        – reads err.statusCode & err.message
 *   errorResponse(res, message, statusCode, errors) – legacy positional
 */
const errorResponse = (res, messageOrError, statusCode, errors) => {
  if (messageOrError instanceof Error) {
    const err = messageOrError;
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }

  const response = {
    success: false,
    message: messageOrError || "Error",
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode || 500).json(response);
};

/**
 * Build a standard pagination meta object (SRP — single source of truth).
 * @param {number} total     – total matching records
 * @param {number} page      – current page (1-based)
 * @param {number} perPage   – records per page
 * @param {number} pages     – total page count
 * @returns {{ total, page, per_page, total_pages, has_next, has_prev }}
 */
const buildMeta = (total, page, perPage, pages) => ({
  total,
  page,
  per_page: perPage,
  total_pages: pages,
  has_next: page < pages,
  has_prev: page > 1,
});

/**
 * Pagination helper
 */
const paginate = async (model, page = 1, limit = 10, options = {}) => {
  const offset = (page - 1) * limit;

  const { count, rows } = await model.findAndCountAll({
    ...options,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  const totalPages = Math.ceil(count / limit);

  return {
    data: rows,
    meta: buildMeta(count, parseInt(page), parseInt(limit), totalPages),
  };
};

/**
 * Standard paginated success response.
 * Envelope: { success, message, data, meta }
 */
const paginatedResponse = (
  res,
  data,
  message = "Success",
  { total, page, perPage, pages },
) => {
  return res.status(200).json({
    success: true,
    message,
    data,
    meta: buildMeta(total, page, perPage, pages),
  });
};

/**
 * Validate required fields
 */
const validateRequired = (fields, body) => {
  const missing = [];

  for (const field of fields) {
    if (
      !body[field] ||
      (typeof body[field] === "string" && body[field].trim() === "")
    ) {
      missing.push(field);
    }
  }

  return missing;
};

module.exports = {
  asyncHandler,
  toBase64DataUri,
  parseNullableInt,
  successResponse,
  paginatedResponse,
  errorResponse,
  paginate,
  buildMeta,
  validateRequired,
};
