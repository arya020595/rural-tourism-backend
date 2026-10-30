const ApplicationPolicy = require("./applicationPolicy");

/**
 * Quotations belong to the company that made them. Unlike bookings, the
 * other companies whose products are on a quotation do not see it — they see
 * the booking once it is converted (existing referral visibility).
 */
class QuotationPolicy extends ApplicationPolicy {
  index() {
    return this.isAdmin() || this.hasPermission("quotation:read");
  }

  show() {
    if (this.isAdmin()) return true;
    if (!this.hasPermission("quotation:read")) return false;
    return this._sameCompany();
  }

  create() {
    if (this.isAdmin()) return true;
    return this.hasPermission("quotation:create") && !!this.user.company_id;
  }

  update() {
    if (this.isAdmin()) return true;
    if (!this.hasPermission("quotation:update")) return false;
    return this._sameCompany();
  }

  /** quotation:delete is the "Cancel Quotation" permission (nothing is deleted). */
  cancel() {
    if (this.isAdmin()) return true;
    if (!this.hasPermission("quotation:delete")) return false;
    return this._sameCompany();
  }

  /**
   * Convert to Booking needs booking:create; Convert to Receipt also needs
   * receipt:create (the E-Receipt form's own permission).
   */
  convert(mode = "booking") {
    if (!this.show()) return false;
    if (!this.hasPermission("booking:create")) return false;
    if (mode === "receipt" && !this.hasPermission("receipt:create")) {
      return false;
    }
    return true;
  }

  /**
   * scope() – returns a Sequelize `where` clause
   * - superadmin: sees all quotations
   * - others: only their own company's quotations
   */
  scope() {
    if (this.isAdmin()) return {};
    if (this.user.company_id) {
      return { companyId: this.user.company_id };
    }
    return { id: null };
  }

  _sameCompany() {
    if (!this.record || !this.user.company_id) return false;
    const plain = this.record.toJSON ? this.record.toJSON() : this.record;
    const recordCompanyId = plain.company_id ?? plain.companyId;
    // == to handle int/string mismatch (JWT vs DB)
    return recordCompanyId != null && recordCompanyId == this.user.company_id;
  }
}

module.exports = QuotationPolicy;
