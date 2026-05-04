const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

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
    } else if (!YYYY_MM_DD.test(start)) {
      errors.push("start must be a valid date in YYYY-MM-DD format");
    }

    if (!end) {
      errors.push("end is required");
    } else if (!YYYY_MM_DD.test(end)) {
      errors.push("end must be a valid date in YYYY-MM-DD format");
    }

    return new ValidationResult(errors.length === 0, errors);
  }
}

module.exports = {
  dashboardValidator: new DashboardValidator(),
  ValidationResult,
};
