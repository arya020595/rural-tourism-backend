const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");
const { asyncHandler } = require("../utils/helpers");
const { ransackMiddleware } = require("../middleware/ransackSearch");
const {
  validateCreateProduct,
  validateUpdateProduct,
} = require("../validators/productValidator");

// List products for own company only
router.get(
  "/",
  authenticate,
  authorize("product:read"),
  ransackMiddleware,
  asyncHandler(productController.getAllProducts),
);

// List products by location (own company + same-location companies)
router.get(
  "/shared-by-location",
  authenticate,
  authorize("product:read"),
  ransackMiddleware,
  asyncHandler(productController.getProductsByLocation),
);

// Get product by ID
router.get(
  "/:id(\\d+)",
  authenticate,
  authorize("product:read"),
  asyncHandler(productController.getProductById),
);

// Create product
router.post(
  "/",
  authenticate,
  authorize("product:create"),
  validateCreateProduct,
  asyncHandler(productController.createProduct),
);

// Update product
router.put(
  "/:id",
  authenticate,
  authorize("product:update"),
  validateUpdateProduct,
  asyncHandler(productController.updateProduct),
);

// Delete product
router.delete(
  "/:id",
  authenticate,
  authorize("product:delete"),
  asyncHandler(productController.deleteProduct),
);

module.exports = router;
