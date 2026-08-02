const { Op } = require("sequelize");
const Company = require("../models/companyModel");
const UnifiedUser = require("../models/unifiedUserModel");
const Role = require("../models/roleModel");
const { NotFoundError, BadRequestError } = require("./errors/AppError");
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
   * Update the company owner's user fields (e.g. name). The owner is the
   * operator_admin of the company — scope the update to that role so staff
   * accounts in the same company are never overwritten.
   */
  async updateCompanyOwner(companyId, userFields) {
    if (!userFields || Object.keys(userFields).length === 0) return;

    // Sequelize cannot filter by an included association in a bulk update, so
    // resolve the operator_admin role id and scope by company_id + role_id.
    const adminRole = await Role.findOne({
      where: { name: "operator_admin" },
    });
    if (!adminRole) return;

    await UnifiedUser.update(userFields, {
      where: { company_id: companyId, role_id: adminRole.id },
    });
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
