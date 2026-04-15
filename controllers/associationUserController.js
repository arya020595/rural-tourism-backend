const AssociationUser = require("../models/associationUserModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Get all association users
exports.getAllAssociationUsers = async (req, res) => {
  try {
    const users = await AssociationUser.findAll();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query error." });
  }
};

// Get association user by ID
exports.getAssociationUserById = async (req, res) => {
  try {
    const user = await AssociationUser.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query error." });
  }
};

// Create association user
exports.createAssociationUser = async (req, res) => {
  const { association_id, username, user_email, password, full_name } =
    req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await AssociationUser.create({
      association_id,
      username,
      user_email,
      password: hashedPassword,
      full_name,
    });

    res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query error." });
  }
};

// Update association user
exports.updateAssociationUser = async (req, res) => {
  try {
    // role_id changes are reserved for role-management flows.
    delete req.body.role_id;

    const user = await AssociationUser.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }

    await user.update(req.body);

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query error." });
  }
};

// Delete association user
exports.deleteAssociationUser = async (req, res) => {
  try {
    const user = await AssociationUser.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    await user.destroy();

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query error." });
  }
};

// LOGIN association user
exports.loginAssociationUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find user by username
    const user = await AssociationUser.findOne({ where: { username } });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }

    // Compare password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }

    // Generate JWT token
    const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "24h" },
    );

    // Return user info + token
    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        association_id: user.association_id,
        username: user.username,
        full_name: user.full_name,
        email: user.user_email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
