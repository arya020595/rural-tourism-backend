const express = require("express");
const router = express.Router();
const formController = require("../controllers/formController");
const { authenticate } = require("../middleware/auth");
const { authorize, authorizeOwnership } = require("../middleware/authorize");

// Async wrapper for error handling
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Routes
// router.get("/:id", asyncHandler(formController.getRespById));
// router.post("/", asyncHandler(formController.createForm));
// router.get("/operator/:user_id", asyncHandler(formController.getFormsByOperator));
// MOST SPECIFIC FIRST
router.get(
  "/operator/:user_id",
  authenticate,
  authorize("receipt:read"),
  authorizeOwnership("user_id"),
  asyncHandler(formController.getFormsByOperator),
);
router.get(
  "/tourist/:tourist_user_id",
  authenticate,
  authorize("receipt:read"),
  authorizeOwnership("tourist_user_id"),
  asyncHandler(formController.getFormsByTourist),
);

// THEN generic
router.get(
  "/:id",
  authenticate,
  authorize("receipt:read"),
  asyncHandler(formController.getRespById),
);

router.post(
  "/",
  authenticate,
  authorize(["receipt:create", "booking:create", "booking:update"]),
  asyncHandler(formController.createForm),
);

module.exports = router;
