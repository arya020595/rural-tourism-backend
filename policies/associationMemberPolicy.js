const ApplicationPolicy = require("./applicationPolicy");

/**
 * A member company's profile as its association sees it (association
 * statistics page). Association users see approved companies of their own
 * association; superadmins see any company.
 *
 * `record` is an entry from registrationService.withOwners ({ company,
 * owner, association }).
 */
class AssociationMemberPolicy extends ApplicationPolicy {
  show() {
    if (this.isAdmin()) return true;
    if (!this.hasPermission("association:read")) return false;
    if (this.record?.company?.registration_status !== "approved") return false;
    const associationId = this.record?.owner?.association_id ?? this.record?.association?.id;
    return (
      associationId != null &&
      this.user.association_id != null &&
      // == to handle int/string mismatch (JWT vs DB)
      associationId == this.user.association_id
    );
  }
}

module.exports = AssociationMemberPolicy;
