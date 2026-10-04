const { Op } = require("sequelize");
const Company = require("../models/companyModel");
const UnifiedUser = require("../models/unifiedUserModel");
const Role = require("../models/roleModel");
const {
  NotFoundError,
  BadRequestError,
  ConflictError,
} = require("./errors/AppError");
require("../models/associations");

class CompanyService {
  async getCompanyById(id) {
    const company = await Company.findByPk(id);
    if (!company) throw new NotFoundError("Company not found");
    return company;
  }

  async updateCompany(id, updates) {
    const company = await Company.findByPk(id);
    if (!company) throw new NotFoundError("Company not found");
    await company.update(updates);
    return company;
  }

  /**
   * The company owner is its first operator_admin (lowest id). A company can
   * have several operator_admins (e.g. a co-owner added as backup); only this
   * one is the "owner" shown on — and editable from — the company profile.
   * Single source of truth for that rule: display and update both use it.
   */
  async getCompanyOwner(companyId) {
    if (!companyId) return null;

    const adminRole = await Role.findOne({
      where: { name: "operator_admin" },
    });
    if (!adminRole) return null;

    return UnifiedUser.findOne({
      where: { company_id: companyId, role_id: adminRole.id },
      order: [["id", "ASC"]],
    });
  }

  /**
   * Update the company owner's user fields (name/email) — that one row only.
   * A bulk update across all operator_admins would rename every co-admin
   * and, since email is unique, fail outright with a 500.
   */
  async updateCompanyOwner(companyId, userFields) {
    if (!userFields || Object.keys(userFields).length === 0) return;

    const owner = await this.getCompanyOwner(companyId);
    if (!owner) return;

    try {
      await owner.update(userFields);
    } catch (err) {
      if (err?.name === "SequelizeUniqueConstraintError") {
        throw new ConflictError(
          "This email is already used by another account.",
        );
      }
      throw err;
    }
  }

  async getAllCompanies() {
    return Company.findAll({
      order: [
        ["company_name", "ASC"],
        ["id", "ASC"],
      ],
    });
  }

  async getCompaniesByAssociationId(associationId) {
    const normalizedAssociationId = Number(associationId);

    if (
      !Number.isInteger(normalizedAssociationId) ||
      normalizedAssociationId <= 0
    ) {
      throw new BadRequestError("association_id is required");
    }

    const companyLinks = await UnifiedUser.findAll({
      attributes: ["company_id"],
      where: {
        association_id: normalizedAssociationId,
        company_id: { [Op.ne]: null },
      },
      group: ["company_id"],
      raw: true,
    });

    const companyIds = companyLinks
      .map((row) => Number(row.company_id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (companyIds.length === 0) {
      return [];
    }

    return Company.findAll({
      where: { id: companyIds },
      order: [
        ["company_name", "ASC"],
        ["id", "ASC"],
      ],
    });
  }
}

module.exports = new CompanyService();
