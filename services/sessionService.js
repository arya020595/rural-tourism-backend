const UnifiedUser = require("../models/unifiedUserModel");
const TouristUser = require("../models/touristModel");
const AssociationUser = require("../models/associationUserModel");
const { SessionInvalidError } = require("./errors/AppError");

/**
 * Which table a login token's user lives in — stored in the token as `src`.
 * Login tokens last 30 days, so every request re-checks the user against the
 * database instead of trusting what the token said at login.
 */
const TOKEN_SOURCE = {
  USERS: "users",
  TOURIST: "tourist_users",
  ASSOCIATION: "association_users",
};

// Role → permission lookups are cached briefly so each request is a single
// primary-key query. Role permission edits apply within this window.
const ROLE_CACHE_TTL_MS = 60 * 1000;

class SessionService {
  constructor() {
    this.roleCache = new Map();
  }

  clearRoleCache() {
    this.roleCache.clear();
  }

  async resolveRolePermissions(roleId, userType) {
    const key = `${roleId ?? ""}:${userType ?? ""}`;
    const cached = this.roleCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // Lazy require: authService imports middleware/auth, which loads this
    // service — requiring it at call time avoids the circular import.
    const authService = require("./authService");
    const role = await authService.resolveRole(roleId, userType);
    const value = {
      role: role.name,
      permissions: authService.extractPermissionCodes(role),
    };
    this.roleCache.set(key, {
      value,
      expiresAt: Date.now() + ROLE_CACHE_TTL_MS,
    });
    return value;
  }

  /**
   * Re-validates a verified token against the database. Returns the fields
   * that must override the token's claims (current role, permissions,
   * company, association), or null for tokens issued before `src` existed
   * (those expire within 24 hours of the deploy and keep the old behaviour).
   *
   * Throws SessionInvalidError when the session must end.
   */
  async loadCurrentState(claims = {}) {
    switch (claims.src) {
      case TOKEN_SOURCE.USERS:
        return this.loadFromUsers(claims);
      case TOKEN_SOURCE.TOURIST:
        return this.loadFromTouristUsers(claims);
      case TOKEN_SOURCE.ASSOCIATION:
        return this.loadFromAssociationUsers(claims);
      default:
        return null;
    }
  }

  async loadFromUsers(claims) {
    const user = await UnifiedUser.findByPk(
      claims.unified_user_id ?? claims.id,
      {
        attributes: [
          "id",
          "is_active",
          "role_id",
          "company_id",
          "association_id",
          "token_version",
        ],
      },
    );

    this.assertUsable(user);

    if (
      claims.tv !== undefined &&
      Number(claims.tv) !== Number(user.token_version ?? 0)
    ) {
      throw new SessionInvalidError(
        "Your password was changed. Please login again.",
        "SESSION_REVOKED",
      );
    }

    const { role, permissions } = await this.resolveRolePermissions(
      user.role_id,
      claims.user_type,
    );

    return {
      role,
      permissions,
      company_id: user.company_id ?? null,
      association_id: user.association_id ?? null,
    };
  }

  async loadFromTouristUsers(claims) {
    const user = await TouristUser.findByPk(claims.id, {
      attributes: ["tourist_user_id", "is_active", "role_id"],
    });

    this.assertUsable(user);

    const { role, permissions } = await this.resolveRolePermissions(
      user.role_id,
      claims.user_type,
    );
    return { role, permissions };
  }

  async loadFromAssociationUsers(claims) {
    const user = await AssociationUser.findByPk(claims.id);

    this.assertUsable(user);

    const { role, permissions } = await this.resolveRolePermissions(
      user.role_id,
      claims.user_type,
    );

    const state = { role, permissions };
    if (user.association_id !== undefined) {
      state.association_id = user.association_id ?? null;
    }
    if (user.company_id !== undefined) {
      state.company_id = user.company_id ?? null;
    }
    return state;
  }

  assertUsable(user) {
    if (!user) {
      throw new SessionInvalidError(
        "This account no longer exists. Please contact your association or admin.",
        "ACCOUNT_NOT_FOUND",
      );
    }

    if (user.is_active === false || user.is_active === 0) {
      throw new SessionInvalidError(
        "Your account has been deactivated. Please contact your association or admin.",
        "ACCOUNT_DEACTIVATED",
      );
    }
  }
}

module.exports = {
  TOKEN_SOURCE,
  SessionService,
  sessionService: new SessionService(),
};
