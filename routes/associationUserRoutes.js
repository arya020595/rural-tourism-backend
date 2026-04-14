const express = require("express");
const router = express.Router();
const AssociationUser = require("../models/associationUserModel");
const associationController = require("../controllers/associationUserController");
const authService = require("../services/authService");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

// Get all
router.get(
  "/",
  authenticate,
  authorize("association:manage_users"),
  associationController.getAllAssociationUsers,
);

// Get by ID
router.get(
  "/:id",
  authenticate,
  authorize("association:manage_users"),
  associationController.getAssociationUserById,
);

// Create
router.post(
  "/",
  authenticate,
  authorize("association:manage_users"),
  associationController.createAssociationUser,
);

// Update
router.put(
  "/:id",
  authenticate,
  authorize("association:manage_users"),
  associationController.updateAssociationUser,
);

// Delete
router.delete(
  "/:id",
  authenticate,
  authorize("association:manage_users"),
  associationController.deleteAssociationUser,
);

// 🔐 LOGIN ROUTE (important for your Ionic app)
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    res.set("Deprecation", "true");
    res.set("Sunset", "Thu, 31 Dec 2026 23:59:59 GMT");
    res.set("Link", "</api/auth/login>; rel=\"successor-version\"");

    const authResult = await authService.login({
      identifier: username,
      password,
      allowedUserTypes: ["association"],
    });

    const user = await AssociationUser.findByPk(authResult.user.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const isDefaultPassword = Boolean(
      user && user.default_password && password === user.default_password,
    );

    res.json({
      success: true,
      message: "Login successful",
      deprecated: true,
      migrate_to: "/api/auth/login",
      isDefaultPassword,
      token: authResult.token,
      user: {
        id: user.id,
        association_id: user.association_id,
        username: user.username,
        email: user.user_email,
        full_name: user.full_name,
        role: authResult.user.role,
        permissions: authResult.user.permissions,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});
module.exports = router;
