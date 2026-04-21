const Company = require("../models/companyModel");
const { NotFoundError } = require("./errors/AppError");

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
}

module.exports = new CompanyService();
