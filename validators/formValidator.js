/**
 * Form Validator
 * Single Responsibility: Handle all validation logic for form_responses
 * Open/Closed: Easy to extend with new validation rules
 */

/**
 * Validation result object
 */
class ValidationResult {
  constructor() {
    this.errors = [];
    this.isValid = true;
  }

  addError(field, message) {
    this.errors.push({ field, message });
    this.isValid = false;
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
 * Handles all validation rules for form creation and updates
 */
class FormValidator {
  /**
   * Validate required fields for form creation
   * @param {object} data - Request body data
   * @returns {ValidationResult}
   */
  validateCreate(data) {
    const result = new ValidationResult();

    // Required field validations
    if (!data.tourist_user_id) {
      result.addError("tourist_user_id", "Tourist user ID is required");
    }

    if (!data.operator_user_id) {
      result.addError("operator_user_id", "Operator user ID is required");
    }

    if (!data.citizenship) {
      result.addError("citizenship", "Citizenship is required");
    }

    if (!data.pax || data.pax < 1) {
      result.addError("pax", "Number of pax must be at least 1");
    }

    return result;
  }

  /**
   * Validate and sanitize numeric fields
   * @param {object} data - Request body data
   * @returns {object} Sanitized data with proper types
   */
  sanitizeData(data) {
    return {
      receipt_id: data.receipt_id || this.generateReceiptId(),
      tourist_user_id: this.toInteger(data.tourist_user_id),
      operator_user_id: this.toInteger(data.operator_user_id),
      citizenship: this.sanitizeString(data.citizenship),
      pax: this.toInteger(data.pax),
      activity_name: this.sanitizeString(data.activity_name),
      homest_name: this.sanitizeString(data.homest_name),
      location: this.sanitizeString(data.location),
      activity_id: this.toBigInt(data.activity_id),
      operator_activity_id: this.toInteger(data.operator_activity_id),
      homest_id: this.toInteger(data.homest_id),
      total_rm: data.total_rm != null ? String(data.total_rm) : null,
      total_night: data.total_night != null ? String(data.total_night) : null,
      package: data.package || null,
      issuer: this.sanitizeString(data.issuer),
      date: data.date || null,
      activity_booking_id: this.toBigInt(data.activity_booking_id),
      accommodation_booking_id: this.toBigInt(data.accommodation_booking_id),
    };
  }

  /**
   * Generate a unique receipt ID
   * @returns {string}
   */
  generateReceiptId() {
    return `PE${Math.floor(Math.random() * 10000000)
      .toString()
      .padStart(7, "0")}`;
  }

  /**
   * Convert value to integer or null
   * @param {any} value
   * @returns {number|null}
   */
  toInteger(value) {
    if (value == null || value === "") return null;
    const num = Number(value);
    return isNaN(num) ? null : Math.floor(num);
  }

  /**
   * Convert value to BigInt-compatible number or null
   * @param {any} value
   * @returns {number|null}
   */
  toBigInt(value) {
    if (value == null || value === "") return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  /**
   * Sanitize string value
   * @param {any} value
   * @returns {string|null}
   */
  sanitizeString(value) {
    if (value == null || value === "") return null;
    if (typeof value !== "string") return String(value);
    return value.trim().replace(/[<>]/g, "");
  }
}

// Export singleton instance and class
module.exports = {
  FormValidator,
  formValidator: new FormValidator(),
  ValidationResult,
};
