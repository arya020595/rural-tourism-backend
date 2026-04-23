const Association = require("../models/associationModel");
const { ForbiddenError, NotFoundError } = require("./errors/AppError");

class AssociationService {
  normalizeName(value) {
    return String(value || "").trim();
  }

  dedupeByName(associations = []) {
    const seen = new Set();
    const uniqueAssociations = [];

    for (const association of associations) {
      const normalizedName = this.normalizeName(association?.name).toLowerCase();

      if (!normalizedName || seen.has(normalizedName)) {
        continue;
      }

      seen.add(normalizedName);
      uniqueAssociations.push(association);
    }

    return uniqueAssociations;
  }

  async getAllAssociations() {
    const associations = await Association.findAll({
      order: [
        ["name", "ASC"],
        ["id", "ASC"],
      ],
    });

    return this.dedupeByName(associations);
  }

  /**
   * Fetches an association record by primary key.
   */
  async getAssociationById(id) {
    return Association.findByPk(id);
  }

  /**
   * Resolves association access using the caller's scoped association id.
   * Throws forbidden when scope is missing and not found when the record doesn't exist.
   */
  async getScopedAssociation(associationId) {
    if (!associationId) {
      throw new ForbiddenError("Association scope is required");
    }

    const association = await this.getAssociationById(associationId);
    if (!association) {
      throw new NotFoundError("Association not found");
    }

    return association;
  }
}

module.exports = new AssociationService();
