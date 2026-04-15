const express = require("express");
const permissionController = require("../controllers/permissionController");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("permission:read"),
  permissionController.getAllPermissions,
);

module.exports = router;
