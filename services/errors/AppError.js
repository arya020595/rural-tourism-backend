class AppError extends Error {
  constructor(message, statusCode = 500, code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

class TokenExpiredError extends AppError {
  constructor(message = "Reset token has expired. Please request a new one.") {
    super(message, 400, "TOKEN_EXPIRED");
    this.name = "TokenExpiredError";
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  TokenExpiredError,
};
