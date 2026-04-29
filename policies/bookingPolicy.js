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

  destroy() {
    return this.isAdmin() || this.hasPermission("booking:delete");
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
    // Service serialize() returns snake_case `company_id`
    const recordCompanyId = plain.company_id ?? plain.companyId;
    if (this.user.company_id && recordCompanyId) {
      return this.user.company_id === recordCompanyId;
    }
    return false;
  }
}

module.exports = BookingPolicy;
