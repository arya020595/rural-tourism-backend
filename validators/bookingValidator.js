const {
  normalizeString,
  normalizeInt,
  normalizeNumber,
  isValidDate,
} = require("../utils/normalizers");

const ALLOWED_BOOKING_TYPES = ["activity", "accommodation", "package"];

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

class BookingValidator {
  validateCreate(data) {
    const errors = [];

    const bookingType = normalizeString(data.booking_type).toLowerCase();
    if (!bookingType) {
      errors.push("booking_type is required");
    } else if (!ALLOWED_BOOKING_TYPES.includes(bookingType)) {
      errors.push(
        `booking_type must be one of: ${ALLOWED_BOOKING_TYPES.join(", ")}`,
      );
    }

    if (!normalizeString(data.tourist_full_name)) {
      errors.push("tourist_full_name is required");
    }

    if (!normalizeString(data.citizenship)) {
      errors.push("citizenship is required");
    }

    const paxAntarbangsa = normalizeInt(data.no_of_pax_antarbangsa);
    if (paxAntarbangsa === null || paxAntarbangsa < 0) {
      errors.push("no_of_pax_antarbangsa must be integer >= 0");
    }

    const paxDomestik = normalizeInt(data.no_of_pax_domestik);
    if (paxDomestik === null || paxDomestik < 0) {
      errors.push("no_of_pax_domestik must be integer >= 0");
    }

    const totalPrice = normalizeNumber(data.total_price);
    if (totalPrice === null || totalPrice < 0) {
      errors.push("total_price must be numeric and >= 0");
    }

    if (bookingType === "activity") {
      if (normalizeInt(data.product_id) === null) {
        errors.push("product_id is required for activity booking");
      }

      if (!normalizeString(data.product_name)) {
        errors.push("product_name is required for activity booking");
      }

      if (!isValidDate(data.activity_date)) {
        errors.push("activity_date is required and must be valid");
      }
    }

    if (bookingType === "accommodation") {
      if (normalizeInt(data.product_id) === null) {
        errors.push("product_id is required for accommodation booking");
      }

      if (!normalizeString(data.product_name)) {
        errors.push("product_name is required for accommodation booking");
      }

      if (!isValidDate(data.check_in_date)) {
        errors.push("check_in_date is required and must be valid");
      }

      if (!isValidDate(data.check_out_date)) {
        errors.push("check_out_date is required and must be valid");
      }
    }

    if (bookingType === "package") {
      if (!Array.isArray(data.package_companies) || data.package_companies.length === 0) {
        errors.push("package_companies is required for package booking");
      }
    }

    if (
      data.receipt_created_at !== undefined &&
      data.receipt_created_at !== null &&
      data.receipt_created_at !== "" &&
      !isValidDate(data.receipt_created_at)
    ) {
      errors.push("receipt_created_at must be a valid timestamp");
    }

    return new ValidationResult(errors.length === 0, errors);
  }

  validateUpdate(data) {
    const errors = [];

    if (
      data.booking_type !== undefined &&
      !ALLOWED_BOOKING_TYPES.includes(normalizeString(data.booking_type).toLowerCase())
    ) {
      errors.push(
        `booking_type must be one of: ${ALLOWED_BOOKING_TYPES.join(", ")}`,
      );
    }

    if (data.no_of_pax_antarbangsa !== undefined) {
      const value = normalizeInt(data.no_of_pax_antarbangsa);
      if (value === null || value < 0) {
        errors.push("no_of_pax_antarbangsa must be integer >= 0");
      }
    }

    if (data.no_of_pax_domestik !== undefined) {
      const value = normalizeInt(data.no_of_pax_domestik);
      if (value === null || value < 0) {
        errors.push("no_of_pax_domestik must be integer >= 0");
      }
    }

    if (data.total_price !== undefined && data.total_price !== null && data.total_price !== "") {
      const value = normalizeNumber(data.total_price);
      if (value === null || value < 0) {
        errors.push("total_price must be numeric and >= 0");
      }
    }

    if (data.product_id !== undefined && data.product_id !== null && data.product_id !== "" && normalizeInt(data.product_id) === null) {
      errors.push("product_id must be integer");
    }

    if (data.total_of_night !== undefined && data.total_of_night !== null && data.total_of_night !== "") {
      const totalOfNight = normalizeInt(data.total_of_night);
      if (totalOfNight === null || totalOfNight < 0) {
        errors.push("total_of_night must be integer >= 0");
      }
    }

    if (
      data.activity_date !== undefined &&
      data.activity_date !== null &&
      data.activity_date !== "" &&
      !isValidDate(data.activity_date)
    ) {
      errors.push("activity_date must be a valid timestamp");
    }

    if (
      data.check_in_date !== undefined &&
      data.check_in_date !== null &&
      data.check_in_date !== "" &&
      !isValidDate(data.check_in_date)
    ) {
      errors.push("check_in_date must be a valid date");
    }

    if (
      data.check_out_date !== undefined &&
      data.check_out_date !== null &&
      data.check_out_date !== "" &&
      !isValidDate(data.check_out_date)
    ) {
      errors.push("check_out_date must be a valid date");
    }

    if (
      data.receipt_created_at !== undefined &&
      data.receipt_created_at !== null &&
      data.receipt_created_at !== "" &&
      !isValidDate(data.receipt_created_at)
    ) {
      errors.push("receipt_created_at must be a valid timestamp");
    }

    if (data.package_companies !== undefined && !Array.isArray(data.package_companies)) {
      errors.push("package_companies must be an array");
    }

    return new ValidationResult(errors.length === 0, errors);
  }
}

module.exports = {
  bookingValidator: new BookingValidator(),
  ValidationResult,
};
