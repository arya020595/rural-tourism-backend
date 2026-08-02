const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;
const YYYY_MM = /^\d{4}-\d{2}$/;

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
  validateTodayQuery(query = {}) {
    const errors = [];
    const { date } = query;

    if (date !== undefined && date !== null && date !== "") {
      if (!YYYY_MM_DD.test(String(date))) {
        errors.push("date must be a valid date in YYYY-MM-DD format");
      }
    }

    return new ValidationResult(errors.length === 0, errors);
  }

  validateTrendQuery(query = {}) {
    const errors = [];
    const { from, to } = query;

    if (!from) {
      errors.push("from is required");
    } else if (!YYYY_MM.test(String(from))) {
      errors.push("from must be in YYYY-MM format");
    }

    if (!to) {
      errors.push("to is required");
    } else if (!YYYY_MM.test(String(to))) {
      errors.push("to must be in YYYY-MM format");
    }

    return new ValidationResult(errors.length === 0, errors);
  }
}

module.exports = {
  dashboardValidator: new DashboardValidator(),
  ValidationResult,
};
