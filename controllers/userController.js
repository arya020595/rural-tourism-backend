const { Op } = require("sequelize"); // For search queries
const bcrypt = require("bcrypt");
const { User, Association, Company } = require("../models");
const authService = require("../services/authService");

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

function serializeUnifiedUser(user) {
  const company = user?.company || null;

  return {
    id: user.id,
    user_id: user.id,
    username: user.username,
    user_email: user.email,
    email_address: user.email,
    full_name: user.name,
    owner_full_name: user.name,
    business_name: company?.company_name || null,
    business_address: company?.address || null,
    location: company?.location || null,
    poscode: company?.postcode || null,
    contact_no: company?.contact_no || null,
    no_of_full_time_staff: company?.total_fulltime_staff || null,
    no_of_part_time_staff: company?.total_partime_staff || null,
    company_logo: getLogoUrl(company?.operator_logo_image),
    motac_license_file: company?.motac_license_file || null,
    trading_operation_license: company?.trading_operation_license || null,
    homestay_certificate: company?.homestay_certificate || null,
    association_id: user.association_id || null,
    role_id: user.role_id || null,
    company_id: user.company_id || null,
    association: user.association || null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      include: [
        {
          model: Association,
          as: "association",
          required: false,
        },
        {
          model: Company,
          as: "company",
          required: false,
        },
      ],
      order: [["id", "ASC"]],
    });

    res.json(users.map((user) => serializeUnifiedUser(user)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query error." });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [
        {
          model: Association,
          as: "association",
          required: false,
        },
        {
          model: Company,
          as: "company",
          required: false,
        },
      ],
    });
    if (!user) return res.status(404).json({ message: "User not found." });

    res.json(serializeUnifiedUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query error." });
  }
};

