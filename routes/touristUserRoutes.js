const express = require('express');
const router = express.Router();
const touristUserController = require('../controllers/touristUserController');

// POST /api/tourists/register
router.post('/register', touristUserController.registerTourist);
router.post('/login', touristUserController.login);

module.exports = router;
