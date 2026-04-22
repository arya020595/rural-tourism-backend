const { createSchema, validate } = require("./schema");

/**
 * Product validators
 */

const createProductSchema = createSchema((field) => ({
  name: field().string().required().min(2).max(100).trim().stripHtml(),
  product_type: field()
    .string()
    .required()
    .pattern(/^(activity|accommodation)$/i, 'product_type must be "activity" or "accommodation"'),
}));

const updateProductSchema = createSchema((field) => ({
  name: field().string().optional().min(2).max(100).trim().stripHtml(),
  product_type: field()
    .string()
    .optional()
    .pattern(/^(activity|accommodation)$/i, 'product_type must be "activity" or "accommodation"'),
}));

/* ── Middleware exports ────────────────────────────────────────── */

module.exports = {
  validateCreateProduct: validate(createProductSchema),
  validateUpdateProduct: validate(updateProductSchema),
  createProductSchema,
  updateProductSchema,
};
