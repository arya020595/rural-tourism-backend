const express = require('express');
const router = express.Router();
const operatorActivityController = require('../controllers/operatorActivitiesController');

// Helper for async error handling
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 1️⃣ Get all operator activities
router.get('/', asyncHandler(operatorActivityController.getAllOperatorActivities));

// 2️⃣ Get operators by activity_id
router.get('/activity/:activity_id', asyncHandler(operatorActivityController.getOperatorsByActivityId));

// 3️⃣ Get operator activity by ID (for detail view)
router.get('/:id', asyncHandler(operatorActivityController.getOperatorActivityById));

// 4️⃣ Create a new operator activity
router.post('/', asyncHandler(operatorActivityController.createOperatorActivity));

// 5️⃣ Update an existing operator activity
router.put('/:id', asyncHandler(operatorActivityController.updateOperatorActivity));

// 6️⃣ Delete an operator activity
router.delete('/:id', asyncHandler(operatorActivityController.deleteOperatorActivity));

// 7️⃣ Get all operator activities by RT user ID
router.get('/user/:rt_user_id', asyncHandler(operatorActivityController.getAllOperatorActivitiesByUser));

module.exports = router;
