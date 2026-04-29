const express = require("express");
const router = express.Router();
const associationController = require("../controllers/associationController");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");
const { asyncHandler } = require("../utils/helpers");

// Public association listing for unauthenticated registration flows
router.get("/public", asyncHandler(associationController.getPublicList));

router.get(
  "/",
  authenticate,
  authorize("bi_dashboard:read"),
  asyncHandler(associationController.getMyAssociation),
);

module.exports = router;
