const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const upload = require("../middleware/uploadLogo");
const { authenticate } = require("../middleware/auth");
const { authorize, authorizeOwnership } = require("../middleware/authorize");
const { asyncHandler } = require("../utils/helpers");
const { ransackMiddleware } = require("../middleware/ransackSearch");
const {
  validateCreateUser,
  validateUpdateUser,
} = require("../validators/userValidator");

const operatorUploadFields = upload.fields([
  { name: "operator_logo_image", maxCount: 1 },
  { name: "motac_license_file", maxCount: 1 },
  { name: "trading_operation_license", maxCount: 1 },
  { name: "homestay_certificate", maxCount: 1 },
]);

// List users (with search, filter, sort, pagination)
router.get(
  "/",
  authenticate,
  authorize("user:read"),
  ransackMiddleware,
  asyncHandler(userController.getAllUsers),
);

// Get user by ID
router.get(
  "/:id(\\d+)",
  authenticate,
  authorize(["user:read", "profile:read"]),
  authorizeOwnership("id", ["user:read"]),
  asyncHandler(userController.getUserById),
);

// Create user (authenticated — operator_admin or superadmin)
router.post(
  "/",
  authenticate,
  authorize("user:create"),
  operatorUploadFields,
  validateCreateUser,
  asyncHandler(userController.createUser),
);

// Update user (handles both user fields and company/file uploads)
router.put(
  "/:id",
  authenticate,
  authorize(["user:update", "profile:update"]),
  authorizeOwnership("id", ["user:update"]),
  operatorUploadFields,
  validateUpdateUser,
  asyncHandler(userController.updateUser),
);

// Delete user
router.delete(
  "/:id",
  authenticate,
  authorize("user:delete"),
  asyncHandler(userController.deleteUser),
);

module.exports = router;
