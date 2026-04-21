const ApplicationPolicy = require("./applicationPolicy");

/**
 * Pundit-style policy for the User resource.
 *
 * Scoping rules:
 *  - superadmin     → can see / manage ALL users
 *  - operator_admin → can only see / manage users that belong to the SAME company
 *  - association    → can only see users within the same association (requires user:read permission)
 *  - others         → can only see their own record
 */
class UserPolicy extends ApplicationPolicy {
  /* ── Action guards ───────────────────────────────────────────── */

  index() {
    return this.isAdmin() || this.hasPermission("user:read");
  }

  show() {
    if (this.isAdmin()) return true;
    if (this._isSelf()) return true;
    if (this.hasPermission("user:read")) return this._sameScope();
    return false;
  }

  create() {
    if (this.isAdmin()) return true;
    return this.hasPermission("user:create");
  }

  update() {
    if (this.isAdmin()) return true;
    if (this._isSelf()) return true;
    if (this.hasPermission("user:update")) return this._sameScope();
    return false;
  }

  destroy() {
    if (this.isAdmin()) return true;
    // An operator can delete a same-company user but not themselves.
    if (this.hasPermission("user:delete")) {
      return this._sameScope() && !this._isSelf();
    }
    return false;
  }

  /* ── Scope – returns a Sequelize `where` clause ──────────────── */

  scope() {
    if (this.isAdmin()) return {};

    // Operator with user:read – scope to same company
    if (this.user.company_id && this.hasPermission("user:read")) {
      return { company_id: this.user.company_id };
    }

    // Association user – scope to same association
    if (this.user.association_id && this.hasPermission("user:read")) {
      return { association_id: this.user.association_id };
    }

    // Fallback: user can only see themselves
    return { id: this.user.id || this.user.unified_user_id };
  }

  /* ── Private helpers ─────────────────────────────────────────── */

  _isSelf() {
    if (!this.record) return false;
    const recordId = this.record.id ?? this.record;
    const userId = this.user.unified_user_id ?? this.user.id;
    return String(recordId) === String(userId);
  }

  _sameScope() {
    if (!this.record) return false;
    const plain = this.record.toJSON ? this.record.toJSON() : this.record;

    // Same company check
    if (this.user.company_id && plain.company_id) {
      return this.user.company_id === plain.company_id;
    }

    // Same association check
    if (this.user.association_id && plain.association_id) {
      return this.user.association_id === plain.association_id;
    }

    return false;
  }
}

module.exports = UserPolicy;
