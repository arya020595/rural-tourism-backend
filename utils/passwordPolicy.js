const { BadRequestError } = require("../services/errors/AppError");

/**
 * Minimum length for every new password: registration (operator and
 * tourist), password reset, change password and admin-created users.
 * Existing passwords are not affected — this is only checked when a
 * password is set.
 */
const MIN_PASSWORD_LENGTH = 8;

const passwordTooShortMessage = (label = "Password") =>
  `${label} must be at least ${MIN_PASSWORD_LENGTH} characters.`;

const assertPasswordLength = (password, label = "Password") => {
  if (String(password ?? "").length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestError(passwordTooShortMessage(label));
  }
};

module.exports = {
  MIN_PASSWORD_LENGTH,
  passwordTooShortMessage,
  assertPasswordLength,
};
