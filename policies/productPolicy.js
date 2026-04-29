const ApplicationPolicy = require("./applicationPolicy");

/**
 * Pundit policy for the Product resource.
 *
 * Scoping rules:
 *  - superadmin          → can see / manage ALL products
 *  - operator_admin      → can see / manage products of their own company
 *  - operator_staff      → can see products of their own company
 *                          TODO: confirm with team if operator_staff can create/update/delete
 *  - association/tourist → restricted based on permissions
 *  - others              → denied by default
 */
class ProductPolicy extends ApplicationPolicy {
  /* ── Action guards ───────────────────────────────────────────── */

  /**
   * index() – List products
   * Allowed: superadmin, operator_admin, operator_staff (with product:read)
   * TODO: confirm team on who can list products
   */
  index() {
    return this.isAdmin() || this.hasPermission("product:read");
  }

  /**
   * show() – View a single product
   * Allowed: superadmin, or any user with product:read.
   *
   * We intentionally do NOT restrict to same-company here because the
   * /shared-by-location endpoint intentionally exposes products from other
   * companies at the same location. The list endpoints already scope what
   * can be returned; once a product is visible in a list a user should be
   * able to GET it directly as well.
   */
  show() {
    if (this.isAdmin()) return true;
    return this.hasPermission("product:read");
  }

  /**
   * create() – Create a new product
   * Allowed: superadmin, or user with product:create
   * TODO: confirm team if operator_staff can create products
   */
  create() {
    if (this.isAdmin()) return true;
    return this.hasPermission("product:create");
  }

  /**
   * update() – Update a product
   * Allowed: superadmin, or user with product:update + same company
   * TODO: confirm team if operator_staff can update products
   */
  update() {
    if (this.isAdmin()) return true;
    if (this.hasPermission("product:update")) return this._sameCompany();
    return false;
  }

  /**
   * destroy() – Delete a product
   * Allowed: superadmin, or user with product:delete + same company
   * TODO: confirm team if operator_staff can delete products
   */
  destroy() {
    if (this.isAdmin()) return true;
    if (this.hasPermission("product:delete")) return this._sameCompany();
    return false;
  }

  /* ── Scope – returns a Sequelize `where` clause ──────────────── */

  /**
   * scope() – Filter products based on user's company
   * - Superadmin: sees all products (no filter)
   * - Other users: only see products from their own company
   */
  scope() {
    if (this.isAdmin()) return {};

    // Non-admin users: only see products of their own company
    if (this.user.company_id) {
      return { company_id: this.user.company_id };
    }

    // Fallback: deny access
    return { id: null };
  }

  /* ── Private helpers ─────────────────────────────────────────── */

  /**
   * Check if the user owns the product (same company_id)
   */
  _sameCompany() {
    if (!this.record) return false;
    const plain = this.record.toJSON ? this.record.toJSON() : this.record;

    if (this.user.company_id && plain.company_id) {
      return this.user.company_id === plain.company_id;
    }

    return false;
  }
}

module.exports = ProductPolicy;
