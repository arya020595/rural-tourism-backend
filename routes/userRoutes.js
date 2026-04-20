const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const UnifiedUser = require("../models/unifiedUserModel");
const Company = require("../models/companyModel");
const upload = require("../middleware/uploadLogo");
const authService = require("../services/authService");
const { authenticate } = require("../middleware/auth");
const { authorize, authorizeOwnership } = require("../middleware/authorize");

const operatorRegistrationUploadFields = upload.fields([
  { name: "operator_logo_image", maxCount: 1 },
  { name: "motac_license_file", maxCount: 1 },
  { name: "trading_operation_license", maxCount: 1 },
  { name: "homestay_certificate", maxCount: 1 },
]);

// Middleware for error handling
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Route to get all users
router.get(
  "/",
  authenticate,
  authorize("user:read"),
  asyncHandler(userController.getAllUsers),
);

// Route to get a user by ID
router.get(
  "/:id(\\d+)",
  authenticate,
  authorize(["user:read", "profile:read"]),
  authorizeOwnership("id", ["user:read"]),
  asyncHandler(userController.getUserById),
);

// // Route to create a new user
// router.post('/', asyncHandler(userController.createUser));
router.post(
  "/",
  operatorRegistrationUploadFields,
  asyncHandler(userController.createUser),
);

// Route to update an existing user
router.put(
  "/:id",
  authenticate,
  authorize(["user:update", "profile:update"]),
  authorizeOwnership("id", ["user:update"]),
  asyncHandler(userController.updateUser),
);

// Route to delete a user
router.delete(
  "/:id",
  authenticate,
  authorize("user:delete"),
  asyncHandler(userController.deleteUser),
);

// Route to search users by name (optional)
router.get(
  "/search",
  authenticate,
  authorize("user:read"),
  asyncHandler(userController.searchUsers),
);

// Legacy update user route with file upload (operator profile flow)
router.put(
  "/update/:id",
  authenticate,
  authorize(["user:update", "profile:update"]),
  authorizeOwnership("id", ["user:update"]),
  operatorRegistrationUploadFields,
  userController.updateUserLegacy,
);

// Login route
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    res.set("Deprecation", "true");
    res.set("Sunset", "Thu, 31 Dec 2026 23:59:59 GMT");
    res.set("Link", '</api/auth/login>; rel="successor-version"');

    const authResult = await authService.login({
      identifier: username,
      password,
      allowedUserTypes: ["operator"],
    });

    const user = await UnifiedUser.findByPk(authResult.user.id, {
      include: [
        {
          model: Company,
          as: "company",
          required: false,
        },
      ],
    });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }

    // Send the response with the token and user data
    res.json({
      success: true,
      message: "Login successful",
      deprecated: true,
      migrate_to: "/api/auth/login",
      token: authResult.token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.name,
        business_name: user.company?.company_name || null,
        company_logo: user.company?.operator_logo_image || null,
        role: authResult.user.role,
        permissions: authResult.user.permissions,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

// Route to handle password reset
router.post("/reset-pass", asyncHandler(userController.resetPassword));

module.exports = router;
