const ApplicationPolicy = require("./applicationPolicy");

/**
 * Pundit-style policy for the Role resource.
 *
 * Only superadmin (isAdmin) can manage roles.
 */
class RolePolicy extends ApplicationPolicy {
  index() {
    return this.isAdmin();
  }

  show() {
    return this.isAdmin();
  }

  create() {
    return this.isAdmin();
  }

  update() {
    return this.isAdmin();
  }

  destroy() {
    return this.isAdmin();
  }

  scope() {
    return this.isAdmin() ? {} : { id: null };
  }
}

module.exports = RolePolicy;
