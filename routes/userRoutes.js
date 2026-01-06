const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const upload = require("../middleware/uploadLogo");

// Middleware for error handling
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Route to get all users
router.get("/", async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error); // Log the full error
    res.status(500).json({ error: error.message }); // Send back the error message
  }
});

// Route to get a user by ID
router.get("/:id", asyncHandler(userController.getUserById));

// // Route to create a new user
// router.post('/', asyncHandler(userController.createUser));
router.post(
  "/",
  upload.single("company_logo"),
  asyncHandler(userController.createUser)
);

// Route to update an existing user
router.put("/:id", upload.single("company_logo"), userController.updateUser);
//router.put('/:id', asyncHandler(userController.updateUser));

// Route to delete a user
router.delete("/:id", asyncHandler(userController.deleteUser));

// Route to search users by name (optional)
router.get("/search", asyncHandler(userController.searchUsers));

// Create user route with file upload
//router.post('/create', upload.single('company_logo'), userController.createUser);

// Update user route with file upload (optional)
router.put(
  "/update/:id",
  upload.single("company_logo"),
  userController.updateUser
);

// Login route
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find the user by username
    const user = await User.findOne({ where: { username } });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }

    const enteredPassword = password.trim();
    // Compare the entered password with the hashed password in the database
    const isValidPassword = await bcrypt.compare(
      enteredPassword,
      user.password
    );

    // If the password is not valid, send an error
    if (!isValidPassword) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }

    // Generate a JWT token using environment variable
    const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
    const token = jwt.sign(
      { id: user.user_id, username: user.username },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
    );

    // Send the response with the token and user data
    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.user_email,
        full_name: user.full_name,
        business_name: user.business_name,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Route to handle password reset
router.post("/reset-pass", asyncHandler(userController.resetPassword));

module.exports = router;
