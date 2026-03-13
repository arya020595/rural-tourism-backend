const express = require("express");
const router = express.Router();
const touristUserController = require("../controllers/touristUserController");

router.get("/", touristUserController.getAllTouristUsers);
router.post("/register", touristUserController.registerTourist);
router.post("/login", touristUserController.login);
router.put("/:id/suspend", touristUserController.suspendTouristUser);

module.exports = router;
