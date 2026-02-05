/**
 * Form Validator
 * Single Responsibility: Validate and sanitize form input data
 *
 * SOLID Architecture:
 * - Handles all validation logic for form operations
 * - Returns standardized validation results
 */

const { sanitizeString } = require("../middleware/validation");

/**
 * Validation Result class
 * Encapsulates validation state and errors
 */
class ValidationResult {
  constructor(isValid = true, errors = []) {
    this.isValid = isValid;
    this.errors = errors;
  }

  toResponse() {
    return {
      success: false,
      message: "Validation failed",
      errors: this.errors,
    };
  }
}

/**
 * FormValidator class
 * Handles validation and sanitization of form data
 */
class FormValidator {
  /**
   * Validate form creation data
   * @param {object} data - Raw form data from request
   * @returns {ValidationResult} Validation result
   */
  validateCreate(data) {
    const errors = [];

    // Required fields validation
    if (
      !data.receipt_id ||
      typeof data.receipt_id !== "string" ||
      data.receipt_id.trim().length === 0
    ) {
      errors.push("Receipt ID is required");
    }

    if (!data.tourist_user_id) {
      errors.push("Tourist user ID is required");
    }

    if (!data.operator_user_id) {
      errors.push("Operator user ID is required");
    }

    // Validate pax (number of people)
    if (data.pax !== undefined && data.pax !== null) {
      const pax = parseInt(data.pax, 10);
      if (isNaN(pax) || pax < 1) {
        errors.push("Pax must be a positive number");
      }
    }

    // Validate total_rm (total amount)
    if (data.total_rm !== undefined && data.total_rm !== null) {
      const totalRm = parseFloat(data.total_rm);
      if (isNaN(totalRm) || totalRm < 0) {
        errors.push("Total RM must be a non-negative number");
      }
    }

    // Validate total_night
    if (data.total_night !== undefined && data.total_night !== null) {
      const totalNight = parseInt(data.total_night, 10);
      if (isNaN(totalNight) || totalNight < 0) {
        errors.push("Total night must be a non-negative number");
      }
    }

    // Validate date format if provided
    if (data.date) {
      const date = new Date(data.date);
      if (isNaN(date.getTime())) {
        errors.push("Invalid date format");
      }
    }

    // At least one of activity_id or homest_id should be present
    if (!data.activity_id && !data.homest_id && !data.operator_activity_id) {
      errors.push(
        "Either activity_id, operator_activity_id, or homest_id is required",
      );
    }

    return new ValidationResult(errors.length === 0, errors);
  }

  /**
   * Sanitize form data
   * @param {object} data - Raw form data
   * @returns {object} Sanitized data
   */
  sanitizeData(data) {
    const sanitized = {};

    // Sanitize string fields
    if (data.receipt_id) {
      sanitized.receipt_id = sanitizeString(data.receipt_id);
    }

    if (data.citizenship) {
      sanitized.citizenship = sanitizeString(data.citizenship);
    }

    if (data.activity_name) {
      sanitized.activity_name = sanitizeString(data.activity_name);
    }

    if (data.homest_name) {
      sanitized.homest_name = sanitizeString(data.homest_name);
    }

    if (data.location) {
      sanitized.location = sanitizeString(data.location);
    }

    if (data.package) {
      sanitized.package = sanitizeString(data.package);
    }

    if (data.issuer) {
      sanitized.issuer = sanitizeString(data.issuer);
    }

    // Copy numeric and ID fields directly
    const directCopyFields = [
      "tourist_user_id",
      "operator_user_id",
      "pax",
      "activity_id",
      "operator_activity_id",
      "homest_id",
      "total_rm",
      "total_night",
      "date",
      "activity_booking_id",
      "accommodation_booking_id",
    ];

    directCopyFields.forEach((field) => {
      if (data[field] !== undefined && data[field] !== null) {
        sanitized[field] = data[field];
      }
    });

    return sanitized;
  }
}

// Export singleton instance
const formValidator = new FormValidator();

module.exports = {
  formValidator,
  ValidationResult,
};
