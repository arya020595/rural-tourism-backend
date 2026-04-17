const Association = require("../models/associationModel");

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
}

module.exports = new AssociationService();