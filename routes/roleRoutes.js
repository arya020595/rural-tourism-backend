const express = require("express");
const roleController = require("../controllers/roleController");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

const router = express.Router();

router.get("/", authenticate, authorize("role:read"), roleController.getAllRoles);
router.get("/:id", authenticate, authorize("role:read"), roleController.getRoleById);
router.post(
  "/",
  authenticate,
  authorize("role:update"),
  roleController.createRole,
);
router.put(
  "/:id/permissions",
  authenticate,
  authorize("role:update"),
  roleController.updateRolePermissions,
);

module.exports = router;
