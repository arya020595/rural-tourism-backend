const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const UnifiedUser = require("../models/unifiedUserModel");
const Association = require("../models/associationModel");
const Company = require("../models/companyModel");
const Role = require("../models/roleModel");
const {
  NotFoundError,
  ConflictError,
  BadRequestError,
} = require("./errors/AppError");
require("../models/associations");

const SALT_ROUNDS = 10;

const USER_INCLUDES = [
  { model: Association, as: "association", required: false },
  { model: Company, as: "company", required: false },
  { model: Role, as: "role", required: false },
];

class UserService {
  /**
   * Get all users with associations, search, and pagination.
   * @param {object} [scope={}] – Sequelize `where` clause from policy scope.
   * @param {object} [options={}] – { where, order, search, page, perPage }
   */
  async getAllUsers(
    scope = {},
    { where = {}, order = [], search, page = 1, perPage = 10 } = {},
  ) {
    // ?search= shortcut — searches name + email with LIKE
    if (search) {
      const pattern = `%${search}%`;
      where[Op.or] = [
        { name: { [Op.like]: pattern } },
        { email: { [Op.like]: pattern } },
      ];
    }

    // Policy scope keys (company_id, etc.) always win over ransack where
    const mergedWhere = { ...where, ...scope };

    const result = await UnifiedUser.paginate({
      where: mergedWhere,
      include: USER_INCLUDES,
      order: order.length ? order : [["id", "ASC"]],
      page,
      paginate: perPage,
    });

    return {
      docs: result.docs,
      total: result.total,
      pages: result.pages,
    };
  }

  /**
   * Get a single user by ID
   */
  async getUserById(id) {
    const user = await UnifiedUser.findByPk(id, {
      include: USER_INCLUDES,
    });
    if (!user) throw new NotFoundError("User not found");
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
      throw new BadRequestError(
        "name, username, email, and password are required",
      );
    }

    const existingUser = await UnifiedUser.findOne({
      where: {
        [Op.or]: [{ username: trimmedUsername }, { email: trimmedEmail }],
      },
    });
    if (existingUser)
      throw new ConflictError("Username or email already exists");

    if (role_id) {
      const role = await Role.findByPk(role_id);
      if (!role) throw new BadRequestError("Invalid role_id");
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
   * Update user fields only (no company).
   */
  async updateUser(id, updates) {
    const user = await UnifiedUser.findByPk(id);
    if (!user) throw new NotFoundError("User not found");

    const fields = await this._buildUserFields(id, updates);
    await user.update(fields);
    return this.getUserById(id);
  }

  /**
   * Update user + company in a single transaction.
   * Creates the company record when the user doesn't have one yet.
   */
  async updateUserProfile(id, userUpdates, companyUpdates) {
    const user = await UnifiedUser.findByPk(id, {
      include: [{ model: Company, as: "company", required: false }],
    });
    if (!user) throw new NotFoundError("User not found");

    const fields = await this._buildUserFields(id, userUpdates);

    const transaction = await UnifiedUser.sequelize.transaction();
    try {
      if (Object.keys(fields).length > 0) {
        await user.update(fields, { transaction });
      }

      let company = user.company;
      if (!company) {
        company = await Company.create(
          {
            company_name:
              companyUpdates.company_name || user.name || user.username,
            email: companyUpdates.email || fields.email || user.email,
            ...companyUpdates,
          },
          { transaction },
        );
        await user.update({ company_id: company.id }, { transaction });
      } else {
        await company.update(companyUpdates, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    return this.getUserById(id);
  }

  /**
   * Delete a user by ID
   */
  async deleteUser(id) {
    const user = await UnifiedUser.findByPk(id);
    if (!user) throw new NotFoundError("User not found");
    await user.destroy();
  }

  /* ── Private ─────────────────────────────────────────────────── */

  /**
   * Validate and prepare user-level fields for update.
   * Shared between updateUser() and updateUserProfile().
   */
  async _buildUserFields(id, updates) {
    const fields = {};

    if (updates.name !== undefined) {
      fields.name = String(updates.name).trim();
    }

    if (updates.username !== undefined) {
      const trimmed = String(updates.username).trim();
      const dup = await UnifiedUser.findOne({
        where: { username: trimmed, id: { [Op.ne]: id } },
      });
      if (dup) throw new ConflictError("Username already taken");
      fields.username = trimmed;
    }

    if (updates.email !== undefined) {
      const trimmed = String(updates.email).trim();
      const dup = await UnifiedUser.findOne({
        where: { email: trimmed, id: { [Op.ne]: id } },
      });
      if (dup) throw new ConflictError("Email already taken");
      fields.email = trimmed;
    }

    if (updates.password) {
      fields.password = await bcrypt.hash(updates.password, SALT_ROUNDS);
      fields.confirm_password = fields.password;
    }

    if (updates.role_id !== undefined) {
      if (updates.role_id !== null) {
        const role = await Role.findByPk(updates.role_id);
        if (!role) throw new BadRequestError("Invalid role_id");
      }
      fields.role_id = updates.role_id;
    }

    if (updates.association_id !== undefined) {
      fields.association_id = updates.association_id;
    }

    if (updates.company_id !== undefined) {
      fields.company_id = updates.company_id;
    }

    return fields;
  }
}

module.exports = new UserService();
