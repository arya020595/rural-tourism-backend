const ApplicationPolicy = require("./applicationPolicy");

class BookingPolicy extends ApplicationPolicy {
  index() {
    return this.isAdmin() || this.hasPermission("booking:read");
  }

  show() {
    if (this.isAdmin()) return true;
    if (!this.hasPermission("booking:read")) return false;
    return this._sameCompany();
  }

  create() {
    return this.isAdmin() || this.hasPermission("booking:create");
  }

  update() {
    if (this.isAdmin()) return true;
    if (!this.hasPermission("booking:update")) return false;
    return this._sameCompany();
  }

  cancel() {
    if (this.isAdmin()) return true;
    if (!this.hasPermission("booking:cancel")) return false;
    return this._sameCompany();
  }

  destroy() {
    if (this.isAdmin()) return true;
    if (!this.hasPermission("booking:delete")) return false;
    return this._sameCompany();
  }

  /**
   * scope() – returns a Sequelize `where` clause
   * - superadmin: sees all bookings
   * - others: only see bookings belonging to their own company
   */
  scope() {
    if (this.isAdmin()) return {};
    if (this.user.company_id) {
      return { companyId: this.user.company_id };
    }
    return { id: null };
  }

  _sameCompany() {
    if (!this.record) return false;
    const plain = this.record.toJSON ? this.record.toJSON() : this.record;
    const recordCompanyId = plain.company_id ?? plain.companyId;
    const userCompanyId = this.user.company_id;

    if (!userCompanyId) return false;

    // Direct company match (creator) — use == to handle int/string mismatch
    if (recordCompanyId && userCompanyId == recordCompanyId) return true;

    // Referee match — allow access if this company is a participant in the package
    const packageCompanies = plain.package_companies ?? [];
    if (packageCompanies.length > 0) {
      return packageCompanies.some(
        (pc) =>
          (pc.referee_id ?? pc.refereeId) == userCompanyId ||
          (pc.referrer_id ?? pc.referrerId) == userCompanyId,
      );
    }

    return false;
  }
}

module.exports = BookingPolicy;
