const express = require("express");
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/uploadLogo");

const router = express.Router();

const operatorRegistrationUploadFields = upload.fields([
	{ name: "operator_logo_image", maxCount: 1 },
	{ name: "motac_license_file", maxCount: 1 },
	{ name: "trading_operation_license", maxCount: 1 },
	{ name: "homestay_certificate", maxCount: 1 },
]);

router.post("/login", authController.login);
router.post("/register", operatorRegistrationUploadFields, authController.register);
router.get("/me", authenticate, authController.me);

module.exports = router;
