const express = require("express");
const router = express.Router();
const touristUserController = require("../controllers/touristUserController");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

router.get(
	"/",
	authenticate,
	authorize(["user:read", "booking:read"]),
	touristUserController.getAllTouristUsers,
);
router.post("/register", touristUserController.registerTourist);
router.post("/login", touristUserController.login);
router.put(
	"/:id/suspend",
	authenticate,
	authorize("user:update"),
	touristUserController.suspendTouristUser,
);

module.exports = router;
