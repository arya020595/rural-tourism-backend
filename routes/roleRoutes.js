const express = require("express");
const roleController = require("../controllers/roleController");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");
const { asyncHandler } = require("../utils/helpers");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("role:read"),
  asyncHandler(roleController.getAllRoles),
);

router.get(
  "/:id",
  authenticate,
  authorize("role:read"),
  asyncHandler(roleController.getRoleById),
);

router.get(
  "/:id/permissions-by-section",
  authenticate,
  authorize("role:read"),
  asyncHandler(roleController.getRoleWithPermissionsBySection),
);

router.post(
  "/",
  authenticate,
  authorize("role:create"),
  asyncHandler(roleController.createRole),
);

router.put(
  "/:id",
  authenticate,
  authorize("role:update"),
  asyncHandler(roleController.updateRole),
);

router.put(
  "/:id/permissions",
  authenticate,
  authorize("role:update"),
  asyncHandler(roleController.updateRolePermissions),
);

router.delete(
  "/:id",
  authenticate,
  authorize("role:delete"),
  asyncHandler(roleController.deleteRole),
);

module.exports = router;
