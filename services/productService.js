const { Op } = require("sequelize");
const Product = require("../models/productModel");
const Company = require("../models/companyModel");
const { NotFoundError, BadRequestError } = require("./errors/AppError");
require("../models/associations");

const PRODUCT_INCLUDES = [
  {
    model: Company,
    as: "company",
    required: false,
    attributes: ["id", "company_name", "location"],
  },
];

class ProductService {
  /**
   * Get all products for a specific company (own company only)
   * @param {number} companyId - The company ID to filter by
   * @param {object} [options={}] - { where, order, search, page, perPage }
   */
  async getAllProductsByCompany(
    companyId,
    { where = {}, order = [], search, page = 1, perPage = 10 } = {},
  ) {
    if (!companyId) {
      throw new BadRequestError("company_id is required");
    }

    // Apply search filter if provided
    if (search) {
      const pattern = `%${search}%`;
      where[Op.or] = [{ name: { [Op.like]: pattern } }];
    }

    // Merge company filter with other conditions
    const mergedWhere = { ...where, company_id: companyId };

    const result = await Product.paginate({
      where: mergedWhere,
      include: PRODUCT_INCLUDES,
      order: order.length ? order : [["id", "ASC"]],
      page,
      paginate: perPage,
    });

    return {
      docs: result.docs,
      total: result.total,
      pages: result.pages,
    };
  }

  /**
   * Get products by location (own company + other companies at same location)
   * @param {number} userCompanyId - The user's company ID
   * @param {object} [options={}] - { where, order, search, page, perPage }
   */
  async getAllProductsByLocation(
    userCompanyId,
    { where = {}, order = [], search, page = 1, perPage = 10 } = {},
  ) {
    if (!userCompanyId) {
      throw new BadRequestError("user company_id is required");
    }

    // Get user's company to find location
    const userCompany = await Company.findByPk(userCompanyId);
    if (!userCompany) {
      throw new NotFoundError("User company not found");
    }

    const userLocation = userCompany.location;

    // Apply search filter if provided
    if (search) {
      const pattern = `%${search}%`;
      where[Op.or] = [{ name: { [Op.like]: pattern } }];
    }

    // Get all companies at the same location
    const companiesAtLocation = await Company.findAll({
      attributes: ["id"],
      where: { location: userLocation },
      raw: true,
    });

    const companyIds = companiesAtLocation.map((c) => c.id);

    if (companyIds.length === 0) {
      return {
        docs: [],
        total: 0,
        pages: 0,
      };
    }

    // Merge location filter with other conditions
    const mergedWhere = { ...where, company_id: { [Op.in]: companyIds } };

    const result = await Product.paginate({
      where: mergedWhere,
      include: PRODUCT_INCLUDES,
      order: order.length ? order : [["id", "ASC"]],
      page,
      paginate: perPage,
    });

    return {
      docs: result.docs,
      total: result.total,
      pages: result.pages,
    };
  }

  /**
   * Get a single product by ID
   */
  async getProductById(id) {
    const product = await Product.findByPk(id, {
      include: PRODUCT_INCLUDES,
    });
    if (!product) throw new NotFoundError("Product not found");
    return product;
  }

  /**
   * Create a new product
   */
  async createProduct({ name, product_type, company_id }) {
    const trimmedName = String(name || "").trim();
    const trimmedType = String(product_type || "")
      .trim()
      .toLowerCase();

    if (!trimmedName) {
      throw new BadRequestError("name is required");
    }

    if (!["activity", "accommodation"].includes(trimmedType)) {
      throw new BadRequestError(
        'product_type must be "activity" or "accommodation"',
      );
    }

    if (!company_id) {
      throw new BadRequestError("company_id is required");
    }

    // Verify company exists
    const company = await Company.findByPk(company_id);
    if (!company) {
      throw new BadRequestError("Invalid company_id");
    }

    const product = await Product.create({
      name: trimmedName,
      product_type: trimmedType,
      company_id,
    });

    return this.getProductById(product.id);
  }

  /**
   * Update a product
   */
  async updateProduct(id, updates) {
    const product = await Product.findByPk(id);
    if (!product) throw new NotFoundError("Product not found");

    const fields = {};

    if (updates.name !== undefined) {
      fields.name = String(updates.name).trim();
      if (!fields.name) {
        throw new BadRequestError("name cannot be empty");
      }
    }

    if (updates.product_type !== undefined) {
      const trimmedType = String(updates.product_type).trim().toLowerCase();
      if (!["activity", "accommodation"].includes(trimmedType)) {
        throw new BadRequestError(
          'product_type must be "activity" or "accommodation"',
        );
      }
      fields.product_type = trimmedType;
    }

    // Note: company_id should not be updated after creation
    if (updates.company_id !== undefined) {
      throw new BadRequestError("company_id cannot be updated");
    }

    if (Object.keys(fields).length === 0) {
      return this.getProductById(id);
    }

    await product.update(fields);
    return this.getProductById(id);
  }

  /**
   * Delete a product
   */
  async deleteProduct(id) {
    const product = await Product.findByPk(id);
    if (!product) throw new NotFoundError("Product not found");
    await product.destroy();
  }
}

module.exports = new ProductService();
