const ApplicationPolicy = require("./applicationPolicy");

class AssociationPolicy extends ApplicationPolicy {
  show() {
    if (this.isAdmin()) return true;
    if (!this.hasPermission("bi_dashboard:read")) return false;
    return this._sameAssociation();
  }

  _sameAssociation() {
    if (!this.record || this.user.association_id == null) return false;
    const associationId = this.record.id ?? this.record;
    return String(this.user.association_id) === String(associationId);
  }
}

module.exports = AssociationPolicy;
