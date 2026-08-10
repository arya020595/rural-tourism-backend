const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { authenticate } = require("../middleware/auth");
const { authorize, authorizeOwnership } = require("../middleware/authorize");
const { asyncHandler } = require("../utils/helpers");
const { ransackMiddleware } = require("../middleware/ransackSearch");
const {
  validateCreateUser,
  validateUpdateUser,
} = require("../validators/userValidator");

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
  validateCreateUser,
  asyncHandler(userController.createUser),
);

// Update user (handles both user fields and company/file uploads)
router.put(
  "/:id",
  authenticate,
  authorize(["user:update", "profile:update"]),
  authorizeOwnership("id", ["user:update"]),
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

// Request deletion of own account — strictly self-service. No bypass
// permissions: operator_admin holds user:delete (for managing its own
// staff via DELETE /users/:id), but that must not let it file a deletion
// *request* on another user's behalf. Only the account owner, or
// superadmin (via authorizeOwnership's built-in role check), may call this.
router.patch(
  "/:id/request-deletion",
  authenticate,
  authorize(["user:update", "profile:update"]),
  authorizeOwnership("id"),
  asyncHandler(userController.requestDeletion),
);

// Admin: reject a pending deletion request
router.patch(
  "/:id/reject-deletion",
  authenticate,
  authorize("user:delete"),
  asyncHandler(userController.rejectDeletion),
);

module.exports = router;
