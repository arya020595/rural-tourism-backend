const express = require("express");
const router = express.Router();
const associationController = require("../controllers/associationController");

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get("/", asyncHandler(associationController.getAll))

module.exports = router;