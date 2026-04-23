const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const { generateToken } = require("../middleware/auth");
const TouristUser = require("../models/touristModel");
const AssociationUser = require("../models/associationUserModel");
const UnifiedUser = require("../models/unifiedUserModel");
const Company = require("../models/companyModel");
const Association = require("../models/associationModel");
const Role = require("../models/roleModel");
const Permission = require("../models/permissionModel");
require("../models/associations");

const USER_TYPE_OPERATOR = "operator";
const USER_TYPE_TOURIST = "tourist";
const USER_TYPE_ASSOCIATION = "association";

const DEFAULT_ROLE_BY_USER_TYPE = {
  [USER_TYPE_OPERATOR]: "operator_admin",
  [USER_TYPE_TOURIST]: "tourist",
  [USER_TYPE_ASSOCIATION]: "association",
};

const parseNullableInt = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const parsePoscode = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  if (!/^\d{5}$/.test(normalized)) return null;
  return normalized;
};

const toBase64DataUri = (file) => {
  if (!file || !file.buffer) return null;
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
};

class AuthService {
  async assertAccountIsLoginEligible(user, userType) {
    if (!user || userType !== USER_TYPE_TOURIST) {
      return;
    }

    if (user.is_active !== false) {
      return;
    }

    if (user.suspended_at) {
      const now = new Date();
      const suspendedAt = new Date(user.suspended_at);
      const diffDays = Math.floor((now - suspendedAt) / (1000 * 60 * 60 * 24));

      if (diffDays >= 3) {
        await user.update({ is_active: true, suspended_at: null });
        return;
      }

      const daysLeft = 3 - diffDays;
      const error = new Error(
        `Your account is suspended. Please try again in ${daysLeft} day(s).`,
      );
      error.statusCode = 403;
      throw error;
    }

    const error = new Error(
      "Your account is suspended. Please contact support.",
    );
    error.statusCode = 403;
    throw error;
  }

  async login({ identifier, password, allowedUserTypes } = {}) {
    const normalizedIdentifier = String(identifier || "").trim();
    const normalizedPassword = String(password || "");

    if (!normalizedIdentifier || !normalizedPassword) {
      const error = new Error("Missing username/email or password");
      error.statusCode = 400;
      throw error;
    }

    const allowedSet = Array.isArray(allowedUserTypes)
      ? new Set(allowedUserTypes)
      : null;

    const unifiedLoginResult = await this.loginFromUnifiedUsers({
      identifier: normalizedIdentifier,
      password: normalizedPassword,
      allowedSet,
    });

    if (unifiedLoginResult) {
      return unifiedLoginResult;
    }

    const resolvers = [
      {
        userType: USER_TYPE_TOURIST,
        enabled: !allowedSet || allowedSet.has(USER_TYPE_TOURIST),
        findUser: () =>
          TouristUser.findOne({
            where: {
              [Op.or]: [
                { username: normalizedIdentifier },
                { email: normalizedIdentifier },
              ],
            },
          }),
        verifyPassword: async (user) =>
          bcrypt.compare(normalizedPassword, user.password),
        getIdentity: (user) => ({
          id: user.tourist_user_id,
          username: user.username,
          email: user.email,
          name: user.full_name,
          roleId: user.role_id,
        }),
      },
      {
        userType: USER_TYPE_ASSOCIATION,
        enabled: !allowedSet || allowedSet.has(USER_TYPE_ASSOCIATION),
        findUser: () =>
          AssociationUser.findOne({
            where: {
              [Op.or]: [
                { username: normalizedIdentifier },
                { user_email: normalizedIdentifier },
              ],
            },
          }),
        verifyPassword: async (user) => {
          if (
            user.default_password &&
            normalizedPassword === user.default_password
          ) {
            return true;
          }
          return bcrypt.compare(normalizedPassword, user.password);
        },
        getIdentity: (user) => ({
          id: user.id,
          username: user.username,
          email: user.user_email,
          name: user.full_name,
          roleId: user.role_id,
          association_id: user.association_id,
        }),
      },
    ];

    for (const resolver of resolvers) {
      if (!resolver.enabled) {
        continue;
      }

      const user = await resolver.findUser();
      if (!user) {
        continue;
      }

      const passwordOk = await resolver.verifyPassword(user);
      if (!passwordOk) {
        continue;
      }

      await this.assertAccountIsLoginEligible(user, resolver.userType);

      const identity = resolver.getIdentity(user);
      const role = await this.resolveRole(identity.roleId, resolver.userType);
      const permissions = this.extractPermissionCodes(role);

      const tokenPayload = {
        sub: `${resolver.userType}:${identity.id}`,
        user_type: resolver.userType,
        legacy_user_id: identity.id,
        username: identity.username,
        role: role.name,
        permissions,
      };

      if (identity.association_id) {
        tokenPayload.association_id = identity.association_id;
      }

      const token = generateToken(
        tokenPayload,
        process.env.JWT_EXPIRES_IN || "24h",
      );

      let powerBiUrl = null;
      if (identity.association_id) {
        const assoc = await Association.findByPk(identity.association_id, {
          attributes: ["power_bi_url"],
        });
        powerBiUrl = assoc ? assoc.power_bi_url || null : null;
      }

      return {
        token,
        user: {
          id: identity.id,
          user_type: resolver.userType,
          legacy_user_id: identity.id,
          name: identity.name || null,
          username: identity.username,
          email: identity.email,
          association_id: identity.association_id || null,
          power_bi_url: powerBiUrl,
          role: {
            id: role.id,
            name: role.name,
          },
          permissions,
        },
      };
    }

    const error = new Error("Invalid username/email or password");
    error.statusCode = 401;
    throw error;
  }

