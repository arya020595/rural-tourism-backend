/**
 * Base policy class (similar to Pundit's ApplicationPolicy).
 *
 * Every resource-specific policy extends this class and overrides the
 * action methods (index, show, create, update, destroy) as well as
 * the `scope()` method that returns a Sequelize `where` clause
 * restricting visible records.
 */
class ApplicationPolicy {
  /**
   * @param {object} user  – The authenticated user from req.user (JWT payload).
   * @param {object} [record] – The target record (optional; used for per-record checks).
   */
  constructor(user, record = null) {
    this.user = user;
    this.record = record;
  }

  /* ── Role helpers ────────────────────────────────────────────── */

  isAdmin() {
    return (
      this.user.role === "superadmin" ||
      (Array.isArray(this.user.permissions) &&
        this.user.permissions.includes("*:*"))
    );
  }

  hasPermission(code) {
    if (this.isAdmin()) return true;
    return (
      Array.isArray(this.user.permissions) &&
      this.user.permissions.includes(code)
    );
  }

  /* ── Default action guards (deny by default) ─────────────────── */

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

  /* ── Scope (returns a Sequelize `where` clause) ───────────────── */

  scope() {
    if (this.isAdmin()) return {};
    // By default non-admins see nothing; subclasses override.
    return { id: null };
  }
}

module.exports = ApplicationPolicy;
