const productService = require("../services/productService");
const { policy } = require("../policies");
const {
  serialize,
  serializeMany,
} = require("../serializers/productSerializer");
const {
  successResponse,
  paginatedResponse,
  errorResponse,
} = require("../utils/helpers");
const { ForbiddenError } = require("../services/errors/AppError");

/* ── Controller actions ────────────────────────────────────────── */

/**
 * GET /api/products
 * List all products for the user's own company
 */
exports.getAllProducts = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Verify policy allows listing products
    if (!policy("product", req.user, {}).index()) {
      throw new ForbiddenError("You do not have permission to read products");
    }

    const { where, order } = req.ransack;
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page || req.query.limit) || 10;

    const result = await productService.getAllProductsByCompany(companyId, {
      where,
      order,
      search: req.query.search,
      page,
      perPage,
    });

    return paginatedResponse(
      res,
      serializeMany(result.docs),
      "Products fetched successfully",
      { total: result.total, page, perPage, pages: result.pages },
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};

/**
 * GET /api/products/shared-by-location
 * List products for the user's company + other companies at the same location
 */
exports.getProductsByLocation = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Verify policy allows listing products
    if (!policy("product", req.user, {}).index()) {
      throw new ForbiddenError("You do not have permission to read products");
    }

    const { where, order } = req.ransack;
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page || req.query.limit) || 10;

    const result = await productService.getAllProductsByLocation(companyId, {
      where,
      order,
      search: req.query.search,
      page,
      perPage,
    });

    return paginatedResponse(
      res,
      serializeMany(result.docs),
      "Products fetched successfully",
      { total: result.total, page, perPage, pages: result.pages },
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};

/**
 * GET /api/products/:id
 * Get a single product by ID
 */
exports.getProductById = async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);

    // Verify policy allows viewing this specific product
    if (!policy("product", req.user, product).show()) {
      throw new ForbiddenError(
        "You do not have permission to view this product",
      );
    }

    return successResponse(
      res,
      serialize(product),
      "Product fetched successfully",
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};

/**
 * POST /api/products
 * Create a new product
 */
exports.createProduct = async (req, res) => {
  try {
    const { name, product_type } = req.body;
    const companyId = req.user.company_id;

    // Verify policy allows creating products
    if (!policy("product", req.user, {}).create()) {
      throw new ForbiddenError("You do not have permission to create products");
    }

    // Enforce company_id from authenticated user
    const product = await productService.createProduct({
      name,
      product_type,
      company_id: companyId,
    });

    return successResponse(
      res,
      serialize(product),
      "Product created successfully",
      201,
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};

/**
 * PUT /api/products/:id
 * Update a product
 */
exports.updateProduct = async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);

    // Verify policy allows updating this product
    const productPolicy = policy("product", req.user, product);
    if (!productPolicy.update()) {
      throw new ForbiddenError(
        "You do not have permission to update this product",
      );
    }

    // Prevent company_id changes (handled in service as well)
    delete req.body.company_id;

    const updatedProduct = await productService.updateProduct(
      req.params.id,
      req.body,
    );

    return successResponse(
      res,
      serialize(updatedProduct),
      "Product updated successfully",
    );
  } catch (err) {
    return errorResponse(res, err);
  }
};

/**
 * DELETE /api/products/:id
 * Delete a product
 */
exports.deleteProduct = async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);

    // Verify policy allows deleting this product
    const productPolicy = policy("product", req.user, product);
    if (!productPolicy.destroy()) {
      throw new ForbiddenError(
        "You do not have permission to delete this product",
      );
    }

    await productService.deleteProduct(req.params.id);

    return successResponse(res, null, "Product deleted successfully");
  } catch (err) {
    return errorResponse(res, err);
  }
};