  inferUserTypeFromRole(roleName) {
    const normalizedRole = String(roleName || "").toLowerCase();

    if (
      normalizedRole === USER_TYPE_OPERATOR ||
      normalizedRole === USER_TYPE_TOURIST ||
      normalizedRole === USER_TYPE_ASSOCIATION
    ) {
      return normalizedRole;
    }

    // operator_admin & operator_staff map to the "operator" user type.
    if (
      normalizedRole === "operator_admin" ||
      normalizedRole === "operator_staff"
    ) {
      return USER_TYPE_OPERATOR;
    }

    // Keep superadmin compatible with existing operator dashboards/routes.
    return USER_TYPE_OPERATOR;
  }

  async resolveLegacyUserId({ userType, username, email, fallbackId }) {
    if (userType === USER_TYPE_TOURIST) {
      const touristUser = await TouristUser.findOne({
        where: {
          [Op.or]: [{ username }, { email }],
        },
      });

      return touristUser ? touristUser.tourist_user_id : fallbackId;
    }

    if (userType === USER_TYPE_ASSOCIATION) {
      const associationUser = await AssociationUser.findOne({
        where: {
          [Op.or]: [{ username }, { user_email: email }],
        },
      });
      return associationUser ? associationUser.id : fallbackId;
    }

    return fallbackId;
  }

  async loginFromUnifiedUsers({ identifier, password, allowedSet }) {
    const user = await UnifiedUser.findOne({
      where: {
        [Op.or]: [{ username: identifier }, { email: identifier }],
      },
    });

    if (!user) {
      return null;
    }

    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) {
      return null;
    }

    const role = await this.resolveRole(user.role_id, USER_TYPE_OPERATOR);
    const resolvedUserType = this.inferUserTypeFromRole(role.name);

    if (allowedSet && !allowedSet.has(resolvedUserType)) {
      return null;
    }

    const resolvedOwnerId =
      resolvedUserType === USER_TYPE_OPERATOR
        ? user.id
        : await this.resolveLegacyUserId({
            userType: resolvedUserType,
            username: user.username,
            email: user.email,
            fallbackId: user.id,
          });

    const permissions = this.extractPermissionCodes(role);

    const tokenPayload = {
      sub: `${resolvedUserType}:${resolvedOwnerId}`,
      id: resolvedOwnerId,
      unified_user_id: user.id,
      user_type: resolvedUserType,
      username: user.username,
      role: role.name,
      permissions,
    };

    if (resolvedUserType !== USER_TYPE_OPERATOR) {
      tokenPayload.legacy_user_id = resolvedOwnerId;
    }

    if (user.company_id) {
      tokenPayload.company_id = user.company_id;
    }

    if (user.association_id) {
      tokenPayload.association_id = user.association_id;
    }

    const token = generateToken(
      tokenPayload,
      process.env.JWT_EXPIRES_IN || "24h",
    );

    let powerBiUrl = null;
    if (user.association_id) {
      const assoc = await Association.findByPk(user.association_id, {
        attributes: ["power_bi_url"],
      });
      powerBiUrl = assoc ? assoc.power_bi_url || null : null;
    }

