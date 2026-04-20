const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const upload = require("../middleware/uploadLogo");
const { authenticate } = require("../middleware/auth");
const { asyncHandler } = require("../utils/helpers");

const companyUploadFields = upload.fields([
  { name: "operator_logo_image", maxCount: 1 },
  { name: "motac_license_file", maxCount: 1 },
  { name: "trading_operation_license", maxCount: 1 },
  { name: "homestay_certificate", maxCount: 1 },
]);

// GET /api/companies/:id
router.get(
  "/:id",
  authenticate,
  asyncHandler(companyController.getCompanyById),
);

// PUT /api/companies/:id
router.put(
  "/:id",
  authenticate,
  companyUploadFields,
  asyncHandler(companyController.updateCompany),
);

module.exports = router;
