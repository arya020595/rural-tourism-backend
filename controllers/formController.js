/**
 * Form Controller
 * Single Responsibility: Handle HTTP request/response only
 * Dependency Inversion: Uses injected services and validators
 *
 * SOLID Architecture:
 * - Validation: /validators/formValidator.js
 * - Business Logic: /services/formService.js
 * - HTTP Handling: This controller
 */

const { formValidator } = require("../validators/formValidator");
const {
  formService,
  NotFoundError,
  FormServiceError,
} = require("../services/formService");

/**
 * Create a new form entry
 * POST /api/form
 */
exports.createForm = async (req, res) => {
  try {
    // 1. Validate input
    const validationResult = formValidator.validateCreate(req.body);
    if (!validationResult.isValid) {
      return res.status(400).json(validationResult.toResponse());
    }

    // 2. Sanitize data
    const sanitizedData = formValidator.sanitizeData(req.body);

    // 3. Execute business logic via service
    const newForm = await formService.createForm(sanitizedData);

    // 4. Return success response
    return res.status(201).json({ success: true, data: newForm });
  } catch (err) {
    return handleError(res, err, "Error creating form");
  }
};

/**
 * Get a form by receipt_id
 * GET /api/form/:id
 */
exports.getRespById = async (req, res) => {
  try {
    const { id } = req.params;
    const form = await formService.getFormByReceiptId(id);

    return res.status(200).json({ success: true, data: form });
  } catch (err) {
    return handleError(res, err, "Error fetching form");
  }
};

/**
 * Get all forms created by a specific operator
 * GET /api/form/operator/:user_id
 */
exports.getFormsByOperator = async (req, res) => {
  try {
    const { user_id } = req.params;
    const forms = await formService.getFormsByOperator(user_id);

    return res.status(200).json({ success: true, data: forms });
  } catch (err) {
    return handleError(res, err, "Error fetching forms");
  }
};

/**
 * Centralized error handler for controller
 * @param {object} res - Express response object
 * @param {Error} err - Error object
 * @param {string} context - Error context message
 */
function handleError(res, err, context) {
  console.error(`${context}:`, err);

  // Handle known service errors
  if (err instanceof NotFoundError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  if (err instanceof FormServiceError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Handle Sequelize foreign key errors
  if (err.name === "SequelizeForeignKeyConstraintError") {
    return res.status(400).json({
      success: false,
      message:
        "Foreign key constraint failed. Check that referenced records exist.",
    });
  }

  // Handle Sequelize validation errors
  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: err.errors.map((e) => ({ field: e.path, message: e.message })),
    });
  }

  // Generic server error
  return res.status(500).json({
    success: false,
    error: "Internal server error",
  });
}
