const bcrypt = require("bcrypt");
const TouristUser = require("../models/touristModel");

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Missing username or password" });
  }

  try {
    const user = await TouristUser.findOne({ where: { username } });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }

    if (!user.is_active) {
      if (user.suspended_at) {
        const now = new Date();
        const suspendedAt = new Date(user.suspended_at);
        const diffDays = Math.floor(
          (now - suspendedAt) / (1000 * 60 * 60 * 24),
        );

        if (diffDays >= 3) {
          // Reactivate the user automatically after 3 days
          await user.update({ is_active: true, suspended_at: null });
        } else {
          const daysLeft = 3 - diffDays;
          return res.status(403).json({
            success: false,
            message: `Your account is suspended. Please try again in ${daysLeft} day(s).`,
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: "Your account is suspended. Please contact support.",
        });
      }
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
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
      role: user.role,
      is_active: user.is_active,
    };

    res.json({ success: true, message: "Login successful", user: userData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
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
    const { username, email, password, full_name, contact_no, nationality } =
      req.body;

    if (
      !username ||
      !email ||
      !password ||
      !full_name ||
      !contact_no ||
      !nationality
    ) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Check for duplicates
    const existingUser = await TouristUser.findOne({ where: { username } });
    if (existingUser)
      return res.status(400).json({ error: "Username already taken." });

    const existingEmail = await TouristUser.findOne({ where: { email } });
    if (existingEmail)
      return res.status(400).json({ error: "Email already registered." });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new tourist
    const newUser = await TouristUser.create({
      username,
      email,
      password: hashedPassword,
      full_name,
      contact_no,
      nationality,
      role: "tourist",
      is_active: true,
    });

    return res.status(201).json({
      message: "Tourist account successfully created!",
      user: newUser,
    });
  } catch (error) {
    console.error("Error registering tourist:", error);
    res.status(500).json({ error: "Server error during registration." });
  }
};