    return {
      token,
      user: {
        id: user.id,
        unified_user_id: user.id,
        user_type: resolvedUserType,
        ...(resolvedUserType !== USER_TYPE_OPERATOR
          ? { legacy_user_id: resolvedOwnerId }
          : {}),
        name: user.name || null,
        username: user.username,
        email: user.email,
        association_id: user.association_id || null,
        power_bi_url: powerBiUrl,
        company_id: user.company_id || null,
        role: {
          id: role.id,
          name: role.name,
        },
        permissions,
      },
    };
  }

  async register({ userType, payload = {}, files = {} } = {}) {
    const normalizedUserType = String(userType || "")
      .trim()
      .toLowerCase();

    if (!Object.keys(DEFAULT_ROLE_BY_USER_TYPE).includes(normalizedUserType)) {
      const error = new Error(
        `Invalid user_type. Allowed values: ${Object.keys(DEFAULT_ROLE_BY_USER_TYPE).join(", ")}.`,
      );
      error.statusCode = 400;
      throw error;
    }

    if (normalizedUserType === USER_TYPE_OPERATOR) {
      return this.registerOperator(payload, files);
    }

    if (normalizedUserType === USER_TYPE_TOURIST) {
      return this.registerTourist(payload);
    }

    const error = new Error("Association self-registration is not supported.");
    error.statusCode = 403;
    throw error;
  }

  async registerOperator(payload = {}, files = {}) {
    const username = String(payload.username || "").trim();
    const userEmail = String(
      payload.user_email || payload.email_address || "",
    ).trim();
    const ownerFullName = String(
      payload.owner_full_name || payload.full_name || "",
    ).trim();
    const password = String(payload.password || "");
    const confirmedPassword = String(
      payload.confirmed_password || payload.confPass || "",
    );

    if (!username) {
      const error = new Error("Username is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!userEmail) {
      const error = new Error("Email address is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!ownerFullName) {
      const error = new Error("Owner full name is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!password) {
      const error = new Error("Password is required.");
      error.statusCode = 400;
      throw error;
    }

    if (confirmedPassword && password !== confirmedPassword) {
      const error = new Error("Password and confirm password do not match.");
      error.statusCode = 400;
      throw error;
    }

    const normalizedPoscode = parsePoscode(payload.poscode);
    if (
      payload.poscode !== undefined &&
      payload.poscode !== "" &&
      !normalizedPoscode
    ) {
      const error = new Error("Poscode must be exactly 5 digits.");
      error.statusCode = 400;
      throw error;
    }

    const associationIdInput = payload.associationId ?? payload.association_id;
    const parsedAssociationId = parseNullableInt(associationIdInput);

    if (
      associationIdInput !== undefined &&
      associationIdInput !== "" &&
      parsedAssociationId === null
    ) {
      const error = new Error("Association ID must be an integer.");
      error.statusCode = 400;
      throw error;
    }

    if (parsedAssociationId !== null) {
      const association = await Association.findByPk(parsedAssociationId);
      if (!association) {
        const error = new Error("Selected association does not exist.");
        error.statusCode = 400;
        throw error;
      }
    }

    const existingUserByUsername = await UnifiedUser.findOne({
      where: { username },
    });
    if (existingUserByUsername) {
      const error = new Error("Username already exists.");
      error.statusCode = 409;
      throw error;
    }

    const existingUserByEmail = await UnifiedUser.findOne({
      where: { email: userEmail },
    });
    if (existingUserByEmail) {
      const error = new Error("Email address already exists.");
      error.statusCode = 409;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const roleId = await this.resolveDefaultRoleId(USER_TYPE_OPERATOR);
    const companyName =
      String(payload.business_name || "").trim() || ownerFullName || username;

    const logoFile =
      files?.operator_logo_image?.[0] || files?.company_logo?.[0] || null;
    const motacFile = files?.motac_license_file?.[0] || null;
    const tradingOperationFile = files?.trading_operation_license?.[0] || null;
    const homestayFile = files?.homestay_certificate?.[0] || null;

    const transaction = await UnifiedUser.sequelize.transaction();

    try {
      const company = await Company.create(
        {
          company_name: companyName,
          address: payload.business_address || null,
          email: userEmail,
          location: payload.location || null,
          postcode: normalizedPoscode,
          total_fulltime_staff: parseNullableInt(payload.no_of_full_time_staff),
          total_partime_staff: parseNullableInt(payload.no_of_part_time_staff),
          contact_no: payload.contact_no || null,
          operator_logo_image: toBase64DataUri(logoFile),
          motac_license_file: toBase64DataUri(motacFile),
          trading_operation_license: toBase64DataUri(tradingOperationFile),
          homestay_certificate: toBase64DataUri(homestayFile),
        },
        { transaction },
      );

      const user = await UnifiedUser.create(
        {
          name: ownerFullName,
          username,
          email: userEmail,
          password: hashedPassword,
          confirm_password: hashedPassword,
          association_id: parsedAssociationId,
          role_id: roleId,
          company_id: company.id,
        },
        { transaction },
      );

      await transaction.commit();

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.name,
          association_id: user.association_id,
          company_id: user.company_id,
          role: {
            id: roleId || null,
            name: DEFAULT_ROLE_BY_USER_TYPE[USER_TYPE_OPERATOR],
          },
        },
      };
    } catch (dbError) {
      await transaction.rollback();
      throw dbError;
    }
  }

  async registerTourist(payload = {}) {
    const username = String(payload.username || "").trim();
    const email = String(payload.email || payload.email_address || "").trim();
    const fullName = String(payload.full_name || "").trim();
    const contactNo = String(payload.contact_no || "").trim();
    const nationality = String(payload.nationality || "").trim();
    const password = String(payload.password || "");
    const confirmPassword = String(
      payload.confirm_password || payload.confirmed_password || "",
    );

    if (
      !username ||
      !email ||
      !fullName ||
      !contactNo ||
      !nationality ||
      !password
    ) {
      const error = new Error("All fields are required.");
      error.statusCode = 400;
      throw error;
    }

    if (confirmPassword && password !== confirmPassword) {
      const error = new Error("Password and confirm password do not match.");
      error.statusCode = 400;
      throw error;
    }

    const existingUserByUsername = await TouristUser.findOne({
      where: { username },
    });
    if (existingUserByUsername) {
      const error = new Error("Username already taken.");
      error.statusCode = 409;
      throw error;
    }

    const existingEmail = await TouristUser.findOne({ where: { email } });
    if (existingEmail) {
      const error = new Error("Email already registered.");
      error.statusCode = 409;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const roleId = await this.resolveDefaultRoleId(USER_TYPE_TOURIST);

    const user = await TouristUser.create({
      username,
      email,
      password: hashedPassword,
      full_name: fullName,
      contact_no: contactNo,
      nationality,
      is_active: true,
      role_id: roleId,
    });

    return {
      user: {
        tourist_user_id: user.tourist_user_id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        contact_no: user.contact_no,
        nationality: user.nationality,
        role: {
          id: roleId || null,
          name: DEFAULT_ROLE_BY_USER_TYPE[USER_TYPE_TOURIST],
        },
      },
    };
  }

  async resolveDefaultRoleId(userType) {
    const roleName = DEFAULT_ROLE_BY_USER_TYPE[userType];
    if (!roleName) {
      return null;
    }

    const role = await Role.findOne({ where: { name: roleName } });
    return role ? role.id : null;
  }

  async resolveRole(roleId, userType) {
    let role = null;

    if (roleId) {
      role = await Role.findByPk(roleId, {
        include: [
          {
            model: Permission,
            as: "permissions",
            through: { attributes: [] },
          },
        ],
      });
    }

    if (!role) {
      const fallbackRoleName = DEFAULT_ROLE_BY_USER_TYPE[userType];
      role = await Role.findOne({
        where: { name: fallbackRoleName },
        include: [
          {
            model: Permission,
            as: "permissions",
            through: { attributes: [] },
          },
        ],
      });
    }

    if (!role) {
      const error = new Error("Role is not configured for this account");
      error.statusCode = 500;
      throw error;
    }

    return role;
  }

  extractPermissionCodes(role) {
    const rolePermissions = Array.isArray(role.permissions)
      ? role.permissions
      : [];
    const codes = rolePermissions
      .map((permission) => permission.code)
      .filter(Boolean);

    if (role.name === "superadmin" && !codes.includes("*:*")) {
      codes.push("*:*");
    }

    return [...new Set(codes)];
  }
}

module.exports = new AuthService();
