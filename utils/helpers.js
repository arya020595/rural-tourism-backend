/**
 * Async handler wrapper to avoid try-catch in every controller
 * @param {Function} fn - Async function to wrap
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
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
 * Standard error response
 */
const errorResponse = (
  res,
  message = "Error",
  statusCode = 500,
  errors = null
) => {
  const response = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

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

  return {
    data: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      hasNextPage: page < Math.ceil(count / limit),
      hasPrevPage: page > 1,
    },
  };
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
  successResponse,
  errorResponse,
  paginate,
  validateRequired,
};
