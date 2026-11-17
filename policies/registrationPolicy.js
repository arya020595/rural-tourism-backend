const ApplicationPolicy = require("./applicationPolicy");

/**
 * Registration approval. Association users approve / reject the registrations
 * of their own association (registration:approve); superadmins all of them,
 * including companies registered without an association.
 *
 * `record` is a registration entry from registrationService ({ company,
 * owner, association }).
 */
class RegistrationPolicy extends ApplicationPolicy {
  index() {
    return this.isAdmin() || this.hasPermission("registration:approve");
  }

  show() {
    if (this.isAdmin()) return true;
    if (!this.hasPermission("registration:approve")) return false;
    return this._sameAssociation();
  }

  /** Approve and reject share the same rule. */
  decide() {
    return this.show();
  }

  _sameAssociation() {
    const associationId = this.record?.owner?.association_id ?? this.record?.association?.id;
    return (
      associationId != null &&
      this.user.association_id != null &&
      // == to handle int/string mismatch (JWT vs DB)
      associationId == this.user.association_id
    );
  }
}

module.exports = RegistrationPolicy;
