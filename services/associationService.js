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

  async getAssociationById(id) {
    return Association.findByPk(id);
  }

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
