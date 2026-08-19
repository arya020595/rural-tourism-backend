const express = require("express");
const router = express.Router();
const healthController = require("../controllers/healthController");
const { asyncHandler } = require("../utils/helpers");

router.get("/", asyncHandler(healthController.check));

module.exports = router;