// Create a new user
exports.createUser = async (req, res) => {
  try {
    const registerResult = await authService.register({
      userType: "operator",
      payload: req.body,
      files: req.files,
    });

    const createdUser = await User.findByPk(registerResult.user.id, {
      include: [
        {
          model: Association,
          as: "association",
          required: false,
        },
        {
          model: Company,
          as: "company",
          required: false,
        },
      ],
    });

    res.status(201).json(
      createdUser ? serializeUnifiedUser(createdUser) : registerResult.user,
    );
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: err.message || "Server error. Please try again later.",
    });
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
    // role_id changes are reserved for role-management flows.
    delete req.body.role_id;

    const user = await User.findByPk(req.params.id, {
      include: [
        {
          model: Company,
          as: "company",
          required: false,
        },
      ],
    });

    if (!user) return res.status(404).json({ message: "User not found." });

    const userUpdates = {};
    const companyUpdates = {};

    if (req.body.username !== undefined) {
      userUpdates.username = String(req.body.username || "").trim();
    }

    const nextEmail = req.body.user_email ?? req.body.email_address ?? req.body.email;
    if (nextEmail !== undefined) {
      userUpdates.email = String(nextEmail || "").trim();
      companyUpdates.email = String(nextEmail || "").trim();
    }

    const nextName = req.body.owner_full_name ?? req.body.full_name ?? req.body.name;
    if (nextName !== undefined) {
      userUpdates.name = String(nextName || "").trim();
    }

    const associationIdInput = req.body.association_id ?? req.body.associationId;
    if (associationIdInput !== undefined) {
      const parsedAssociationId = parseNullableInt(associationIdInput);
      if (
        associationIdInput !== "" &&
        associationIdInput !== null &&
        parsedAssociationId === null
      ) {
        return res.status(400).json({ error: "Association ID must be an integer." });
      }
      userUpdates.association_id = parsedAssociationId;
    }

    if (req.body.password) {
      if (
        (req.body.confirmed_password || req.body.confPass) &&
        req.body.password !== (req.body.confirmed_password || req.body.confPass)
      ) {
        return res
          .status(400)
          .json({ error: "Password and confirm password do not match." });
      }
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      userUpdates.password = hashedPassword;
      userUpdates.confirm_password = hashedPassword;
    }

    const logoFile =
      req.files?.operator_logo_image?.[0] ||
      req.files?.company_logo?.[0] ||
      null;
    const motacFile = req.files?.motac_license_file?.[0] || null;
    const tradingOperationFile =
      req.files?.trading_operation_license?.[0] || null;
    const homestayFile = req.files?.homestay_certificate?.[0] || null;

    if (logoFile) companyUpdates.operator_logo_image = toBase64DataUri(logoFile);
    if (motacFile) companyUpdates.motac_license_file = toBase64DataUri(motacFile);
    if (tradingOperationFile)
      companyUpdates.trading_operation_license =
        toBase64DataUri(tradingOperationFile);
    if (homestayFile)
      companyUpdates.homestay_certificate = toBase64DataUri(homestayFile);

    if (!logoFile && req.body.company_logo !== undefined) {
      companyUpdates.operator_logo_image = req.body.company_logo;
    }

    if (!motacFile && req.body.motac_license_file !== undefined) {
      companyUpdates.motac_license_file = req.body.motac_license_file;
    }

    if (
      !tradingOperationFile &&
      req.body.trading_operation_license !== undefined
    ) {
      companyUpdates.trading_operation_license = req.body.trading_operation_license;
    }

    if (!homestayFile && req.body.homestay_certificate !== undefined) {
      companyUpdates.homestay_certificate = req.body.homestay_certificate;
    }

    if (req.body.no_of_full_time_staff !== undefined) {
      companyUpdates.total_fulltime_staff = parseNullableInt(
        req.body.no_of_full_time_staff,
      );
    }

    let parsedPoscode;
    if (req.body.poscode !== undefined) {
      parsedPoscode = parsePoscode(req.body.poscode);
      if (req.body.poscode !== "" && parsedPoscode === null) {
        return res
          .status(400)
          .json({ error: "Poscode must be exactly 5 digits." });
      }
      companyUpdates.postcode = parsedPoscode;
    }

    if (req.body.no_of_part_time_staff !== undefined) {
      companyUpdates.total_partime_staff = parseNullableInt(
        req.body.no_of_part_time_staff,
      );
    }

    if (req.body.business_name !== undefined) {
      companyUpdates.company_name = req.body.business_name;
    }

    if (req.body.business_address !== undefined) {
      companyUpdates.address = req.body.business_address;
    }

    if (req.body.location !== undefined) {
      companyUpdates.location = req.body.location;
    }

    if (req.body.contact_no !== undefined) {
      companyUpdates.contact_no = req.body.contact_no;
    }

    const transaction = await User.sequelize.transaction();

    try {
      if (Object.keys(userUpdates).length > 0) {
        await user.update(userUpdates, { transaction });
      }

      let company = user.company;

      if (!company) {
        company = await Company.create(
          {
            company_name:
              companyUpdates.company_name ||
              userUpdates.name ||
              user.name ||
              user.username,
            address: companyUpdates.address || null,
            email: companyUpdates.email || userUpdates.email || user.email,
            location: companyUpdates.location || null,
            postcode:
              companyUpdates.postcode !== undefined
                ? companyUpdates.postcode
                : parsedPoscode || null,
            total_fulltime_staff:
              companyUpdates.total_fulltime_staff !== undefined
                ? companyUpdates.total_fulltime_staff
                : null,
            total_partime_staff:
              companyUpdates.total_partime_staff !== undefined
                ? companyUpdates.total_partime_staff
                : null,
            contact_no: companyUpdates.contact_no || null,
            operator_logo_image: companyUpdates.operator_logo_image || null,
            motac_license_file: companyUpdates.motac_license_file || null,
            trading_operation_license:
              companyUpdates.trading_operation_license || null,
            homestay_certificate: companyUpdates.homestay_certificate || null,
          },
          { transaction },
        );

        await user.update({ company_id: company.id }, { transaction });
      } else if (Object.keys(companyUpdates).length > 0) {
        await company.update(companyUpdates, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    const updatedUser = await User.findByPk(user.id, {
      include: [
        {
          model: Association,
          as: "association",
          required: false,
        },
        {
          model: Company,
          as: "company",
          required: false,
        },
      ],
    });

    res.json(serializeUnifiedUser(updatedUser));
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
        name: { [Op.like]: `%${name}%` },
      },
      include: [
        {
          model: Association,
          as: "association",
          required: false,
        },
        {
          model: Company,
          as: "company",
          required: false,
        },
      ],
    });
    res.json(users.map((user) => serializeUnifiedUser(user)));
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
