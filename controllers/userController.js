const { Op } = require("sequelize"); // For search queries
const bcrypt = require("bcrypt");
const { User, Association } = require("../models");

const DEFAULT_LOGO = "/uploads/default-logo.png";

function getLogoUrl(logoFileName) {
  if (!logoFileName) return DEFAULT_LOGO;
  if (logoFileName.startsWith("data:")) return logoFileName;
  return logoFileName;
}

function toBase64DataUri(file) {
  if (!file || !file.buffer) return null;
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
}

function parseNullableInt(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parsePoscode(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  if (!/^\d{5}$/.test(normalized)) return null;
  return normalized;
}

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    const usersWithLogo = users.map((user) => ({
      ...user.toJSON(),
      company_logo: getLogoUrl(user.company_logo),
    }));
    res.json(usersWithLogo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query error." });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: [
        "user_id",
        "company_logo",
        "user_email",
        "username",
        "full_name",
      ],
      include: [
        {
          model: Association,
          as: "association",
          required: false,
        },
      ],
    });
    if (!user) return res.status(404).json({ message: "User not found." });

    const userWithLogo = {
      ...user.toJSON(),
      // company_logo: getLogoUrl(user.company_logo)
    };

    res.json(userWithLogo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query error." });
  }
};

// Create a new user
exports.createUser = async (req, res) => {
  const {
    username,
    user_email,
    email_address,
    full_name,
    owner_full_name,
    password,
    confirmed_password,
    business_name,
    associationId,
    business_address,
    poscode,
    location,
    contact_no,
    no_of_full_time_staff,
    no_of_part_time_staff,
  } = req.body;

  try {
    if (!username || !String(username).trim()) {
      return res.status(400).json({ error: "Username is required." });
    }

    const normalizedEmail = (user_email || email_address || "").trim();
    if (!normalizedEmail) {
      return res.status(400).json({ error: "Email address is required." });
    }

    if (!owner_full_name && !full_name) {
      return res.status(400).json({ error: "Owner full name is required." });
    }

    const normalizedPoscode = String(poscode || "").trim();
    if (!/^\d{5}$/.test(normalizedPoscode)) {
      return res
        .status(400)
        .json({ error: "Poscode must be exactly 5 digits." });
    }

    const existingUserByUsername = await User.findOne({ where: { username } });
    if (existingUserByUsername) {
      return res.status(409).json({ error: "Username already exists." });
    }

    const existingUserByEmail = await User.findOne({
      where: { user_email: normalizedEmail },
    });
    if (existingUserByEmail) {
      return res.status(409).json({ error: "Email address already exists." });
    }

    if (!password) {
      return res.status(400).json({ error: "Password is required." });
    }

    if (
      (confirmed_password || req.body.confPass) &&
      password !== (confirmed_password || req.body.confPass)
    ) {
      return res
        .status(400)
        .json({ error: "Password and confirm password do not match." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const logoFile =
      req.files?.operator_logo_image?.[0] ||
      req.files?.company_logo?.[0] ||
      null;
    const motacFile = req.files?.motac_license_file?.[0] || null;
    const tradingOperationFile =
      req.files?.trading_operation_license?.[0] || null;
    const homestayFile = req.files?.homestay_certificate?.[0] || null;

    const newUser = await User.create({
      username,
      user_email: normalizedEmail,
      full_name: full_name || owner_full_name,
      password: hashedPassword,
      confirmed_password: hashedPassword,
      business_name: business_name || null,
      business_address: business_address || null,
      poscode: parsePoscode(poscode),
      location: location || null,
      contact_no: contact_no || null,
      no_of_full_time_staff: parseNullableInt(no_of_full_time_staff),
      no_of_part_time_staff: parseNullableInt(no_of_part_time_staff),
      company_logo: toBase64DataUri(logoFile),
      motac_license_file: toBase64DataUri(motacFile),
      trading_operation_license: toBase64DataUri(tradingOperationFile),
      homestay_certificate: toBase64DataUri(homestayFile),
      associationId,
    });

    res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    if (err.name === "SequelizeUniqueConstraintError") {
      return res
        .status(409)
        .json({ error: "Username or email address already exists." });
    }

    if (err.name === "SequelizeForeignKeyConstraintError") {
      return res.status(400).json({ error: "Invalid association selected." });
    }

    if (err.name === "SequelizeValidationError") {
      return res
        .status(400)
        .json({ error: err.errors?.[0]?.message || "Validation failed." });
    }

    res.status(500).json({ error: "Server error. Please try again later." });
  }
};

// exports.createUser = async (req, res) => {
//     const { username, user_email, full_name, password, securityQ1, securityQ2, business_name } = req.body;

//     try {
//         // Check if username/email already exists
//         if (await User.findOne({ where: { username } })) {
//             return res.status(400).json({ error: 'Username is already taken!' });
//         }
//         if (await User.findOne({ where: { user_email } })) {
//             return res.status(400).json({ error: 'Email is already taken!' });
//         }

//         // Hash the password
//         const hashedPassword = await bcrypt.hash(password, 10);

//         // Set logo filename or default
//         const logoPath = req.file ? req.file.filename : '';

//         // Create user
//         const newUser = await User.create({
//             username,
//             user_email,
//             full_name,
//             password: hashedPassword,
//             securityQ1: securityQ1 || null,
//             securityQ2: securityQ2 || null,
//             business_name: business_name || null,
//             company_logo: logoPath
//         });

//         // Return user with logo URL
//         const userWithLogo = {
//             ...newUser.toJSON(),
//             company_logo: getLogoUrl(newUser.company_logo)
//         };

//         res.status(201).json(userWithLogo);

//     } catch (err) {
//         console.error('Error creating user:', err);
//         res.status(500).json({ error: 'Database query error.' });
//     }
// };

// Update user
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (req.body.password) {
      if (
        (req.body.confirmed_password || req.body.confPass) &&
        req.body.password !== (req.body.confirmed_password || req.body.confPass)
      ) {
        return res
          .status(400)
          .json({ error: "Password and confirm password do not match." });
      }
      req.body.password = await bcrypt.hash(req.body.password, 10);
      req.body.confirmed_password = req.body.password;
    }

    const logoFile =
      req.files?.operator_logo_image?.[0] ||
      req.files?.company_logo?.[0] ||
      null;
    const motacFile = req.files?.motac_license_file?.[0] || null;
    const tradingOperationFile =
      req.files?.trading_operation_license?.[0] || null;
    const homestayFile = req.files?.homestay_certificate?.[0] || null;

    if (logoFile) req.body.company_logo = toBase64DataUri(logoFile);
    if (motacFile) req.body.motac_license_file = toBase64DataUri(motacFile);
    if (tradingOperationFile)
      req.body.trading_operation_license =
        toBase64DataUri(tradingOperationFile);
    if (homestayFile)
      req.body.homestay_certificate = toBase64DataUri(homestayFile);

    if (req.body.no_of_full_time_staff !== undefined) {
      req.body.no_of_full_time_staff = parseNullableInt(
        req.body.no_of_full_time_staff,
      );
    }

    if (req.body.poscode !== undefined) {
      const parsedPoscode = parsePoscode(req.body.poscode);
      if (req.body.poscode !== "" && parsedPoscode === null) {
        return res
          .status(400)
          .json({ error: "Poscode must be exactly 5 digits." });
      }
      req.body.poscode = parsedPoscode;
    }

    if (req.body.no_of_part_time_staff !== undefined) {
      req.body.no_of_part_time_staff = parseNullableInt(
        req.body.no_of_part_time_staff,
      );
    }

    if (req.body.email_address && !req.body.user_email) {
      req.body.user_email = req.body.email_address;
    }

    if (req.body.owner_full_name && !req.body.full_name) {
      req.body.full_name = req.body.owner_full_name;
    }

    await user.update(req.body);

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query error." });
  }
};

// exports.updateUser = async (req, res) => {
//     try {
//         const user = await User.findByPk(req.params.id);
//         if (!user) return res.status(404).json({ message: 'User not found.' });

//         // Optionally update password if provided
//         if (req.body.password) {
//             req.body.password = await bcrypt.hash(req.body.password, 10);
//         }

//         await user.update(req.body);

//         const updatedUser = {
//             ...user.toJSON(),
//             company_logo: getLogoUrl(user.company_logo)
//         };

//         res.json(updatedUser);
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: 'Database query error.' });
//     }
// };

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    await user.destroy();
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query error." });
  }
};

// Search users by name
exports.searchUsers = async (req, res) => {
  const { name } = req.query;
  try {
    const users = await User.findAll({
      where: {
        full_name: { [Op.like]: `%${name}%` },
      },
    });
    const usersWithLogo = users.map((user) => ({
      ...user.toJSON(),
      company_logo: getLogoUrl(user.company_logo),
    }));
    res.json(usersWithLogo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query error." });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  return res.status(410).json({
    error:
      "Security-question password reset is no longer supported for operator accounts.",
  });
};
