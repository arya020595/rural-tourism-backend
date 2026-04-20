const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const UnifiedUser = require("../models/unifiedUserModel");
const Association = require("../models/associationModel");
const Company = require("../models/companyModel");
const Role = require("../models/roleModel");
require("../models/associations");

const SALT_ROUNDS = 10;

const USER_INCLUDES = [
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
  {
    model: Role,
    as: "role",
    required: false,
  },
];

class UserService {
  /**
   * Get all users with associations.
   * @param {object} [scope={}] – Sequelize `where` clause from policy scope.
   */
  async getAllUsers(scope = {}) {
    return UnifiedUser.findAll({
      where: scope,
      include: USER_INCLUDES,
      order: [["id", "ASC"]],
    });
  }

  /**
   * Get a single user by ID
   */
  async getUserById(id) {
    const user = await UnifiedUser.findByPk(id, {
      include: USER_INCLUDES,
    });

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    return user;
  }

  /**
   * Create a new user
   */
  async createUser({
    name,
    username,
    email,
    password,
    role_id,
    association_id,
    company_id,
  }) {
    const trimmedUsername = String(username || "").trim();
    const trimmedEmail = String(email || "").trim();
    const trimmedName = String(name || "").trim();

    if (!trimmedUsername || !trimmedEmail || !trimmedName || !password) {
      const error = new Error(
        "name, username, email, and password are required",
      );
      error.statusCode = 400;
      throw error;
    }

    const existingUser = await UnifiedUser.findOne({
      where: {
        [Op.or]: [{ username: trimmedUsername }, { email: trimmedEmail }],
      },
    });

    if (existingUser) {
      const error = new Error("Username or email already exists");
      error.statusCode = 409;
      throw error;
    }

    if (role_id) {
      const role = await Role.findByPk(role_id);
      if (!role) {
        const error = new Error("Invalid role_id");
        error.statusCode = 400;
        throw error;
      }
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await UnifiedUser.create({
      name: trimmedName,
      username: trimmedUsername,
      email: trimmedEmail,
      password: hashedPassword,
      confirm_password: hashedPassword,
      role_id: role_id || null,
      association_id: association_id || null,
      company_id: company_id || null,
    });

    return this.getUserById(user.id);
  }

  /**
   * Update an existing user
   */
  async updateUser(id, updates) {
    const user = await UnifiedUser.findByPk(id);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const fields = {};

    if (updates.name !== undefined) {
      fields.name = String(updates.name).trim();
    }

    if (updates.username !== undefined) {
      const trimmed = String(updates.username).trim();
      const conflict = await UnifiedUser.findOne({
        where: { username: trimmed, id: { [Op.ne]: id } },
      });
      if (conflict) {
        const error = new Error("Username already taken");
        error.statusCode = 409;
        throw error;
      }
      fields.username = trimmed;
    }

    if (updates.email !== undefined) {
      const trimmed = String(updates.email).trim();
      const conflict = await UnifiedUser.findOne({
        where: { email: trimmed, id: { [Op.ne]: id } },
      });
      if (conflict) {
        const error = new Error("Email already taken");
        error.statusCode = 409;
        throw error;
      }
      fields.email = trimmed;
    }

    if (updates.password) {
      fields.password = await bcrypt.hash(updates.password, SALT_ROUNDS);
      fields.confirm_password = fields.password;
    }

    if (updates.role_id !== undefined) {
      if (updates.role_id !== null) {
        const role = await Role.findByPk(updates.role_id);
        if (!role) {
          const error = new Error("Invalid role_id");
          error.statusCode = 400;
          throw error;
        }
      }
      fields.role_id = updates.role_id;
    }

    if (updates.association_id !== undefined) {
      fields.association_id = updates.association_id;
    }

    if (updates.company_id !== undefined) {
      fields.company_id = updates.company_id;
    }

    await user.update(fields);

    return this.getUserById(id);
  }

  /**
   * Delete a user by ID
   */
  async deleteUser(id) {
    const user = await UnifiedUser.findByPk(id);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    await user.destroy();
  }

  /**
   * Search users by name.
   * @param {string} query – Search term.
   * @param {object} [scope={}] – Sequelize `where` clause from policy scope.
   */
  async searchUsers(query, scope = {}) {
    return UnifiedUser.findAll({
      where: {
        ...scope,
        name: { [Op.like]: `%${query}%` },
      },
      include: USER_INCLUDES,
      order: [["id", "ASC"]],
    });
  }
}

module.exports = new UserService();
