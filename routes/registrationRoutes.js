const express = require("express");
const router = express.Router();
const registrationController = require("../controllers/registrationController");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");
const { asyncHandler } = require("../utils/helpers");

// Operator registration approval — association users (their association)
// and superadmins. Per-association scope is checked in the controller.

router.get(
  "/",
  authenticate,
  authorize("registration:approve"),
  asyncHandler(registrationController.list),
);

router.get(
  "/pending-count",
  authenticate,
  authorize("registration:approve"),
  asyncHandler(registrationController.pendingCount),
);

router.get(
  "/:companyId",
  authenticate,
  authorize("registration:approve"),
  asyncHandler(registrationController.show),
);

router.post(
  "/:companyId/approve",
  authenticate,
  authorize("registration:approve"),
  asyncHandler(registrationController.approve),
);

router.post(
  "/:companyId/reject",
  authenticate,
  authorize("registration:approve"),
  asyncHandler(registrationController.reject),
);

module.exports = router;
