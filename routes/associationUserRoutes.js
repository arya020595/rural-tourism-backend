const express = require("express");
const router = express.Router();
const AssociationUser = require("../models/associationUserModel");
const associationController = require("../controllers/associationUserController");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Get all
router.get("/", associationController.getAllAssociationUsers);

// Get by ID
router.get("/:id", associationController.getAssociationUserById);

// Create
router.post("/", associationController.createAssociationUser);

// Update
router.put("/:id", associationController.updateAssociationUser);

// Delete
router.delete("/:id", associationController.deleteAssociationUser);

// 🔐 LOGIN ROUTE (important for your Ionic app)
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await AssociationUser.findOne({ where: { username } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    let isDefaultPassword = false;
    let isValidPassword = false;

    // 🔹 Option 2: plain text comparison for default password
    if (user.default_password && password === user.default_password) {
      isValidPassword = true;
      isDefaultPassword = true;
    }

    // 🔹 Normal password check with bcrypt
    if (!isValidPassword) {
      const matchNormal = await bcrypt.compare(password, user.password);
      if (matchNormal) {
        isValidPassword = true;
      }
    }

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        association_id: user.association_id,
      },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "24h" },
    );

    res.json({
      success: true,
      message: "Login successful",
      isDefaultPassword,
      token,
      user: {
        id: user.id,
        association_id: user.association_id,
        username: user.username,
        email: user.user_email,
        full_name: user.full_name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});
module.exports = router;
