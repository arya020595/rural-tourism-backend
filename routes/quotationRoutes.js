const express = require("express");
const router = express.Router();
const quotationController = require("../controllers/quotationController");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");
const { asyncHandler } = require("../utils/helpers");

router.get(
  "/",
  authenticate,
  authorize("quotation:read"),
  asyncHandler(quotationController.list),
);

router.post(
  "/",
  authenticate,
  authorize("quotation:create"),
  asyncHandler(quotationController.create),
);

// Company default notes & terms (before "/:id" so "terms" isn't read as an id).
router.get(
  "/terms",
  authenticate,
  authorize("quotation:read"),
  asyncHandler(quotationController.getTerms),
);

router.put(
  "/terms",
  authenticate,
  authorize("quotation:create"),
  asyncHandler(quotationController.saveTerms),
);

router.get(
  "/:id/pdf",
  authenticate,
  authorize("quotation:read"),
  asyncHandler(quotationController.pdf),
);

// Converting also needs booking:create (+ receipt:create for mode=receipt) —
// checked per record in the controller via the quotation policy.
router.get(
  "/:id/booking-draft",
  authenticate,
  authorize("quotation:read"),
  asyncHandler(quotationController.bookingDraft),
);

router.post(
  "/:id/cancel",
  authenticate,
  authorize("quotation:delete"),
  asyncHandler(quotationController.cancel),
);

router.get(
  "/:id",
  authenticate,
  authorize("quotation:read"),
  asyncHandler(quotationController.show),
);

router.put(
  "/:id",
  authenticate,
  authorize("quotation:update"),
  asyncHandler(quotationController.update),
);

module.exports = router;
