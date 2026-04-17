const express = require("express");
const router = express.Router();
const passwordResetController = require("../controllers/passwordResetController");
const {
  validateForgotPassword,
  validateResetPassword,
} = require("../middleware/validation");

router.post(
  "/forgot-password",
  validateForgotPassword,
  passwordResetController.forgotPassword,
);

router.post(
  "/reset-password",
  validateResetPassword,
  passwordResetController.resetPassword,
);

module.exports = router;
