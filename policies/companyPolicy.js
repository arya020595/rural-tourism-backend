const ApplicationPolicy = require("./applicationPolicy");

/**
 * Pundit-style policy for the Company resource.
 *
 * Access rules:
 *  - superadmin     → full access to any company
 *  - operator_admin → can read and update ONLY their own company
 *  - all others     → denied
 */
class CompanyPolicy extends ApplicationPolicy {
  /* ── Action guards ───────────────────────────────────────────── */

  show() {
    if (this.isAdmin()) return true;
    if (this.user.role === "operator_admin") return this._isOwnCompany();
    return false;
  }

  update() {
    if (this.isAdmin()) return true;
    if (this.user.role === "operator_admin") return this._isOwnCompany();
    return false;
  }

  /* ── Private helpers ─────────────────────────────────────────── */

  _isOwnCompany() {
    if (!this.record) return false;
    const companyId = this.record.id ?? this.record;
    return (
      this.user.company_id != null &&
      String(this.user.company_id) === String(companyId)
    );
  }
}

module.exports = CompanyPolicy;
