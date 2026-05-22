const { Op } = require("sequelize");
const Company = require("../models/companyModel");
const UnifiedUser = require("../models/unifiedUserModel");
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
