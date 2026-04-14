const express = require("express");
const router = express.Router();
const associationController = require("../controllers/associationController");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Public association listing for unauthenticated registration flows
router.get("/public", asyncHandler(associationController.getAll));

router.get(
  "/",
  authenticate,
  authorize("association:read"),
  asyncHandler(associationController.getAll),
);

module.exports = router;