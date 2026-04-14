const bcrypt = require("bcrypt");
const TouristUser = require("../models/touristModel");
const authService = require("../services/authService");

// Get all active tourist users (for operator manual booking dropdown)
exports.getAllTouristUsers = async (req, res) => {
  try {
    const tourists = await TouristUser.findAll({
      where: { is_active: true },
      attributes: [
        "tourist_user_id",
        "full_name",
        "username",
        "email",
        "contact_no",
        "nationality",
      ],
      order: [["full_name", "ASC"]],
    });
    res.json({ success: true, data: tourists });
  } catch (error) {
    console.error("Error fetching tourist users:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Missing username or password" });
  }

  try {
    res.set("Deprecation", "true");
    res.set("Sunset", "Thu, 31 Dec 2026 23:59:59 GMT");
    res.set("Link", "</api/auth/login>; rel=\"successor-version\"");

    const authResult = await authService.login({
      identifier: username,
      password,
      allowedUserTypes: ["tourist"],
    });

    const user = await TouristUser.findByPk(authResult.user.id);

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }

    const userData = {
      tourist_user_id: user.tourist_user_id,
      username: user.username,
      full_name: user.full_name,
      user_email: user.email,
      nationality: user.nationality || "",
      contact_no: user.contact_no,
      profileImage: user.profileImage || null,
      role: authResult.user.role?.name || "tourist",
      permissions: authResult.user.permissions,
      is_active: user.is_active,
    };

    res.json({
      success: true,
      message: "Login successful",
      deprecated: true,
      migrate_to: "/api/auth/login",
      token: authResult.token,
      user: userData,
    });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// Suspend a tourist user for 3 days
// exports.suspendTouristUser = async (req, res) => {
//   const { id } = req.params;
//   try {
//     const [updatedRows] = await TouristUser.update(
//       {
//         is_active: false,
//         suspended_at: new Date(),
//       },
//       { where: { tourist_user_id: id } },
//     );

//     if (updatedRows === 0) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     res.status(200).json({ message: "User suspended successfully for 3 days" });
//   } catch (error) {
//     console.error("Error suspending user:", error);
//     res.status(500).json({ message: "Failed to suspend user" });
//   }
// };

// exports.login = async (req, res) => {
//   const { username, password } = req.body;
//   if (!username || !password) {
//     return res.status(400).json({ success: false, message: 'Missing username or password' });
//   }
//   try {
//     const user = await TouristUser.findOne({ where: { username } });
//     if (!user) {
//       return res.status(401).json({ success: false, message: 'Invalid username or password' });
//     }

//     // Compare hashed password using bcrypt.compare
//     const isValidPassword = await bcrypt.compare(password, user.password);
//     if (!isValidPassword) {
//       return res.status(401).json({ success: false, message: 'Invalid username or password' });
//     }

//     // Optional: Generate a JWT token here if needed

//     res.json({ success: true, message: 'Login successful', userId: user.tourist_user_id });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// };

// exports.login = async (req, res) => {
//   const { username, password } = req.body;
//   if (!username || !password) {
//     return res.status(400).json({ success: false, message: 'Missing username or password' });
//   }
//   try {
//     const user = await TouristUser.findOne({ where: { username } });
//     if (!user || user.password !== password) {
//       return res.status(401).json({ success: false, message: 'Invalid username or password' });
//     }
//     res.json({ success: true, message: 'Login successful' });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// };

// Suspend a tourist user
exports.suspendTouristUser = async (req, res) => {
  const { id } = req.params;

  try {
    // Set both is_active and suspended_at
    const [updatedRows] = await TouristUser.update(
      {
        is_active: false,
        suspended_at: new Date(), // ✅ fill suspension date
      },
      { where: { tourist_user_id: id } },
    );

    if (updatedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "User suspended successfully for 3 days",
      suspended_at: new Date(), // optional: return the date to frontend
    });
  } catch (error) {
    console.error("Error suspending user:", error);
    res.status(500).json({ message: "Failed to suspend user" });
  }
};

exports.registerTourist = async (req, res) => {
  try {
    const registerResult = await authService.register({
      userType: "tourist",
      payload: req.body,
    });

    return res.status(201).json({
      message: "Tourist account successfully created!",
      user: registerResult.user,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message || "Server error during registration.",
    });
  }
};
