const express = require("express");
const router = express.Router();
const formController = require("../controllers/formController");

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
  asyncHandler(formController.getFormsByOperator),
);
router.get(
  "/tourist/:tourist_user_id",
  asyncHandler(formController.getFormsByTourist),
);

// THEN generic
router.get("/:id", asyncHandler(formController.getRespById));

router.post("/", asyncHandler(formController.createForm));

module.exports = router;
