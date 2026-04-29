const { isValidDate } = require("../utils/normalizers");

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

class DashboardValidator {
  validateTrendQuery(query = {}) {
    const errors = [];
    const { start, end } = query;

    if (!start) {
      errors.push("start is required");
    } else if (!isValidDate(start)) {
      errors.push("start must be a valid date");
    }

    if (!end) {
      errors.push("end is required");
    } else if (!isValidDate(end)) {
      errors.push("end must be a valid date");
    }

    return new ValidationResult(errors.length === 0, errors);
  }
}

module.exports = {
  dashboardValidator: new DashboardValidator(),
  ValidationResult,
};
