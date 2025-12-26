/**
 * Input validation middleware using express-validator patterns
 */

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  const phoneRegex = /^[\d\s\-\+\(\)]{8,20}$/;
  return phoneRegex.test(phone);
};

const validatePassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
};

const sanitizeString = (str) => {
  if (typeof str !== "string") return str;
  return str.trim().replace(/[<>]/g, "");
};

/**
 * Validation middleware for user registration
 */
const validateUserRegistration = (req, res, next) => {
  const { username, user_email, password, full_name } = req.body;
  const errors = [];

  if (!username || username.length < 3) {
    errors.push("Username must be at least 3 characters");
  }

  if (!user_email || !validateEmail(user_email)) {
    errors.push("Valid email is required");
  }

  if (!password || password.length < 6) {
    errors.push("Password must be at least 6 characters");
  }

  if (!full_name || full_name.length < 2) {
    errors.push("Full name is required");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  // Sanitize inputs
  req.body.username = sanitizeString(username);
  req.body.full_name = sanitizeString(full_name);
  req.body.user_email = user_email.toLowerCase().trim();

  next();
};

/**
 * Validation middleware for booking
 */
const validateBooking = (req, res, next) => {
  const { tourist_user_id, activity_id, no_of_pax, date, total_price } =
    req.body;
  const errors = [];

  if (!tourist_user_id) errors.push("Tourist user ID is required");
  if (!activity_id) errors.push("Activity ID is required");
  if (!no_of_pax || no_of_pax < 1)
    errors.push("Number of pax must be at least 1");
  if (!date) errors.push("Date is required");
  if (!total_price || total_price <= 0)
    errors.push("Valid total price is required");

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  next();
};

module.exports = {
  validateEmail,
  validatePhone,
  validatePassword,
  sanitizeString,
  validateUserRegistration,
  validateBooking,
};
